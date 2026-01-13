import * as FileSystem from 'expo-file-system/legacy';

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

  if (!LOCAL_URI_PATTERN.test(sourceUri)) {
    return sourceUri;
  }

  if (!FileSystem.documentDirectory) {
    return sourceUri;
  }

  const directory = `${FileSystem.documentDirectory}images/${category}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  const targetUri = `${directory}${buildImageFileName(id, name)}`;
  if (sourceUri === targetUri) {
    return targetUri;
  }

  if (sourceUri.startsWith(directory)) {
    await FileSystem.deleteAsync(targetUri, { idempotent: true });
    await FileSystem.moveAsync({ from: sourceUri, to: targetUri });
    return targetUri;
  }

  await FileSystem.deleteAsync(targetUri, { idempotent: true });
  await FileSystem.copyAsync({ from: sourceUri, to: targetUri });
  return targetUri;
}
