declare module 'expo-image-picker' {
  export enum MediaTypeOptions {
    All = 'All',
    Images = 'Images',
    Videos = 'Videos',
  }

  export type PermissionResponse = {
    granted: boolean;
  };

  export type ImagePickerAsset = {
    uri?: string;
  };

  export type ImagePickerResult = {
    canceled: boolean;
    assets?: ImagePickerAsset[];
  };

  export type ImageLibraryOptions = {
    mediaTypes?: MediaTypeOptions | MediaTypeOptions[];
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
  };

  export function requestMediaLibraryPermissionsAsync(): Promise<PermissionResponse>;
  export function launchImageLibraryAsync(
    options?: ImageLibraryOptions,
  ): Promise<ImagePickerResult>;
}
