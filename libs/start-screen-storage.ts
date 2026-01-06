import * as FileSystem from 'expo-file-system/legacy';

import type { StartScreenKey } from './start-screen';

const STORAGE_FILENAME = 'start-screen-preference.json';
let hasLoggedDocumentDirectoryWarning = false;
let hasLoggedCacheDirectoryWarning = false;

type PersistedStartScreen = {
  key: StartScreenKey;
};

function joinDirectoryPath(directory: string | null | undefined, filename: string): string | undefined {
  if (!directory) {
    return undefined;
  }

  return `${directory.replace(/\/?$/, '/')}${filename}`;
}

function resolveStoragePath(): string | undefined {
  try {
    const documentPath = joinDirectoryPath(FileSystem.documentDirectory, STORAGE_FILENAME);
    if (documentPath) {
      return documentPath;
    }
  } catch (error) {
    console.warn('Unable to access document directory for start screen preference', error);
    hasLoggedDocumentDirectoryWarning = true;
  }

  if (!FileSystem.documentDirectory && !hasLoggedDocumentDirectoryWarning) {
    console.warn('Unable to access document directory for start screen preference');
    hasLoggedDocumentDirectoryWarning = true;
  }

  try {
    const cachePath = joinDirectoryPath(FileSystem.cacheDirectory, STORAGE_FILENAME);
    if (cachePath) {
      return cachePath;
    }
  } catch (error) {
    console.warn('Unable to access cache directory for start screen preference', error);
    hasLoggedCacheDirectoryWarning = true;
  }

  if (!FileSystem.cacheDirectory && !hasLoggedCacheDirectoryWarning) {
    console.warn('Unable to access cache directory for start screen preference');
    hasLoggedCacheDirectoryWarning = true;
  }

  return undefined;
}

export async function loadStartScreenPreference(): Promise<StartScreenKey | undefined> {
  const storagePath = resolveStoragePath();

  if (!storagePath) {
    return undefined;
  }

  try {
    const info = await FileSystem.getInfoAsync(storagePath);
    if (!info.exists) {
      return undefined;
    }

    const contents = await FileSystem.readAsStringAsync(storagePath);
    if (!contents) {
      return undefined;
    }

    const parsed = JSON.parse(contents) as PersistedStartScreen;
    if (parsed?.key) {
      return parsed.key;
    }
  } catch (error) {
    console.warn('Unable to load start screen preference', error);
  }

  return undefined;
}

export async function persistStartScreenPreference(key: StartScreenKey): Promise<void> {
  const storagePath = resolveStoragePath();

  if (!storagePath) {
    return;
  }

  try {
    await FileSystem.writeAsStringAsync(storagePath, JSON.stringify({ key } satisfies PersistedStartScreen));
  } catch (error) {
    console.warn('Unable to persist start screen preference', error);
  }
}
