export type CropShape = "rect" | "circle";

export type ImageDimensions = {
  width: number;
  height: number;
};

export type CropArea = {
  width: number;
  height: number;
};

export type PreviewLayout = {
  width: number;
  height: number;
};

export type CropRectPixels = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

export const clamp = (value: number, min: number, max: number) => {
  "worklet";
  return Math.min(Math.max(value, min), max);
};

export const getContainedImageSize = (
  image: ImageDimensions,
  preview: PreviewLayout,
): ImageDimensions => {
  if (image.width <= 0 || image.height <= 0 || preview.width <= 0 || preview.height <= 0) {
    return { width: 0, height: 0 };
  }

  const imageAspect = image.width / image.height;
  const previewAspect = preview.width / preview.height;

  if (imageAspect > previewAspect) {
    return {
      width: preview.width,
      height: preview.width / imageAspect,
    };
  }

  return {
    width: preview.height * imageAspect,
    height: preview.height,
  };
};

export const getCropSize = (
  preview: PreviewLayout,
  cropAspectRatio: number,
  horizontalPadding: number,
): CropArea => {
  const maxCropWidth = Math.max(preview.width - horizontalPadding * 2, 0);
  const maxCropHeight = Math.max(preview.height - horizontalPadding * 2, 0);

  if (maxCropWidth === 0 || maxCropHeight === 0) {
    return { width: 0, height: 0 };
  }

  let cropWidth = maxCropWidth;
  let cropHeight = cropWidth / cropAspectRatio;

  if (cropHeight > maxCropHeight) {
    cropHeight = maxCropHeight;
    cropWidth = cropHeight * cropAspectRatio;
  }

  return {
    width: Math.round(cropWidth),
    height: Math.round(cropHeight),
  };
};

export const getMinimumScale = (containedImage: ImageDimensions, cropArea: CropArea): number => {
  if (containedImage.width <= 0 || containedImage.height <= 0 || cropArea.width <= 0 || cropArea.height <= 0) {
    return 1;
  }

  return Math.max(cropArea.width / containedImage.width, cropArea.height / containedImage.height);
};

export const clampTranslation = (
  translation: { x: number; y: number },
  scale: number,
  containedImage: ImageDimensions,
  cropArea: CropArea,
) => {
  "worklet";

  const scaledWidth = containedImage.width * scale;
  const scaledHeight = containedImage.height * scale;

  const maxTranslateX = Math.max((scaledWidth - cropArea.width) / 2, 0);
  const maxTranslateY = Math.max((scaledHeight - cropArea.height) / 2, 0);

  return {
    x: clamp(translation.x, -maxTranslateX, maxTranslateX),
    y: clamp(translation.y, -maxTranslateY, maxTranslateY),
  };
};

export const mapCropFrameToImagePixels = (
  params: {
    originalImage: ImageDimensions;
    containedImage: ImageDimensions;
    cropArea: CropArea;
    scale: number;
    translateX: number;
    translateY: number;
  },
): CropRectPixels => {
  const {
    originalImage,
    containedImage,
    cropArea,
    scale,
    translateX,
    translateY,
  } = params;

  const renderedWidth = containedImage.width * scale;
  const renderedHeight = containedImage.height * scale;

  const cropOriginInRenderedSpaceX = renderedWidth / 2 - cropArea.width / 2 - translateX;
  const cropOriginInRenderedSpaceY = renderedHeight / 2 - cropArea.height / 2 - translateY;

  const xRatio = originalImage.width / renderedWidth;
  const yRatio = originalImage.height / renderedHeight;

  const originX = clamp(cropOriginInRenderedSpaceX * xRatio, 0, originalImage.width - 1);
  const originY = clamp(cropOriginInRenderedSpaceY * yRatio, 0, originalImage.height - 1);

  const maxWidth = originalImage.width - originX;
  const maxHeight = originalImage.height - originY;

  const width = clamp(cropArea.width * xRatio, 1, maxWidth);
  const height = clamp(cropArea.height * yRatio, 1, maxHeight);

  return {
    originX: Math.round(originX),
    originY: Math.round(originY),
    width: Math.round(width),
    height: Math.round(height),
  };
};
