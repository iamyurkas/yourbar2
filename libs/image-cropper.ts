import type { Router } from 'expo-router';

export type CropResult = {
  uri: string;
  width: number;
  height: number;
};

type CropRequest = {
  id: string;
  resolve: (result: CropResult | null) => void;
};

type CropRequestParams = {
  uri: string;
  aspect?: number;
  router: Router;
};

let activeRequest: CropRequest | null = null;

const createRequestId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const openCropScreen = ({ router, uri, aspect = 1 }: CropRequestParams) => {
  if (activeRequest) {
    activeRequest.resolve(null);
    activeRequest = null;
  }

  return new Promise<CropResult | null>((resolve) => {
    const id = createRequestId();
    activeRequest = { id, resolve };
    router.push({
      pathname: '/crop',
      params: {
        id,
        uri,
        aspect: aspect.toString(),
      },
    });
  });
};

export const resolveCropRequest = (id: string, result: CropResult) => {
  if (activeRequest?.id !== id) {
    return;
  }

  activeRequest.resolve(result);
  activeRequest = null;
};

export const cancelCropRequest = (id: string) => {
  if (activeRequest?.id !== id) {
    return;
  }

  activeRequest.resolve(null);
  activeRequest = null;
};
