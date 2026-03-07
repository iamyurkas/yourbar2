declare module 'expo-camera' {
  import type { ComponentType } from 'react';

  export type CameraPermissionResponse = {
    granted: boolean;
    canAskAgain: boolean;
  };

  export function useCameraPermissions(): [
    CameraPermissionResponse | null,
    () => Promise<CameraPermissionResponse>,
  ];

  export const CameraView: ComponentType<{
    style?: unknown;
    onBarcodeScanned?: (event: { data?: string }) => void;
    barcodeScannerSettings?: {
      barcodeTypes?: string[];
    };
  }>;
}
