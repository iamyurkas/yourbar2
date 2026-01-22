import type { SkImage } from '@shopify/react-native-skia';
import { ImageFormat, Skia } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';

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


const isLocalFileUri = (uri: string) =>
  uri.startsWith('file:') || uri.startsWith('content:');


const getResizedDimensions = (width: number, height: number) => {
  const longestSide = Math.max(width, height);
  if (!Number.isFinite(longestSide) || longestSide <= 0) {
    return { width, height, shouldResize: false };
  }

  const scale = Math.min(1, PHOTO_MAX_SIDE / longestSide);
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  return {
    width: targetWidth,
    height: targetHeight,
    shouldResize: scale < 1,
  };
};

const saveWebpWithWhiteBg = async (
  image: SkImage,
  targetWidth: number,
  targetHeight: number,
  quality = 90,
): Promise<string> => {
  // Create an offscreen surface
  const surface = Skia.Surface.MakeOffscreen(targetWidth, targetHeight);
  if (!surface) {
    throw new Error('Skia: failed to create offscreen surface');
  }

  const canvas = surface.getCanvas();

  // Fill background with white
  const paint = Skia.Paint();
  paint.setColor(Skia.Color('#FFFFFF'));
  canvas.drawRect(Skia.XYWHRect(0, 0, targetWidth, targetHeight), paint);

  // Draw the original image on top
  const imagePaint = Skia.Paint();
  canvas.drawImageRectCubic(
    image,
    Skia.XYWHRect(0, 0, image.width(), image.height()),
    Skia.XYWHRect(0, 0, targetWidth, targetHeight),
    1 / 3,
    1 / 3,
    imagePaint,
  );

  surface.flush();

  // Snapshot and encode as WebP
  const snapshot = surface.makeImageSnapshot();
  const webpBase64 = snapshot.encodeToBase64(ImageFormat.WEBP, quality);
  if (!webpBase64) {
    throw new Error('Skia: failed to encode WebP');
  }

  // Save into cache directory
  const outputUri =
    `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ''}` +
    `flatten_${Date.now()}.webp`;

  await FileSystem.writeAsStringAsync(outputUri, webpBase64, {
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
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const data = Skia.Data.fromBase64(base64);
    const img = Skia.Image.MakeImageFromEncoded(data);
    if (!img) {
      throw new Error('Skia: failed to decode image');
    }

    const width = img.width();
    const height = img.height();
    const { width: targetWidth, height: targetHeight } = getResizedDimensions(
      width,
      height,
    );

    const finalTempUri = await saveWebpWithWhiteBg(
      img,
      targetWidth,
      targetHeight,
      90,
    );

    const fileName = buildPhotoFileName(id, name, 'webp', suffix);
    const targetUri = `${directory}${fileName}`;

    await FileSystem.deleteAsync(targetUri, { idempotent: true });
    await FileSystem.moveAsync({ from: finalTempUri, to: targetUri });

    return targetUri;
  } catch (error) {
    console.warn('Failed to store photo', error);
    return uri;
  }
};

export const shouldStorePhoto = (uri?: string | null) =>
  typeof uri === 'string' && isLocalFileUri(uri);
