import * as FileSystem from 'expo-file-system/legacy';

const STORAGE_FILENAME = 'inventory-state.json';
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
  ignoreGarnish?: boolean;
  allowAllSubstitutes?: boolean;
  useImperialUnits?: boolean;
  keepScreenAwake?: boolean;
  shakerSmartFilteringEnabled?: boolean;
  ratingFilterThreshold?: number;
  startScreen?: string;
  appTheme?: string;
  appLocale?: string;
  amazonStoreOverride?: string | null;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
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
  availableIngredientIds?: number[];
  shoppingIngredientIds?: number[];
  cocktailRatings?: Record<string, number>;
  ignoreGarnish?: boolean;
  allowAllSubstitutes?: boolean;
  useImperialUnits?: boolean;
  keepScreenAwake?: boolean;
  shakerSmartFilteringEnabled?: boolean;
  ratingFilterThreshold?: number;
  startScreen?: string;
  appTheme?: string;
  appLocale?: string;
  amazonStoreOverride?: string | null;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
};

export type InventorySnapshot<TCocktail, TIngredient> =
  | InventorySnapshotV1<TCocktail, TIngredient>
  | InventoryDeltaSnapshot<TCocktail, TIngredient>;

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

export async function clearInventorySnapshot(): Promise<void> {
  const storagePath = resolveStoragePath();

  if (!storagePath) {
    return;
  }

  try {
    const info = await FileSystem.getInfoAsync(storagePath);
    if (info.exists) {
      await FileSystem.deleteAsync(storagePath, { idempotent: true });
    }
  } catch (error) {
    console.warn('Unable to clear inventory snapshot', error);
  }
}
