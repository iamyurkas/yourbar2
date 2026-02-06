import { loadInventoryData } from '@/libs/inventory-data';
import {
  toCocktailStorageRecord,
  toIngredientStorageRecord,
  areStorageRecordsEqual
} from '@/libs/inventory-utils';
import { type InventoryDeltaSnapshot } from '@/libs/inventory-storage';
import {
  type CocktailStorageRecord,
  type IngredientStorageRecord,
  type StartScreen,
  type AppTheme,
  type CocktailTag,
  type IngredientTag
} from '../inventory-types';
import { type InventoryState } from './snapshot-logic';
import { sanitizeCocktailRatings, toSortedArray } from '../model/sanitization';

const INVENTORY_SNAPSHOT_VERSION = 2;

export function createDeltaSnapshotFromInventory(
  state: InventoryState,
  options: {
    availableIngredientIds: Set<number>;
    shoppingIngredientIds: Set<number>;
    cocktailRatings: Record<string, number>;
    ignoreGarnish: boolean;
    allowAllSubstitutes: boolean;
    useImperialUnits: boolean;
    keepScreenAwake: boolean;
    ratingFilterThreshold: number;
    startScreen: StartScreen;
    appTheme: AppTheme;
    customCocktailTags: CocktailTag[];
    customIngredientTags: IngredientTag[];
    onboardingStep: number;
    onboardingCompleted: boolean;
  },
): InventoryDeltaSnapshot<CocktailStorageRecord, IngredientStorageRecord> {
  const baseData = loadInventoryData();
  const baseCocktails = new Map<number, CocktailStorageRecord>(
    baseData.cocktails
      .map((cocktail) => {
        const normalized = toCocktailStorageRecord(cocktail);
        const id = Number(normalized.id ?? -1);
        if (!Number.isFinite(id) || id < 0) {
          return undefined;
        }
        return [Math.trunc(id), normalized] as const;
      })
      .filter((entry): entry is readonly [number, CocktailStorageRecord] => Boolean(entry)),
  );
  const baseIngredients = new Map<number, IngredientStorageRecord>(
    baseData.ingredients
      .map((ingredient) => {
        const normalized = toIngredientStorageRecord(ingredient);
        const id = Number(normalized.id ?? -1);
        if (!Number.isFinite(id) || id < 0) {
          return undefined;
        }
        return [Math.trunc(id), normalized] as const;
      })
      .filter((entry): entry is readonly [number, IngredientStorageRecord] => Boolean(entry)),
  );

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

    const baseRecord = baseCocktails.get(normalizedId);
    if (!baseRecord) {
      createdCocktails.push(normalized);
      return;
    }

    if (!areStorageRecordsEqual(normalized, baseRecord)) {
      updatedCocktails.push(normalized);
    }
  });

  const deletedCocktailIds = Array.from(baseCocktails.keys()).filter((id) => !currentCocktailIds.has(id));

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

    const baseRecord = baseIngredients.get(normalizedId);
    if (!baseRecord) {
      createdIngredients.push(normalized);
      return;
    }

    if (!areStorageRecordsEqual(normalized, baseRecord)) {
      updatedIngredients.push(normalized);
    }
  });

  const deletedIngredientIds = Array.from(baseIngredients.keys()).filter((id) => !currentIngredientIds.has(id));
  const sanitizedRatings = sanitizeCocktailRatings(options.cocktailRatings);

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
    customCocktailTags: options.customCocktailTags,
    customIngredientTags: options.customIngredientTags,
    availableIngredientIds:
      options.availableIngredientIds.size > 0
        ? toSortedArray(options.availableIngredientIds)
        : undefined,
    shoppingIngredientIds:
      options.shoppingIngredientIds.size > 0
        ? toSortedArray(options.shoppingIngredientIds)
        : undefined,
    cocktailRatings: Object.keys(sanitizedRatings).length > 0 ? sanitizedRatings : undefined,
    ignoreGarnish: options.ignoreGarnish,
    allowAllSubstitutes: options.allowAllSubstitutes,
    useImperialUnits: options.useImperialUnits,
    keepScreenAwake: options.keepScreenAwake,
    ratingFilterThreshold: options.ratingFilterThreshold,
    startScreen: options.startScreen,
    appTheme: options.appTheme,
    onboardingStep: options.onboardingStep,
    onboardingCompleted: options.onboardingCompleted,
  } satisfies InventoryDeltaSnapshot<CocktailStorageRecord, IngredientStorageRecord>;
}
