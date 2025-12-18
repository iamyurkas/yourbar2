import { type ImageSource } from 'expo-image';

import { resolveAssetFromCatalog } from '@/assets/image-manifest';

const SUPPORTED_URI_PATTERN = /^(https?:|file:|data:|content:)/i;

export function resolveImageSource(uri?: string | null): ImageSource | undefined {
  if (!uri) {
    return undefined;
  }

  const asset = resolveAssetFromCatalog(uri);
  if (asset) {
    return asset;
  }

  if (SUPPORTED_URI_PATTERN.test(uri)) {
    return { uri };
  }

  return undefined;
}
