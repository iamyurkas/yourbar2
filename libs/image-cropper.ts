import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';

type CropRequest = {
  uri: string;
  width?: number;
  height?: number;
};

type CropResultResolver = (uri: string | null) => void;

const pendingCropRequests = new Map<string, CropResultResolver>();

function createRequestId() {
  return `crop-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getImageSize(uri: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error),
    );
  });
}

export function resolveCropResult(requestId: string, uri: string | null) {
  const resolver = pendingCropRequests.get(requestId);
  if (!resolver) {
    return;
  }

  pendingCropRequests.delete(requestId);
  resolver(uri);
}

export async function openCropScreen(request: CropRequest) {
  const requestId = createRequestId();
  const size =
    typeof request.width === 'number' && typeof request.height === 'number'
      ? { width: request.width, height: request.height }
      : await getImageSize(request.uri);

  return new Promise<string | null>((resolve) => {
    pendingCropRequests.set(requestId, resolve);
    router.push({
      pathname: '/crop',
      params: {
        requestId,
        uri: request.uri,
        width: String(size.width),
        height: String(size.height),
      },
    });
  });
}

export async function pickImageWithCrop(options: { source: 'library' | 'camera'; quality?: number }) {
  const picker =
    options.source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
  const result = await picker({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: options.quality ?? 1,
    exif: false,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  if (!asset?.uri) {
    return null;
  }

  const width = typeof asset.width === 'number' ? asset.width : undefined;
  const height = typeof asset.height === 'number' ? asset.height : undefined;
  return openCropScreen({ uri: asset.uri, width, height });
}
