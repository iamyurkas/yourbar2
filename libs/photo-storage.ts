import { ImageFormat, Skia } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import { buildPhotoFileName } from '@/libs/photo-utils';

const PHOTO_MAX_SIDE = 150;
const PHOTO_ROOT = 'photos';
const PHOTO_JPEG_QUALITY = 1;
const PHOTO_FLATTEN_QUALITY = 100;

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


const isLocalFileUri = (uri: string) =>
  uri.startsWith('file:') || uri.startsWith('content:');


const isPng = (uri: string) =>
  uri.toLowerCase().split('?')[0].endsWith('.png');


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

const flattenToJpegWithWhiteBg = async (
  uri: string,
  quality = PHOTO_FLATTEN_QUALITY,
): Promise<string> => {
  // Read the source image as base64
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Decode into Skia image
  const data = Skia.Data.fromBase64(base64);
  const img = Skia.Image.MakeImageFromEncoded(data);
  if (!img) {
    throw new Error('Skia: failed to decode image');
  }

  const width = img.width();
  const height = img.height();

  // Create an offscreen surface
  const surface = Skia.Surface.MakeOffscreen(width, height);
  if (!surface) {
    throw new Error('Skia: failed to create offscreen surface');
  }

  const canvas = surface.getCanvas();

  // Fill background with white
  const paint = Skia.Paint();
  paint.setColor(Skia.Color('#FFFFFF'));
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), paint);

  // Draw the original image on top
  canvas.drawImage(img, 0, 0);

  surface.flush();

  // Snapshot and encode as JPEG
  const snapshot = surface.makeImageSnapshot();
  const jpegBase64 = snapshot.encodeToBase64(ImageFormat.JPEG, quality);
  if (!jpegBase64) {
    throw new Error('Skia: failed to encode JPEG');
  }

  // Save into cache directory
  const outputUri =
    `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ''}` +
    `flatten_${Date.now()}.jpg`;

  await FileSystem.writeAsStringAsync(outputUri, jpegBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return outputUri;
};

export const storePhoto = async ({
  uri,
  id,
  name,
  category,
  suffix,
}: StorePhotoInput) => {
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
    // Read original dimensions
    const metadata = await ImageManipulator.manipulateAsync(uri, [], {
      base64: false,
    });

    const { width, height } = metadata;
    const { width: targetWidth, height: targetHeight, shouldResize } =
      getResizedDimensions(width, height);

    const actions = shouldResize
      ? [{ resize: { width: targetWidth, height: targetHeight } }]
      : [];

    const needsFlatten = isPng(uri);

    const intermediate = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: PHOTO_JPEG_QUALITY,
      format: needsFlatten
        ? ImageManipulator.SaveFormat.PNG
        : ImageManipulator.SaveFormat.JPEG,
    });

    const finalTempUri = needsFlatten
      ? await flattenToJpegWithWhiteBg(intermediate.uri)
      : intermediate.uri;

    const fileName = buildPhotoFileName(id, name, 'jpg', suffix);
    const targetUri = `${directory}${fileName}`;

    await FileSystem.deleteAsync(targetUri, { idempotent: true });
    await FileSystem.moveAsync({ from: finalTempUri, to: targetUri });

    // Clean up intermediate PNG file if it was used
    if (needsFlatten) {
      await FileSystem.deleteAsync(intermediate.uri, { idempotent: true });
    }

    return targetUri;
  } catch (error) {
    console.warn('Failed to store photo', error);
    return uri;
  }
};

export const shouldStorePhoto = (uri?: string | null) =>
  typeof uri === 'string' && isLocalFileUri(uri);
