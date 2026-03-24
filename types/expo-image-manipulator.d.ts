declare module 'expo-image-manipulator' {
  export enum SaveFormat {
    JPEG = 'jpeg',
    PNG = 'png',
    WEBP = 'webp',
  }

  export type ImageResult = {
    uri: string;
    width: number;
    height: number;
    base64?: string;
  };

  export type ActionCrop = {
    crop: {
      originX: number;
      originY: number;
      width: number;
      height: number;
    };
  };

  export type SaveOptions = {
    compress?: number;
    format?: SaveFormat;
    base64?: boolean;
  };

  export function manipulateAsync(
    uri: string,
    actions?: ActionCrop[],
    saveOptions?: SaveOptions,
  ): Promise<ImageResult>;
}
