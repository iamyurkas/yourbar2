import * as FileSystem from 'expo-file-system/legacy';

import {
  hasCompletedSQLiteMigration,
  isSQLiteInventoryEmpty,
  loadCocktailTagDeltaSnapshotFromSQLite,
  loadInventorySnapshotFromSQLite,
  markSQLiteMigrationComplete,
  migrateLegacySnapshotToSQLite,
  persistCocktailTagDeltaSnapshotToSQLite,
  persistInventorySnapshotToSQLite,
} from '@/libs/storage/sqlite/inventory-sqlite';
import type { InventoryStorageAdapter } from '@/libs/storage/inventory-storage-adapter';
import type { Bar } from '@/providers/inventory-types';

const STORAGE_FILENAME = 'inventory-state.json';
const COCKTAIL_TAG_DELTA_FILENAME = 'inventory-cocktail-tag-delta.json';
let hasLoggedDocumentDirectoryWarning = false;
let hasLoggedCacheDirectoryWarning = false;
let hasLoggedFileBackend = false;

export type InventorySnapshotV1<TCocktail, TIngredient> = {
  version: 1;
  cocktails: TCocktail[];
  ingredients: TIngredient[];
  imported?: boolean;
  availableIngredientIds?: number[];
  shoppingIngredientIds?: number[];
  cocktailRatings?: Record<string, number>;
  cocktailComments?: Record<string, string>;
  partySelectedCocktailKeys?: string[];
  ignoreGarnish?: boolean;
  allowAllSubstitutes?: boolean;
  useImperialUnits?: boolean;
  keepScreenAwake?: boolean;
  shakerSmartFilteringEnabled?: boolean;
  showTabCounters?: boolean;
  ratingFilterThreshold?: number;
  startScreen?: string;
  appTheme?: string;
  appLocale?: string;
  amazonStoreOverride?: string | null;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
  onboardingStarterApplied?: boolean;
};

export type InventoryDeltaSnapshot<TCocktail, TIngredient> = {
  version: 2;
  delta: {
    cocktails?: {
      created?: TCocktail[];
      updated?: TCocktail[];
      deletedIds?: number[];
    };
    ingredients?: {
      created?: TIngredient[];
      updated?: TIngredient[];
      deletedIds?: number[];
    };
  };
  imported?: boolean;
  customCocktailTags?: Array<{ id: number; name: string; color: string }>;
  customIngredientTags?: Array<{ id: number; name: string; color: string }>;
  availableIngredientIds?: number[];
  shoppingIngredientIds?: number[];
  cocktailRatings?: Record<string, number>;
  cocktailComments?: Record<string, string>;
  partySelectedCocktailKeys?: string[];
  ignoreGarnish?: boolean;
  allowAllSubstitutes?: boolean;
  useImperialUnits?: boolean;
  keepScreenAwake?: boolean;
  shakerSmartFilteringEnabled?: boolean;
  showTabCounters?: boolean;
  ratingFilterThreshold?: number;
  startScreen?: string;
  appTheme?: string;
  appLocale?: string;
  amazonStoreOverride?: string | null;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
  onboardingStarterApplied?: boolean;
};


export type InventoryDeltaSnapshotV3<TCocktail, TIngredient> = {
  version: 3;
  delta: {
    cocktails?: {
      created?: TCocktail[];
      updated?: TCocktail[];
      deletedIds?: number[];
    };
    ingredients?: {
      created?: TIngredient[];
      updated?: TIngredient[];
      deletedIds?: number[];
    };
  };
  imported?: boolean;
  customCocktailTags?: Array<{ id: number; name: string; color: string }>;
  customIngredientTags?: Array<{ id: number; name: string; color: string }>;
  availableIngredientIds?: number[];
  shoppingIngredientIds?: number[];
  cocktailRatings?: Record<string, number>;
  cocktailComments?: Record<string, string>;
  partySelectedCocktailKeys?: string[];
  ignoreGarnish?: boolean;
  allowAllSubstitutes?: boolean;
  useImperialUnits?: boolean;
  keepScreenAwake?: boolean;
  shakerSmartFilteringEnabled?: boolean;
  showTabCounters?: boolean;
  ratingFilterThreshold?: number;
  startScreen?: string;
  appTheme?: string;
  appLocale?: string;
  amazonStoreOverride?: string | null;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
  onboardingStarterApplied?: boolean;
  translationOverrides?: unknown;
  bars?: Bar[];
  activeBarId?: string;
};

