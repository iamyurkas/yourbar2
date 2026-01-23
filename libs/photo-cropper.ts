import * as ImagePicker from 'expo-image-picker';
import type { Router } from 'expo-router';

import { openCropScreen } from '@/libs/image-cropper';

type PickImageOptions = {
  router: Router;
  aspect?: number;
};

export const pickImageWithCrop = async ({ router, aspect = 1 }: PickImageOptions) => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
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

  return openCropScreen({ router, uri: asset.uri, aspect });
};
