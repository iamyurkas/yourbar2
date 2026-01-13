import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

export type ImageCategory = 'cocktails' | 'ingredients';

const LOCAL_URI_PATTERN = /^(file:|content:)/i;
const JPG_EXTENSION_PATTERN = /\.jpe?g$/i;

const normalizeUriPath = (uri: string) => uri.split(/[?#]/)[0];

export const isJpgFileName = (fileName?: string | null) =>
  Boolean(fileName && JPG_EXTENSION_PATTERN.test(fileName));

export const isJpgUri = (uri?: string | null) =>
  Boolean(uri && JPG_EXTENSION_PATTERN.test(normalizeUriPath(uri)));

export const isJpgMimeType = (mimeType?: string | null) =>
  Boolean(mimeType && /image\/jpe?g/i.test(mimeType));

export const isJpgAsset = (asset?: {
  uri?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
}) => {
  if (!asset) {
    return false;
  }

  return (
    isJpgMimeType(asset.mimeType) || isJpgFileName(asset.fileName) || isJpgUri(asset.uri)
  );
};

export async function ensureJpgImageUri(asset?: {
  uri?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
}): Promise<string | undefined> {
  if (!asset?.uri) {
    return undefined;
  }

  if (isJpgAsset(asset)) {
    return asset.uri;
  }

  if (!LOCAL_URI_PATTERN.test(asset.uri)) {
    return asset.uri;
  }

  const result = await ImageManipulator.manipulateAsync(asset.uri, [], {
    compress: 1,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return result.uri;
}

const toSlug = (value: string) => {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'image';
};

export const buildImageFileName = (id: number, name: string) =>
  `${id}-${toSlug(name)}.jpg`;

export async function persistLocalImage({
  sourceUri,
  category,
  id,
  name,
}: {
  sourceUri?: string | null;
  category: ImageCategory;
  id: number;
  name: string;
}): Promise<string | undefined> {
  if (!sourceUri) {
    return undefined;
  }

  const normalizedSourceUri =
    !isJpgUri(sourceUri) && LOCAL_URI_PATTERN.test(sourceUri)
      ? await ensureJpgImageUri({ uri: sourceUri })
      : sourceUri;

  if (!normalizedSourceUri || !LOCAL_URI_PATTERN.test(normalizedSourceUri)) {
    return normalizedSourceUri;
  }

  if (!FileSystem.documentDirectory) {
    return normalizedSourceUri;
  }

  const directory = `${FileSystem.documentDirectory}images/${category}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  const targetUri = `${directory}${buildImageFileName(id, name)}`;
  if (normalizedSourceUri === targetUri) {
    return targetUri;
  }

  if (normalizedSourceUri.startsWith(directory)) {
    await FileSystem.deleteAsync(targetUri, { idempotent: true });
    await FileSystem.moveAsync({ from: normalizedSourceUri, to: targetUri });
    return targetUri;
  }

  await FileSystem.deleteAsync(targetUri, { idempotent: true });
  await FileSystem.copyAsync({ from: normalizedSourceUri, to: targetUri });
  return targetUri;
}
