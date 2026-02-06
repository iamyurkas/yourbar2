import {
  areStorageRecordsEqual,
  toCocktailStorageRecord,
  toIngredientStorageRecord
} from '@/libs/inventory-utils';
import { type Cocktail, type Ingredient, type CocktailStorageRecord, type IngredientStorageRecord } from '@/providers/inventory-types';
import { getBaseCocktailsMap, getBaseIngredientsMap } from './base-cache';

/**
 * Caches to avoid redundant deep equality checks and traversals.
 * We use WeakMap to avoid memory leaks, but since our items are plain objects
 * we might need to use a Map with some expiration or just trust the short-lived nature
 * if they are recreated. However, many items remain referentially stable between renders.
 */
const cocktailStorageCache = new Map<Cocktail, CocktailStorageRecord>();
const ingredientStorageCache = new Map<Ingredient, IngredientStorageRecord>();

let lastCocktailsRef: Cocktail[] | undefined;
let lastIngredientsRef: Ingredient[] | undefined;
let lastCocktailDelta: DeltaResult<CocktailStorageRecord> | undefined;
let lastIngredientDelta: DeltaResult<IngredientStorageRecord> | undefined;

export type DeltaResult<T> = {
  created?: T[];
  updated?: T[];
  deletedIds?: number[];
};

export type InventoryDelta = {
  cocktails?: DeltaResult<CocktailStorageRecord>;
  ingredients?: DeltaResult<IngredientStorageRecord>;
};

export function calculateInventoryDelta(
  currentCocktails: Cocktail[],
  currentIngredients: Ingredient[]
): InventoryDelta {
  const baseCocktails = getBaseCocktailsMap();
  const baseIngredients = getBaseIngredientsMap();

  let nextCocktailDelta = lastCocktailDelta;
  let nextIngredientDelta = lastIngredientDelta;

  // 1. Process Cocktails only if reference changed
  if (currentCocktails !== lastCocktailsRef) {
    const createdCocktails: CocktailStorageRecord[] = [];
    const updatedCocktails: CocktailStorageRecord[] = [];
    const currentCocktailIds = new Set<number>();

    currentCocktails.forEach((cocktail) => {
      const id = Number(cocktail.id ?? -1);
      if (!Number.isFinite(id) || id < 0) return;
      const normalizedId = Math.trunc(id);
      currentCocktailIds.add(normalizedId);

      // Use cached storage record if reference is same
      let storageRecord = cocktailStorageCache.get(cocktail);
      if (!storageRecord) {
        storageRecord = toCocktailStorageRecord(cocktail);
        cocktailStorageCache.set(cocktail, storageRecord);
      }

      const baseRecord = baseCocktails.get(normalizedId);
      if (!baseRecord) {
        createdCocktails.push(storageRecord);
        return;
      }

      if (!areStorageRecordsEqual(storageRecord, baseRecord)) {
        updatedCocktails.push(storageRecord);
      }
    });

    const deletedCocktailIds = Array.from(baseCocktails.keys()).filter((id) => !currentCocktailIds.has(id));

    nextCocktailDelta =
      createdCocktails.length > 0 || updatedCocktails.length > 0 || deletedCocktailIds.length > 0
        ? {
            created: createdCocktails.length > 0 ? createdCocktails : undefined,
            updated: updatedCocktails.length > 0 ? updatedCocktails : undefined,
            deletedIds: deletedCocktailIds.length > 0 ? deletedCocktailIds : undefined,
          }
        : undefined;

    lastCocktailsRef = currentCocktails;
    lastCocktailDelta = nextCocktailDelta;
  }

  // 2. Process Ingredients only if reference changed
  if (currentIngredients !== lastIngredientsRef) {
    const createdIngredients: IngredientStorageRecord[] = [];
    const updatedIngredients: IngredientStorageRecord[] = [];
    const currentIngredientIds = new Set<number>();

    currentIngredients.forEach((ingredient) => {
      const id = Number(ingredient.id ?? -1);
      if (!Number.isFinite(id) || id < 0) return;
      const normalizedId = Math.trunc(id);
      currentIngredientIds.add(normalizedId);

      let storageRecord = ingredientStorageCache.get(ingredient);
      if (!storageRecord) {
        storageRecord = toIngredientStorageRecord(ingredient);
        ingredientStorageCache.set(ingredient, storageRecord);
      }

      const baseRecord = baseIngredients.get(normalizedId);
      if (!baseRecord) {
        createdIngredients.push(storageRecord);
        return;
      }

      if (!areStorageRecordsEqual(storageRecord, baseRecord)) {
        updatedIngredients.push(storageRecord);
      }
    });

    const deletedIngredientIds = Array.from(baseIngredients.keys()).filter((id) => !currentIngredientIds.has(id));

    nextIngredientDelta =
      createdIngredients.length > 0 || updatedIngredients.length > 0 || deletedIngredientIds.length > 0
        ? {
            created: createdIngredients.length > 0 ? createdIngredients : undefined,
            updated: updatedIngredients.length > 0 ? updatedIngredients : undefined,
            deletedIds: deletedIngredientIds.length > 0 ? deletedIngredientIds : undefined,
          }
        : undefined;

    lastIngredientsRef = currentIngredients;
    lastIngredientDelta = nextIngredientDelta;
  }

  // Cleanup caches to avoid growing indefinitely
  if (cocktailStorageCache.size > currentCocktails.length * 2) cocktailStorageCache.clear();
  if (ingredientStorageCache.size > currentIngredients.length * 2) ingredientStorageCache.clear();

  return {
    cocktails: nextCocktailDelta,
    ingredients: nextIngredientDelta,
  };
}

export function clearDeltaReferenceCache() {
  lastCocktailsRef = undefined;
  lastIngredientsRef = undefined;
  lastCocktailDelta = undefined;
  lastIngredientDelta = undefined;
  cocktailStorageCache.clear();
  ingredientStorageCache.clear();
}
