export type CropRectPx = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

export type CropComputationInput = {
  imageWidth: number;
  imageHeight: number;
  containerWidth: number;
  containerHeight: number;
  cropFrameWidth: number;
  cropFrameHeight: number;
  baseScale: number;
  userScale: number;
  translateX: number;
  translateY: number;
};

export type CropMetadata = {
  cropRectPx: CropRectPx;
  imageWidth: number;
  imageHeight: number;
  containerWidth: number;
  containerHeight: number;
  cropFrameWidth: number;
  cropFrameHeight: number;
  baseScale: number;
  userScale: number;
  translateX: number;
  translateY: number;
};

export type ImageCropResult = {
  uri: string;
  width: number;
  height: number;
  metadata: CropMetadata;
};
