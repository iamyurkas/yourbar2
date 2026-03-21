import { Skia, ImageFormat, type SkImage } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';

export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function clampToImageBounds(rect: CropRect, image: SkImage): CropRect {
  const imageWidth = image.width();
  const imageHeight = image.height();

  const x = Math.max(0, Math.min(Math.round(rect.x), imageWidth - 1));
  const y = Math.max(0, Math.min(Math.round(rect.y), imageHeight - 1));
  const maxWidth = imageWidth - x;
  const maxHeight = imageHeight - y;

  return {
    x,
    y,
    width: Math.max(1, Math.min(Math.round(rect.width), maxWidth)),
    height: Math.max(1, Math.min(Math.round(rect.height), maxHeight)),
  };
}

export async function cropImageUri(sourceUri: string, rect: CropRect): Promise<string> {
  const encoded = await Skia.Data.fromURI(sourceUri);
  const decoded = Skia.Image.MakeImageFromEncoded(encoded);

  if (!decoded) {
    throw new Error('Unable to decode image for cropping.');
  }

  const sourceInfo = decoded.getImageInfo();
  const bounded = clampToImageBounds(rect, decoded);

  const pixels = decoded.readPixels(bounded.x, bounded.y, {
    width: bounded.width,
    height: bounded.height,
    alphaType: sourceInfo.alphaType,
    colorType: sourceInfo.colorType,
  });

  if (!pixels || !(pixels instanceof Uint8Array)) {
    throw new Error('Unable to read image pixels for cropping.');
  }

  const outputImage = Skia.Image.MakeImage(
    {
      width: bounded.width,
      height: bounded.height,
      alphaType: sourceInfo.alphaType,
      colorType: sourceInfo.colorType,
    },
    Skia.Data.fromBytes(pixels),
    bounded.width * 4,
  );

  if (!outputImage) {
    throw new Error('Unable to create cropped image.');
  }

  const base64 = outputImage.encodeToBase64(ImageFormat.JPEG, 100);
  const destinationUri = `${FileSystem.cacheDirectory}crop-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

  await FileSystem.writeAsStringAsync(destinationUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return destinationUri;
}
