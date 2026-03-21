import * as FileSystem from 'expo-file-system/legacy';

import type {
  CocktailTagDeltaSnapshot,
  InventorySnapshot,
  InventoryStorageAdapter,
} from '@/libs/storage/types';

const STORAGE_FILENAME = 'inventory-state.json';
const COCKTAIL_TAG_DELTA_FILENAME = 'inventory-cocktail-tag-delta.json';
let hasLoggedDocumentDirectoryWarning = false;
let hasLoggedCacheDirectoryWarning = false;

function joinDirectoryPath(directory: string | null | undefined, filename: string): string | undefined {
  if (!directory) {
    return undefined;
  }

  return `${directory.replace(/\/?$/, '/')}${filename}`;
}

function resolvePath(filename: string): string | undefined {
  try {
    const documentPath = joinDirectoryPath(FileSystem.documentDirectory, filename);
    if (documentPath) {
      return documentPath;
    }
  } catch (error) {
    if (!hasLoggedDocumentDirectoryWarning) {
      console.warn(`Unable to access document directory for ${filename}`, error);
      hasLoggedDocumentDirectoryWarning = true;
    }
  }

  try {
    const cachePath = joinDirectoryPath(FileSystem.cacheDirectory, filename);
    if (cachePath) {
      return cachePath;
    }
  } catch (error) {
    if (!hasLoggedCacheDirectoryWarning) {
      console.warn(`Unable to access cache directory for ${filename}`, error);
      hasLoggedCacheDirectoryWarning = true;
    }
  }

  return undefined;
}

export function resolveInventorySnapshotFilePath(): string | undefined {
  return resolvePath(STORAGE_FILENAME);
}

export function resolveCocktailTagDeltaFilePath(): string | undefined {
  return resolvePath(COCKTAIL_TAG_DELTA_FILENAME);
}

export async function readRawFileSnapshot(): Promise<string | undefined> {
  const storagePath = resolveInventorySnapshotFilePath();
  if (!storagePath) {
    return undefined;
  }

  const info = await FileSystem.getInfoAsync(storagePath);
  if (!info.exists) {
    return undefined;
  }

  return FileSystem.readAsStringAsync(storagePath);
}

export async function readRawCocktailTagDeltaSnapshot(): Promise<string | undefined> {
  const storagePath = resolveCocktailTagDeltaFilePath();
  if (!storagePath) {
    return undefined;
  }

  const info = await FileSystem.getInfoAsync(storagePath);
  if (!info.exists) {
    return undefined;
  }

  return FileSystem.readAsStringAsync(storagePath);
}

export const fileStorageAdapter: InventoryStorageAdapter = {
  async loadInventorySnapshot<TCocktail, TIngredient>() {
    const storagePath = resolveInventorySnapshotFilePath();
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

      return JSON.parse(contents) as InventorySnapshot<TCocktail, TIngredient>;
    } catch (error) {
      console.warn('Unable to load inventory snapshot', error);
      return undefined;
    }
  },

  async persistInventorySnapshot<TCocktail, TIngredient>(snapshot: InventorySnapshot<TCocktail, TIngredient>) {
    const storagePath = resolveInventorySnapshotFilePath();
    if (!storagePath) {
      return;
    }

    try {
      await FileSystem.writeAsStringAsync(storagePath, JSON.stringify(snapshot));
    } catch (error) {
      console.error('Unable to persist inventory snapshot', error);
      throw error;
    }
  },

  async loadCocktailTagDeltaSnapshot() {
    const storagePath = resolveCocktailTagDeltaFilePath();
    if (!storagePath) {
      return {};
    }

    try {
      const info = await FileSystem.getInfoAsync(storagePath);
      if (!info.exists) {
        return {};
      }

      const contents = await FileSystem.readAsStringAsync(storagePath);
      if (!contents) {
        return {};
      }

      const parsed = JSON.parse(contents) as CocktailTagDeltaSnapshot;
      if (!parsed || typeof parsed !== 'object') {
        return {};
      }

      return parsed;
    } catch (error) {
      console.warn('Unable to load cocktail tag delta snapshot', error);
      return {};
    }
  },

  async persistCocktailTagDeltaSnapshot(snapshot: CocktailTagDeltaSnapshot) {
    const storagePath = resolveCocktailTagDeltaFilePath();
    if (!storagePath) {
      return;
    }

    try {
      await FileSystem.writeAsStringAsync(storagePath, JSON.stringify(snapshot));
    } catch (error) {
      console.error('Unable to persist cocktail tag delta snapshot', error);
      throw error;
    }
  },

  async syncBundledCatalogIfNeeded() {
    return;
  },
};
