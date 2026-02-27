import { loadInventoryData, type InventoryData } from '@/libs/inventory-data';
import { type InventoryDeltaSnapshot, type InventoryDeltaSnapshotV3 } from '@/libs/inventory-storage';
import type { AmazonStoreOverride } from '@/libs/amazon-stores';
import {
  areStorageRecordsEqual,
  toCocktailStorageRecord,
  toIngredientStorageRecord,
} from '@/libs/inventory-utils';
import type {
  AppLocale,
  AppTheme,
  CocktailStorageRecord,
  CocktailTag,
  IngredientStorageRecord,
  IngredientTag,
  InventoryTranslationOverrides,
  StartScreen,
} from '@/providers/inventory-types';
import type { InventoryState } from '@/providers/inventory/model/inventory-state';

export type InventoryBaseMaps = {
  baseData: InventoryData;
  baseCocktails: Map<number, CocktailStorageRecord>;
  baseIngredients: Map<number, IngredientStorageRecord>;
};

export type InventoryDeltaBase = Pick<
  InventoryDeltaSnapshotV3<CocktailStorageRecord, IngredientStorageRecord>,
  'version' | 'delta' | 'imported'
>;

export const INVENTORY_SNAPSHOT_VERSION = 3;

export function createInventoryBaseMaps(data?: InventoryData): InventoryBaseMaps {
  const baseData = data ?? loadInventoryData();
  const baseCocktails = new Map<number, CocktailStorageRecord>();
  const baseIngredients = new Map<number, IngredientStorageRecord>();

  baseData.cocktails.forEach((cocktail) => {
    const normalized = toCocktailStorageRecord(cocktail);
    const id = Number(normalized.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return;
    }
    baseCocktails.set(Math.trunc(id), normalized);
  });

  baseData.ingredients.forEach((ingredient) => {
    const normalized = toIngredientStorageRecord(ingredient);
    const id = Number(normalized.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return;
    }
    baseIngredients.set(Math.trunc(id), normalized);
  });

  return { baseData, baseCocktails, baseIngredients };
}

export function buildInventoryDelta(
  state: InventoryState,
  baseMaps: InventoryBaseMaps,
): InventoryDeltaBase {
  const createdCocktails: CocktailStorageRecord[] = [];
  const updatedCocktails: CocktailStorageRecord[] = [];
  const currentCocktailIds = new Set<number>();

  state.cocktails.forEach((cocktail) => {
    const normalized = toCocktailStorageRecord(cocktail);
    const id = Number(normalized.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return;
    }

    const normalizedId = Math.trunc(id);
    currentCocktailIds.add(normalizedId);

    const baseRecord = baseMaps.baseCocktails.get(normalizedId);
    if (!baseRecord) {
      createdCocktails.push(normalized);
      return;
    }

    if (!areStorageRecordsEqual(normalized, baseRecord)) {
      updatedCocktails.push(normalized);
    }
  });

  const deletedCocktailIds = Array.from(baseMaps.baseCocktails.keys()).filter(
    (id) => !currentCocktailIds.has(id),
  );

  const createdIngredients: IngredientStorageRecord[] = [];
  const updatedIngredients: IngredientStorageRecord[] = [];
  const currentIngredientIds = new Set<number>();

  state.ingredients.forEach((ingredient) => {
    const normalized = toIngredientStorageRecord(ingredient);
    const id = Number(normalized.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return;
    }

    const normalizedId = Math.trunc(id);
    currentIngredientIds.add(normalizedId);

    const baseRecord = baseMaps.baseIngredients.get(normalizedId);
    if (!baseRecord) {
      createdIngredients.push(normalized);
      return;
    }

    if (!areStorageRecordsEqual(normalized, baseRecord)) {
      updatedIngredients.push(normalized);
    }
  });

  const deletedIngredientIds = Array.from(baseMaps.baseIngredients.keys()).filter(
    (id) => !currentIngredientIds.has(id),
  );

  return {
    version: INVENTORY_SNAPSHOT_VERSION,
    delta: {
      cocktails:
        createdCocktails.length > 0 || updatedCocktails.length > 0 || deletedCocktailIds.length > 0
          ? {
              created: createdCocktails.length > 0 ? createdCocktails : undefined,
              updated: updatedCocktails.length > 0 ? updatedCocktails : undefined,
              deletedIds: deletedCocktailIds.length > 0 ? deletedCocktailIds : undefined,
            }
          : undefined,
      ingredients:
        createdIngredients.length > 0 || updatedIngredients.length > 0 || deletedIngredientIds.length > 0
          ? {
              created: createdIngredients.length > 0 ? createdIngredients : undefined,
              updated: updatedIngredients.length > 0 ? updatedIngredients : undefined,
              deletedIds: deletedIngredientIds.length > 0 ? deletedIngredientIds : undefined,
            }
          : undefined,
    },
    imported: state.imported,
  } satisfies InventoryDeltaBase;
}

