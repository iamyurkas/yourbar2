declare module 'expo-image-manipulator' {
  export enum FlipType {
    Vertical = 'vertical',
    Horizontal = 'horizontal',
  }

  export enum SaveFormat {
    JPEG = 'jpeg',
    PNG = 'png',
    WEBP = 'webp',
  }

  export type Action =
    | { resize: { width?: number; height?: number } }
    | { rotate: number }
    | { flip: FlipType }
    | { crop: { originX: number; originY: number; width: number; height: number } };

  export function manipulateAsync(
    uri: string,
    actions?: Action[],
    saveOptions?: { compress?: number; format?: SaveFormat },
  ): Promise<{ uri: string; width: number; height: number }>;
}
