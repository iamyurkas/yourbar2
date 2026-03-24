import type { CropComputationInput, CropRectPx } from '@/libs/image-crop/types';

const MIN_CROP_SIZE_PX = 1;

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

export function getInitialBaseScale(params: {
  imageWidth: number;
  imageHeight: number;
  cropFrameWidth: number;
  cropFrameHeight: number;
}): number {
  'worklet';
  const { imageWidth, imageHeight, cropFrameWidth, cropFrameHeight } = params;
  if (imageWidth <= 0 || imageHeight <= 0 || cropFrameWidth <= 0 || cropFrameHeight <= 0) {
    return 1;
  }

  return Math.max(cropFrameWidth / imageWidth, cropFrameHeight / imageHeight);
}

export function getMaxTranslation(params: {
  imageWidth: number;
  imageHeight: number;
  baseScale: number;
  userScale: number;
  cropFrameWidth: number;
  cropFrameHeight: number;
}): { maxX: number; maxY: number } {
  'worklet';
  const { imageWidth, imageHeight, baseScale, userScale, cropFrameWidth, cropFrameHeight } = params;
  const renderedWidth = imageWidth * baseScale * userScale;
  const renderedHeight = imageHeight * baseScale * userScale;

  return {
    maxX: Math.max(0, (renderedWidth - cropFrameWidth) / 2),
    maxY: Math.max(0, (renderedHeight - cropFrameHeight) / 2),
  };
}

export function computeCropRectInImagePixels(input: CropComputationInput): CropRectPx {
  const {
    imageWidth,
    imageHeight,
    containerWidth,
    containerHeight,
    cropFrameWidth,
    cropFrameHeight,
    baseScale,
    userScale,
    translateX,
    translateY,
  } = input;

  const renderedScale = baseScale * userScale;
  const renderedImageWidth = imageWidth * renderedScale;
  const renderedImageHeight = imageHeight * renderedScale;

  const containerCenterX = containerWidth / 2;
  const containerCenterY = containerHeight / 2;

  // Image is rendered around container center and then translated by gestures.
  const imageLeftInScreen = containerCenterX + translateX - renderedImageWidth / 2;
  const imageTopInScreen = containerCenterY + translateY - renderedImageHeight / 2;

  // Crop frame is fixed and centered in screen space.
  const cropLeftInScreen = (containerWidth - cropFrameWidth) / 2;
  const cropTopInScreen = (containerHeight - cropFrameHeight) / 2;

  // Convert from screen units back to original image pixels using inverse render scale.
  const originXFloat = (cropLeftInScreen - imageLeftInScreen) / renderedScale;
  const originYFloat = (cropTopInScreen - imageTopInScreen) / renderedScale;
  const widthFloat = cropFrameWidth / renderedScale;
  const heightFloat = cropFrameHeight / renderedScale;

  const safeOriginX = clamp(originXFloat, 0, Math.max(0, imageWidth - MIN_CROP_SIZE_PX));
  const safeOriginY = clamp(originYFloat, 0, Math.max(0, imageHeight - MIN_CROP_SIZE_PX));

  // Round pixel coordinates to integers expected by manipulator while preserving coverage.
  const originX = Math.floor(safeOriginX);
  const originY = Math.floor(safeOriginY);

  const maxWidthFromOrigin = Math.max(MIN_CROP_SIZE_PX, imageWidth - originX);
  const maxHeightFromOrigin = Math.max(MIN_CROP_SIZE_PX, imageHeight - originY);

  const width = clamp(Math.round(widthFloat), MIN_CROP_SIZE_PX, maxWidthFromOrigin);
  const height = clamp(Math.round(heightFloat), MIN_CROP_SIZE_PX, maxHeightFromOrigin);

  return {
    originX,
    originY,
    width,
    height,
  };
}
