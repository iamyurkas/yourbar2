import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform, Share } from 'react-native';

import { resolveAssetFromCatalog } from '@/assets/image-manifest';
import { zipBase64Files } from '@/libs/archive-utils';

const SUPPORTED_SCHEMES = /^(file:|content:|assets?\b|https?:)/i;

function sanitizeFileName(input: string, fallback: string): string {
  const name = input.split(/[\\/]/).filter(Boolean).pop() ?? fallback;
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function joinPath(directory: string | null | undefined, fileName: string): string {
  const normalizedDirectory = directory ?? '';
  return normalizedDirectory.endsWith('/') ? `${normalizedDirectory}${fileName}` : `${normalizedDirectory}/${fileName}`;
}

async function readBase64File(uri: string): Promise<string | undefined> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      return undefined;
    }
    return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  } catch (error) {
    console.warn('Failed to read file for export', uri, error);
    return undefined;
  }
}

async function resolveAssetFile(uri: string): Promise<string | undefined> {
  const assetId = resolveAssetFromCatalog(uri);
  if (!assetId) {
    return undefined;
  }
  try {
    const asset = Asset.fromModule(assetId);
    await asset.downloadAsync();
    return asset.localUri ?? asset.uri;
  } catch (error) {
    console.warn('Failed to resolve bundled asset', uri, error);
    return undefined;
  }
}

function buildArchivePath(uri: string, fallbackIndex: number): string {
  const normalized = uri.replace(/^file:\/\//i, '').replace(/^content:\/\//i, '');
  const assetRelativeMatch = normalized.match(/assets\/(.*)$/i);
  if (assetRelativeMatch?.[1]) {
    return assetRelativeMatch[1];
  }

  const cleaned = normalized.split('?')[0];
  const fileName = sanitizeFileName(cleaned, `photo-${fallbackIndex + 1}.jpg`);
  return `photos/${fileName}`;
}

async function saveWithPicker(
  fileName: string,
  mimeType: string,
  contents: string,
  encoding?: FileSystem.EncodingType,
): Promise<string> {
  if (Platform.OS === 'android' && FileSystem.StorageAccessFramework?.createFileAsync) {
    try {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted && permissions.directoryUri) {
        const safFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName,
          mimeType,
        );
        await FileSystem.writeAsStringAsync(safFileUri, contents, { encoding });
        return safFileUri;
      }
    } catch (error) {
      console.warn('Falling back to share after SAF failure', error);
    }
  }

  const targetPath = joinPath(FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '', fileName);
  await FileSystem.writeAsStringAsync(targetPath, contents, { encoding });
  return targetPath;
}

async function shareFile(fileUri: string, fileName: string) {
  let shareUri = fileUri;
  if (Platform.OS === 'android') {
    try {
      shareUri = await FileSystem.getContentUriAsync(fileUri);
    } catch (error) {
      console.warn('Failed to convert uri for sharing', fileUri, error);
    }
  }

  await Share.share({
    url: shareUri,
    message: fileName,
    title: fileName,
  });
}

export async function exportInventorySnapshot(snapshot: unknown): Promise<void> {
  const fileName = `yourbar-backup-${Date.now()}.json`;
  const serialized = JSON.stringify(snapshot, null, 2);
  const destination = await saveWithPicker(fileName, 'application/json', serialized);
  await shareFile(destination, fileName);
}

export async function exportInventoryPhotos(photoUris: (string | null | undefined)[]): Promise<void> {
  const normalizedUris = Array.from(new Set(photoUris.filter(Boolean) as string[]));
  if (normalizedUris.length === 0) {
    throw new Error('No photos to export');
  }

  const filesForArchive: { path: string; base64: string }[] = [];

  for (let i = 0; i < normalizedUris.length; i += 1) {
    const uri = normalizedUris[i];
    if (!SUPPORTED_SCHEMES.test(uri)) {
      continue;
    }

    const assetUri = (await resolveAssetFile(uri)) ?? uri;
    const base64 = await readBase64File(assetUri);
    if (!base64) {
      continue;
    }

    const archivePath = buildArchivePath(uri, i);
    filesForArchive.push({ path: archivePath, base64 });
  }

  if (filesForArchive.length === 0) {
    throw new Error('Unable to gather photos for export');
  }

  const zipBase64 = zipBase64Files(filesForArchive);
  const fileName = `yourbar-photos-${Date.now()}.zip`;
  const destination = await saveWithPicker(fileName, 'application/zip', zipBase64, FileSystem.EncodingType.Base64);
  await shareFile(destination, fileName);
}
