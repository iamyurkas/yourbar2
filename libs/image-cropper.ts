import * as ImagePicker from 'expo-image-picker';

type RouterLike = {
  push: (href: { pathname: string; params?: Record<string, string> } | string) => void;
};

type CropRequestResolver = (result: string | null) => void;

const cropRequestResolvers = new Map<string, CropRequestResolver>();

const buildRequestId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const openCropScreen = (
  router: RouterLike,
  {
    uri,
    aspect = 1,
  }: {
    uri: string;
    aspect?: number;
  },
) =>
  new Promise<string | null>((resolve) => {
    const requestId = buildRequestId();
    cropRequestResolvers.set(requestId, resolve);
    router.push({
      pathname: '/crop',
      params: {
        requestId,
        uri,
        aspect: String(aspect),
      },
    });
  });

export const resolveCropRequest = (requestId: string, result: string | null) => {
  const resolver = cropRequestResolvers.get(requestId);
  if (!resolver) {
    return;
  }

  cropRequestResolvers.delete(requestId);
  resolver(result);
};

export const cancelCropRequest = (requestId: string) => {
  resolveCropRequest(requestId, null);
};

export const pickImageWithCrop = async (
  router: RouterLike,
  {
    aspect = 1,
    mediaTypes = ['images'],
  }: {
    aspect?: number;
    mediaTypes?: ImagePicker.MediaType[];
  } = {},
) => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes,
    allowsEditing: false,
    quality: 1,
    exif: false,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  if (!asset?.uri) {
    return null;
  }

  return openCropScreen(router, { uri: asset.uri, aspect });
};

export const pickCameraWithCrop = async (
  router: RouterLike,
  {
    aspect = 1,
    mediaTypes = ['images'],
  }: {
    aspect?: number;
    mediaTypes?: ImagePicker.MediaType[];
  } = {},
) => {
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes,
    allowsEditing: false,
    quality: 1,
    exif: false,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  if (!asset?.uri) {
    return null;
  }

  return openCropScreen(router, { uri: asset.uri, aspect });
};
