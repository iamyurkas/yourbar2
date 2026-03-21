import * as FileSystem from 'expo-file-system/legacy';

import type {
  CocktailTagDeltaSnapshot,
  InventorySnapshot,
  InventoryStorageAdapter,
} from '@/libs/storage/types';

const STORAGE_FILENAME = 'inventory-state.json';
const COCKTAIL_TAG_DELTA_FILENAME = 'inventory-cocktail-tag-delta.json';

function joinDirectoryPath(directory: string | null | undefined, filename: string): string | undefined {
  if (!directory) {
    return undefined;
  }

  return `${directory.replace(/\/?$/, '/')}${filename}`;
}

function resolveStoragePath(filename: string): string | undefined {
  const documentPath = joinDirectoryPath(FileSystem.documentDirectory, filename);
  if (documentPath) {
    return documentPath;
  }

  const cachePath = joinDirectoryPath(FileSystem.cacheDirectory, filename);
  return cachePath;
}

export function resolveInventorySnapshotPath(): string | undefined {
  return resolveStoragePath(STORAGE_FILENAME);
}

export function resolveCocktailTagDeltaPath(): string | undefined {
  return resolveStoragePath(COCKTAIL_TAG_DELTA_FILENAME);
}

async function readJsonFile<T>(path: string | undefined, fallback: T): Promise<T> {
  if (!path) {
    return fallback;
  }

  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      return fallback;
    }

    const contents = await FileSystem.readAsStringAsync(path);
    if (!contents) {
      return fallback;
    }

    return JSON.parse(contents) as T;
  } catch (error) {
    console.warn('Unable to read storage json file', path, error);
    return fallback;
  }
}

async function writeJsonFile(path: string | undefined, value: unknown): Promise<void> {
  if (!path) {
    return;
  }

  await FileSystem.writeAsStringAsync(path, JSON.stringify(value));
}

export const fileStorageAdapter: InventoryStorageAdapter = {
  async loadInventoryState<TCocktail, TIngredient>(): Promise<InventorySnapshot<TCocktail, TIngredient> | undefined> {
    return readJsonFile<InventorySnapshot<TCocktail, TIngredient> | undefined>(resolveInventorySnapshotPath(), undefined);
  },
  async saveInventoryState<TCocktail, TIngredient>(snapshot: InventorySnapshot<TCocktail, TIngredient>): Promise<void> {
    await writeJsonFile(resolveInventorySnapshotPath(), snapshot);
  },
  async loadCocktailTagDelta(): Promise<CocktailTagDeltaSnapshot> {
    return readJsonFile<CocktailTagDeltaSnapshot>(resolveCocktailTagDeltaPath(), {});
  },
  async saveCocktailTagDelta(snapshot: CocktailTagDeltaSnapshot): Promise<void> {
    await writeJsonFile(resolveCocktailTagDeltaPath(), snapshot);
  },
  async syncBundledCatalogIfNeeded(): Promise<void> {
    return;
  },
};