export type InventorySnapshotOptions = {
  availableIngredientIds: Set<number>;
  shoppingIngredientIds: Set<number>;
  ratingsByCocktailId: Record<string, number>;
  ignoreGarnish: boolean;
  allowAllSubstitutes: boolean;
  useImperialUnits: boolean;
  keepScreenAwake: boolean;
  shakerSmartFilteringEnabled: boolean;
  ratingFilterThreshold: number;
  startScreen: StartScreen;
  appTheme: AppTheme;
  appLocale: AppLocale;
  amazonStoreOverride: AmazonStoreOverride | null;
  customCocktailTags: CocktailTag[];
  customIngredientTags: IngredientTag[];
  onboardingStep: number;
  onboardingCompleted: boolean;
  translationOverrides: InventoryTranslationOverrides;
};

export function toSortedArray(values: Iterable<number>): number[] {
  const sanitized = Array.from(values)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.trunc(value));

  return Array.from(new Set(sanitized)).sort((a, b) => a - b);
}

export function sanitizeCocktailRatings(
  ratings?: Record<string, number> | null | undefined,
): Record<string, number> {
  if (!ratings) {
    return {};
  }

  const sanitized: Record<string, number> = {};

  Object.entries(ratings).forEach(([key, value]) => {
    if (!key) {
      return;
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return;
    }

    sanitized[key] = Math.min(5, Math.max(1, Math.round(numeric)));
  });

  return sanitized;
}

export function buildInventorySnapshot(
  base: InventoryDeltaBase,
  options: InventorySnapshotOptions,
): InventoryDeltaSnapshotV3<CocktailStorageRecord, IngredientStorageRecord> {
  const sanitizedRatings = sanitizeCocktailRatings(options.ratingsByCocktailId);

  return {
    ...base,
    customCocktailTags: options.customCocktailTags,
    customIngredientTags: options.customIngredientTags,
    availableIngredientIds:
      options.availableIngredientIds.size > 0 ? toSortedArray(options.availableIngredientIds) : undefined,
    shoppingIngredientIds:
      options.shoppingIngredientIds.size > 0 ? toSortedArray(options.shoppingIngredientIds) : undefined,
    cocktailRatings: Object.keys(sanitizedRatings).length > 0 ? sanitizedRatings : undefined,
    ignoreGarnish: options.ignoreGarnish,
    allowAllSubstitutes: options.allowAllSubstitutes,
    useImperialUnits: options.useImperialUnits,
    keepScreenAwake: options.keepScreenAwake,
    shakerSmartFilteringEnabled: options.shakerSmartFilteringEnabled,
    ratingFilterThreshold: options.ratingFilterThreshold,
    startScreen: options.startScreen,
    appTheme: options.appTheme,
    appLocale: options.appLocale,
    amazonStoreOverride: options.amazonStoreOverride,
    onboardingStep: options.onboardingStep,
    onboardingCompleted: options.onboardingCompleted,
    translationOverrides: options.translationOverrides,
  } satisfies InventoryDeltaSnapshotV3<CocktailStorageRecord, IngredientStorageRecord>;
}