export type InventorySnapshot<TCocktail, TIngredient> =
  | InventorySnapshotV1<TCocktail, TIngredient>
  | InventoryDeltaSnapshot<TCocktail, TIngredient>
  | InventoryDeltaSnapshotV3<TCocktail, TIngredient>;

export type CocktailTagDeltaSnapshot = Record<
  string,
  Array<{ id: number; name?: string; color?: string }> | null
>;

function isSQLiteStorageEnabled(): boolean {
  return (process.env.EXPO_PUBLIC_USE_SQLITE_STORAGE ?? '').trim().toLowerCase() === 'true';
}

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
    console.warn('Unable to access document directory for inventory snapshot', error);
    hasLoggedDocumentDirectoryWarning = true;
  }

  if (!FileSystem.documentDirectory && !hasLoggedDocumentDirectoryWarning) {
    console.warn('Unable to access document directory for inventory snapshot');
    hasLoggedDocumentDirectoryWarning = true;
  }

  try {
    const cachePath = joinDirectoryPath(FileSystem.cacheDirectory, STORAGE_FILENAME);
    if (cachePath) {
      return cachePath;
    }
  } catch (error) {
    console.warn('Unable to access cache directory for inventory snapshot', error);
    hasLoggedCacheDirectoryWarning = true;
  }

  if (!FileSystem.cacheDirectory && !hasLoggedCacheDirectoryWarning) {
    console.warn('Unable to access cache directory for inventory snapshot');
    hasLoggedCacheDirectoryWarning = true;
  }

  return undefined;
}

function resolveCocktailTagDeltaStoragePath(): string | undefined {
  try {
    const documentPath = joinDirectoryPath(FileSystem.documentDirectory, COCKTAIL_TAG_DELTA_FILENAME);
    if (documentPath) {
      return documentPath;
    }
  } catch (error) {
    console.warn('Unable to access document directory for cocktail tag delta snapshot', error);
  }

  try {
    const cachePath = joinDirectoryPath(FileSystem.cacheDirectory, COCKTAIL_TAG_DELTA_FILENAME);
    if (cachePath) {
      return cachePath;
    }
  } catch (error) {
    console.warn('Unable to access cache directory for cocktail tag delta snapshot', error);
  }

  return undefined;
}

async function loadInventorySnapshotFromFile<TCocktail, TIngredient>(): Promise<
  InventorySnapshot<TCocktail, TIngredient> | undefined
> {
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

    return JSON.parse(contents) as InventorySnapshot<TCocktail, TIngredient>;
  } catch (error) {
    console.warn('Unable to load inventory snapshot', error);
    return undefined;
  }
}

async function persistInventorySnapshotToFile<TCocktail, TIngredient>(
  snapshot: InventorySnapshot<TCocktail, TIngredient>,
): Promise<void> {
  const storagePath = resolveStoragePath();

  if (!storagePath) {
    return;
  }

  await FileSystem.writeAsStringAsync(storagePath, JSON.stringify(snapshot));
}

async function loadCocktailTagDeltaSnapshotFromFile(): Promise<CocktailTagDeltaSnapshot> {
  const storagePath = resolveCocktailTagDeltaStoragePath();
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
}

async function persistCocktailTagDeltaSnapshotToFile(
  snapshot: CocktailTagDeltaSnapshot,
): Promise<void> {
  const storagePath = resolveCocktailTagDeltaStoragePath();
  if (!storagePath) {
    return;
  }

  await FileSystem.writeAsStringAsync(storagePath, JSON.stringify(snapshot));
}

