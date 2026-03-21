import { ImageFormat, Skia } from "@shopify/react-native-skia";
import * as FileSystem from "expo-file-system";

export type CropData = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

export type CropContext = {
  rotationAngle: number;
  flipVertical: boolean;
  flipHorizontal: boolean;
};

/**
 * Crops and transforms an image using Skia.
 *
 * The process involves:
 * 1. Creating a surface that fits the rotated/flipped image.
 * 2. Drawing the original image with the requested transformations.
 * 3. Cropping the desired area from the transformed result.
 */
export async function cropImageWithSkia(
  uri: string,
  cropData: CropData,
  cropContext: CropContext,
  quality = 90
): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const data = Skia.Data.fromBase64(base64);
  const image = Skia.Image.MakeImageFromEncoded(data);

  if (!image) {
    throw new Error("Skia: failed to decode image");
  }

  const { rotationAngle, flipHorizontal, flipVertical } = cropContext;

  // 1. Determine the dimensions of the image after rotation
  // For 90 or 270 degree rotations, the width and height are swapped.
  const isRotated90 = (Math.abs(rotationAngle) / 90) % 2 !== 0;
  const rotatedWidth = isRotated90 ? image.height() : image.width();
  const rotatedHeight = isRotated90 ? image.width() : image.height();

  // 2. Create a surface for the rotated image and draw it
  const rotatedSurface = Skia.Surface.MakeOffscreen(rotatedWidth, rotatedHeight);
  if (!rotatedSurface) {
    throw new Error("Skia: failed to create surface for rotation");
  }

  const rc = rotatedSurface.getCanvas();
  rc.translate(rotatedWidth / 2, rotatedHeight / 2);
  rc.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
  rc.rotate(rotationAngle, 0, 0);
  rc.translate(-image.width() / 2, -image.height() / 2);
  rc.drawImage(image, 0, 0);

  const rotatedImage = rotatedSurface.makeImageSnapshot();

  // 3. Create the final surface for the crop area
  const { width: targetWidth, height: targetHeight } = cropData;
  const finalSurface = Skia.Surface.MakeOffscreen(targetWidth, targetHeight);
  if (!finalSurface) {
    throw new Error("Skia: failed to create final surface for crop");
  }

  const fc = finalSurface.getCanvas();
  fc.drawImageRect(
    rotatedImage,
    Skia.XYWHRect(cropData.originX, cropData.originY, targetWidth, targetHeight),
    Skia.XYWHRect(0, 0, targetWidth, targetHeight),
    Skia.Paint()
  );

  const snapshot = finalSurface.makeImageSnapshot();
  const jpegBase64 = snapshot.encodeToBase64(ImageFormat.JPEG, quality);
  if (!jpegBase64) {
    throw new Error("Skia: failed to encode JPEG");
  }

  // 4. Save the result to a temporary file
  const outputUri =
    `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ""}` +
    `cropped_${Date.now()}.jpg`;

  await FileSystem.writeAsStringAsync(outputUri, jpegBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return outputUri;
}
