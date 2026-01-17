import * as FileSystem from 'expo-file-system/legacy';

const STORAGE_FILENAME = 'onboarding-state.json';
let hasLoggedDocumentDirectoryWarning = false;
let hasLoggedCacheDirectoryWarning = false;

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
    if (!hasLoggedDocumentDirectoryWarning) {
      console.warn('Unable to access document directory for onboarding flag', error);
      hasLoggedDocumentDirectoryWarning = true;
    }
  }

  if (!FileSystem.documentDirectory && !hasLoggedDocumentDirectoryWarning) {
    console.warn('Unable to access document directory for onboarding flag');
    hasLoggedDocumentDirectoryWarning = true;
  }

  try {
    const cachePath = joinDirectoryPath(FileSystem.cacheDirectory, STORAGE_FILENAME);
    if (cachePath) {
      return cachePath;
    }
  } catch (error) {
    if (!hasLoggedCacheDirectoryWarning) {
      console.warn('Unable to access cache directory for onboarding flag', error);
      hasLoggedCacheDirectoryWarning = true;
    }
  }

  if (!FileSystem.cacheDirectory && !hasLoggedCacheDirectoryWarning) {
    console.warn('Unable to access cache directory for onboarding flag');
    hasLoggedCacheDirectoryWarning = true;
  }

  return undefined;
}

export async function loadHasSeenOnboarding(): Promise<boolean> {
  const storagePath = resolveStoragePath();

  if (!storagePath) {
    return false;
  }

  try {
    const info = await FileSystem.getInfoAsync(storagePath);
    if (!info.exists) {
      return false;
    }

    const contents = await FileSystem.readAsStringAsync(storagePath);
    if (!contents) {
      return false;
    }

    const parsed = JSON.parse(contents) as { hasSeenOnboarding?: boolean };
    return Boolean(parsed?.hasSeenOnboarding);
  } catch (error) {
    console.warn('Unable to load onboarding flag', error);
    return false;
  }
}

export async function persistHasSeenOnboarding(value: boolean): Promise<void> {
  const storagePath = resolveStoragePath();

  if (!storagePath) {
    return;
  }

  try {
    await FileSystem.writeAsStringAsync(storagePath, JSON.stringify({ hasSeenOnboarding: value }));
  } catch (error) {
    console.warn('Unable to persist onboarding flag', error);
  }
}
