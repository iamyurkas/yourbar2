declare module 'react-native-zoom-toolkit' {
  import type React from 'react';

  export type SizeVector<T> = { width: T; height: T };

  export type CropContext = {
    rotationAngle: number;
    flipHorizontal: boolean;
    flipVertical: boolean;
  };

  export type CropResult = {
    resize?: { width?: number; height?: number };
    crop: { originX: number; originY: number; width: number; height: number };
    context: CropContext;
  };

  export type CropZoomType = {
    crop: (fixedWidth?: number) => CropResult | undefined;
    rotate: (clockwise?: boolean, animated?: boolean, callback?: (angle: number) => void) => void;
    flipHorizontal: (animated?: boolean, callback?: (angle: number) => void) => void;
    flipVertical: (animated?: boolean, callback?: (angle: number) => void) => void;
  };

  export const CropZoom: React.ComponentType<{
    ref?: React.Ref<CropZoomType>;
    cropSize: SizeVector<number>;
    resolution: SizeVector<number>;
    OverlayComponent?: React.ComponentType | (() => React.ReactNode);
    maxScale?: number;
    children?: React.ReactNode;
  }>;

  export function useImageResolution(source: { uri: string }): {
    isFetching: boolean;
    resolution?: SizeVector<number>;
  };
}