function createFileStorageAdapter<TCocktail, TIngredient>(): InventoryStorageAdapter<TCocktail, TIngredient> {
  if (!hasLoggedFileBackend) {
    console.info('[inventory-storage] using file backend');
    hasLoggedFileBackend = true;
  }

  return {
    loadAppState: () => loadInventorySnapshotFromFile<TCocktail, TIngredient>(),
    saveAppState: (snapshot) => persistInventorySnapshotToFile(snapshot),
    loadCatalogOverlayState: () => loadCocktailTagDeltaSnapshotFromFile(),
    saveCatalogOverlayState: (snapshot) => persistCocktailTagDeltaSnapshotToFile(snapshot),
  };
}

async function maybeMigrateFileSnapshotToSQLite<TCocktail, TIngredient>(): Promise<void> {
  const alreadyMigrated = await hasCompletedSQLiteMigration();
  if (alreadyMigrated) {
    return;
  }

  const sqliteEmpty = await isSQLiteInventoryEmpty();
  if (!sqliteEmpty) {
    await markSQLiteMigrationComplete();
    return;
  }

  const legacySnapshot = await loadInventorySnapshotFromFile<TCocktail, TIngredient>();
  if (legacySnapshot) {
    await migrateLegacySnapshotToSQLite(legacySnapshot);
    return;
  }

  await markSQLiteMigrationComplete();
}

async function createSQLiteStorageAdapter<TCocktail, TIngredient>(): Promise<
  InventoryStorageAdapter<TCocktail, TIngredient>
> {
  await maybeMigrateFileSnapshotToSQLite<TCocktail, TIngredient>();

  return {
    loadAppState: () => loadInventorySnapshotFromSQLite<TCocktail, TIngredient>(),
    saveAppState: (snapshot) => persistInventorySnapshotToSQLite(snapshot),
    loadCatalogOverlayState: () => loadCocktailTagDeltaSnapshotFromSQLite(),
    saveCatalogOverlayState: (snapshot) => persistCocktailTagDeltaSnapshotToSQLite(snapshot),
  };
}

async function getStorageAdapter<TCocktail, TIngredient>(): Promise<
  InventoryStorageAdapter<TCocktail, TIngredient>
> {
  if (isSQLiteStorageEnabled()) {
    return createSQLiteStorageAdapter<TCocktail, TIngredient>();
  }

  return createFileStorageAdapter<TCocktail, TIngredient>();
}

export async function loadInventorySnapshot<TCocktail, TIngredient>(): Promise<
  InventorySnapshot<TCocktail, TIngredient> | undefined
> {
  try {
    const adapter = await getStorageAdapter<TCocktail, TIngredient>();
    return adapter.loadAppState();
  } catch (error) {
    console.warn('Unable to load inventory snapshot', error);
    return undefined;
  }
}

export async function persistInventorySnapshot<TCocktail, TIngredient>(
  snapshot: InventorySnapshot<TCocktail, TIngredient>,
): Promise<void> {
  try {
    const adapter = await getStorageAdapter<TCocktail, TIngredient>();
    await adapter.saveAppState(snapshot);
  } catch (error) {
    console.error('Unable to persist inventory snapshot', error);
    throw error;
  }
}

export async function loadCocktailTagDeltaSnapshot(): Promise<CocktailTagDeltaSnapshot> {
  try {
    const adapter = await getStorageAdapter<unknown, unknown>();
    return adapter.loadCatalogOverlayState();
  } catch (error) {
    console.warn('Unable to load cocktail tag delta snapshot', error);
    return {};
  }
}

export async function persistCocktailTagDeltaSnapshot(
  snapshot: CocktailTagDeltaSnapshot,
): Promise<void> {
  try {
    const adapter = await getStorageAdapter<unknown, unknown>();
    await adapter.saveCatalogOverlayState(snapshot);
  } catch (error) {
    console.error('Unable to persist cocktail tag delta snapshot', error);
    throw error;
  }
}
