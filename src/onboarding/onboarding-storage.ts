import * as FileSystem from 'expo-file-system/legacy';

const STORAGE_FILENAME = 'onboarding-state.json';

function joinDirectoryPath(directory: string | null | undefined, filename: string): string | undefined {
  if (!directory) {
    return undefined;
  }

  return `${directory.replace(/\/?$/, '/')}${filename}`;
}

function resolveStoragePath(): string | undefined {
  const documentPath = joinDirectoryPath(FileSystem.documentDirectory, STORAGE_FILENAME);
  if (documentPath) {
    return documentPath;
  }

  const cachePath = joinDirectoryPath(FileSystem.cacheDirectory, STORAGE_FILENAME);
  if (cachePath) {
    return cachePath;
  }

  return undefined;
}

export async function loadOnboardingFlag(): Promise<boolean | undefined> {
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

    const parsed = JSON.parse(contents) as { hasSeenOnboarding?: boolean };
    return parsed.hasSeenOnboarding;
  } catch (error) {
    console.warn('Unable to load onboarding state', error);
    return undefined;
  }
}

export async function persistOnboardingFlag(hasSeenOnboarding: boolean): Promise<void> {
  const storagePath = resolveStoragePath();

  if (!storagePath) {
    return;
  }

  try {
    await FileSystem.writeAsStringAsync(storagePath, JSON.stringify({ hasSeenOnboarding }));
  } catch (error) {
    console.warn('Unable to persist onboarding state', error);
  }
}
