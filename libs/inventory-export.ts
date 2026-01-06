import * as FileSystem from 'expo-file-system/legacy';

import type { InventorySnapshot } from '@/libs/inventory-storage';

const JSON_MIME_TYPE = 'application/json';
const DEFAULT_PHOTO_MIME = 'image/jpeg';
const SUPPORTED_SOURCE_PATTERN = /^(file:|content:)/i;

function formatTimestampForFilename(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function parseFileName(uri: string): { baseName: string; extension: string; mimeType: string } {
  const decodedUri = decodeURIComponent(uri);
  const sanitized = decodedUri.replace(/[#?].*$/, '');
  const match = sanitized.match(/([^/\\]+)$/);
  const fileName = match?.[1] ?? 'photo';
  const extensionMatch = fileName.match(/\.([A-Za-z0-9]+)$/);
  const extension = extensionMatch?.[1]?.toLowerCase() ?? 'jpg';
  const baseName = extensionMatch ? fileName.slice(0, -(extension.length + 1)) : fileName;

  const mimeType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : DEFAULT_PHOTO_MIME;

  return { baseName, extension, mimeType };
}

async function requestExportDirectory(): Promise<string> {
  const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

  if (!permissions.granted || !permissions.directoryUri) {
    throw new Error('Directory access was not granted');
  }

  return permissions.directoryUri;
}

async function createFileWithUniqueName(
  directoryUri: string,
  baseName: string,
  extension: string,
  mimeType: string,
): Promise<string> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < 5) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
    const candidateName = `${baseName}${suffix}`;
    try {
      const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(directoryUri, candidateName, mimeType);
      if (fileUri) {
        return fileUri;
      }
    } catch (error) {
      lastError = error;
    }
    attempt += 1;
  }

  throw lastError ?? new Error('Unable to create file');
}

export async function exportSnapshotWithPicker(snapshot: InventorySnapshot<unknown, unknown>): Promise<string> {
  const directoryUri = await requestExportDirectory();
  const timestamp = formatTimestampForFilename(new Date());
  const fileUri = await createFileWithUniqueName(directoryUri, `yourbar-inventory-${timestamp}`, 'json', JSON_MIME_TYPE);
  const contents = JSON.stringify(snapshot, null, 2);

  await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, contents, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return fileUri;
}

export async function exportPhotosWithPicker(photoUris: readonly string[]): Promise<{ saved: number; failed: number }> {
  const uniqueUris = Array.from(
    new Set(
      photoUris
        .map((uri) => uri?.trim())
        .filter((uri): uri is string => Boolean(uri) && SUPPORTED_SOURCE_PATTERN.test(uri)),
    ),
  );

  if (uniqueUris.length === 0) {
    return { saved: 0, failed: 0 };
  }

  const directoryUri = await requestExportDirectory();
  let saved = 0;
  let failed = 0;

  for (const uri of uniqueUris) {
    const { baseName, extension, mimeType } = parseFileName(uri);
    try {
      const fileUri = await createFileWithUniqueName(directoryUri, baseName, extension, mimeType);
      const contents = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      await FileSystem.writeAsStringAsync(fileUri, contents, { encoding: FileSystem.EncodingType.Base64 });
      saved += 1;
    } catch (error) {
      console.warn('Failed to export photo', uri, error);
      failed += 1;
    }
  }

  return { saved, failed };
}
