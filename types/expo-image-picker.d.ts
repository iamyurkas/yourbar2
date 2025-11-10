declare module 'expo-image-picker' {
  export type MediaTypeOptionsValue = 'All' | 'Images' | 'Videos';

  export const MediaTypeOptions: {
    readonly All: MediaTypeOptionsValue;
    readonly Images: MediaTypeOptionsValue;
    readonly Videos: MediaTypeOptionsValue;
  };

  export type ImagePickerAsset = {
    uri: string;
    width?: number;
    height?: number;
    fileName?: string;
    fileSize?: number;
    type?: string;
  };

  export type ImagePickerSuccessResult = {
    canceled: false;
    assets: ImagePickerAsset[];
  };

  export type ImagePickerCancelledResult = {
    canceled: true;
    assets?: undefined;
  };

  export type ImagePickerResult = ImagePickerSuccessResult | ImagePickerCancelledResult;

  export type ImagePickerOptions = {
    mediaTypes?: MediaTypeOptionsValue;
    allowsEditing?: boolean;
    aspect?: readonly [number, number];
    quality?: number;
  };

  export type PermissionResponse = {
    granted: boolean;
    canAskAgain: boolean;
    expires: 'never' | number;
    status: 'denied' | 'granted' | 'undetermined';
  };

  export function requestMediaLibraryPermissionsAsync(): Promise<PermissionResponse>;

  export function launchImageLibraryAsync(
    options?: ImagePickerOptions,
  ): Promise<ImagePickerResult>;
}
