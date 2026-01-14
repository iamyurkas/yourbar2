import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

import { buildPhotoFileName } from '@/libs/photo-utils';

const PHOTO_MAX_SIDE = 150;
const PHOTO_ROOT = 'photos';

type PhotoCategory = 'cocktails' | 'ingredients';

type StorePhotoInput = {
  uri: string;
  id: number | string;
  name: string;
  category: PhotoCategory;
  suffix?: string;
};

const ensurePhotoDirectory = async (category: PhotoCategory) => {
  const rootDirectory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!rootDirectory) {
    return null;
  }

  const directory = `${rootDirectory.replace(/\/?$/, '/')}${PHOTO_ROOT}/${category}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
};

const isLocalFileUri = (uri: string) => uri.startsWith('file:') || uri.startsWith('content:');

const isPngUri = (uri: string) => /\.png(?:$|[?#])/i.test(uri);

const resolveSaveOptions = (uri: string) => {
  const isPngSource = isPngUri(uri);
  const shouldFlattenTransparency = isPngSource && Platform.OS === 'web';
  const format =
    isPngSource && Platform.OS !== 'web'
      ? ImageManipulator.SaveFormat.PNG
      : ImageManipulator.SaveFormat.JPEG;

  return {
    format,
    extension: format === ImageManipulator.SaveFormat.PNG ? 'png' : 'jpg',
    shouldFlattenTransparency,
  };
};

const getResizedDimensions = (width: number, height: number) => {
  const longestSide = Math.max(width, height);
  if (!Number.isFinite(longestSide) || longestSide <= 0) {
    return { width, height, shouldResize: false };
  }

  const scale = PHOTO_MAX_SIDE / longestSide;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  return {
    width: targetWidth,
    height: targetHeight,
    shouldResize: targetWidth !== width || targetHeight !== height,
  };
};

export const storePhoto = async ({ uri, id, name, category, suffix }: StorePhotoInput) => {
  if (!uri) {
    return undefined;
  }

  if (!isLocalFileUri(uri)) {
    return uri;
  }

  const directory = await ensurePhotoDirectory(category);
  if (!directory) {
    return uri;
  }

  try {
    const metadata = await ImageManipulator.manipulateAsync(uri, [], { base64: false });
    const { width, height } = metadata;
    const { width: targetWidth, height: targetHeight, shouldResize } = getResizedDimensions(
      width,
      height,
    );

    const { format, extension, shouldFlattenTransparency } = resolveSaveOptions(uri);
    const actions: ImageManipulator.Action[] = [];

    if (shouldResize) {
      actions.push({ resize: { width: targetWidth, height: targetHeight } });
    }

    if (
      shouldFlattenTransparency &&
      Number.isFinite(targetWidth) &&
      Number.isFinite(targetHeight) &&
      targetWidth > 0 &&
      targetHeight > 0
    ) {
      actions.push({
        extent: {
          backgroundColor: '#ffffff',
          originX: 0,
          originY: 0,
          width: targetWidth,
          height: targetHeight,
        },
      });
    }

    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.9,
      format,
    });

    const fileName = buildPhotoFileName(id, name, extension, suffix);
    const targetUri = `${directory}${fileName}`;

    await FileSystem.deleteAsync(targetUri, { idempotent: true });
    await FileSystem.moveAsync({ from: result.uri, to: targetUri });

    return targetUri;
  } catch (error) {
    console.warn('Failed to store photo', error);
    return uri;
  }
};

export const shouldStorePhoto = (uri?: string | null) =>
  typeof uri === 'string' && isLocalFileUri(uri);
