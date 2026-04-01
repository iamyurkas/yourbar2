import * as FileSystem from 'expo-file-system/legacy';

import type { Bar } from '@/providers/inventory-types';

const STORAGE_FILENAME = 'inventory-state.json';
const COCKTAIL_TAG_DELTA_FILENAME = 'inventory-cocktail-tag-delta.json';
let hasLoggedDocumentDirectoryWarning = false;
let hasLoggedCacheDirectoryWarning = false;

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
  cardViewEnabled?: boolean;
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
  cardViewEnabled?: boolean;
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
  cardViewEnabled?: boolean;
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

export async function loadInventorySnapshot<TCocktail, TIngredient>(): Promise<
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

export async function persistInventorySnapshot<TCocktail, TIngredient>(
  snapshot: InventorySnapshot<TCocktail, TIngredient>,
): Promise<void> {
  const storagePath = resolveStoragePath();

  if (!storagePath) {
    return;
  }

  try {
    await FileSystem.writeAsStringAsync(storagePath, JSON.stringify(snapshot));
  } catch (error) {
    console.error('Unable to persist inventory snapshot', error);
    throw error;
  }
}

export async function loadCocktailTagDeltaSnapshot(): Promise<CocktailTagDeltaSnapshot> {
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

export async function persistCocktailTagDeltaSnapshot(
  snapshot: CocktailTagDeltaSnapshot,
): Promise<void> {
  const storagePath = resolveCocktailTagDeltaStoragePath();
  if (!storagePath) {
    return;
  }

  try {
    await FileSystem.writeAsStringAsync(storagePath, JSON.stringify(snapshot));
  } catch (error) {
    console.error('Unable to persist cocktail tag delta snapshot', error);
    throw error;
  }
}
