import * as FileSystem from 'expo-file-system/legacy';

const STORAGE_FILENAME = 'onboarding-state.json';

type OnboardingStorageState = {
  hasSeenOnboarding: boolean;
};

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

  return joinDirectoryPath(FileSystem.cacheDirectory, STORAGE_FILENAME);
}

export async function loadOnboardingState(): Promise<OnboardingStorageState | null> {
  const storagePath = resolveStoragePath();
  if (!storagePath) {
    return null;
  }

  try {
    const info = await FileSystem.getInfoAsync(storagePath);
    if (!info.exists) {
      return null;
    }

    const contents = await FileSystem.readAsStringAsync(storagePath);
    if (!contents) {
      return null;
    }

    return JSON.parse(contents) as OnboardingStorageState;
  } catch (error) {
    console.warn('Unable to load onboarding state', error);
    return null;
  }
}

export async function persistOnboardingState(state: OnboardingStorageState): Promise<void> {
  const storagePath = resolveStoragePath();
  if (!storagePath) {
    return;
  }

  try {
    await FileSystem.writeAsStringAsync(storagePath, JSON.stringify(state));
  } catch (error) {
    console.warn('Unable to persist onboarding state', error);
  }
}

