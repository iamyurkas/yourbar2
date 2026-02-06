import { loadInventoryData } from '@/libs/inventory-data';
import {
  toCocktailStorageRecord,
  toIngredientStorageRecord
} from '@/libs/inventory-utils';
import { type CocktailStorageRecord, type IngredientStorageRecord } from '@/providers/inventory-types';

/**
 * Cached base data maps to avoid rebuilding them on every persistence call.
 * These maps store the initial state of cocktails and ingredients from data.json.
 */
let baseCocktailsMap: Map<number, CocktailStorageRecord> | undefined;
let baseIngredientsMap: Map<number, IngredientStorageRecord> | undefined;

function buildBaseMaps() {
  const baseData = loadInventoryData();

  baseCocktailsMap = new Map<number, CocktailStorageRecord>(
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

  baseIngredientsMap = new Map<number, IngredientStorageRecord>(
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
}

export function getBaseCocktailsMap(): Map<number, CocktailStorageRecord> {
  if (!baseCocktailsMap) {
    buildBaseMaps();
  }
  return baseCocktailsMap!;
}

export function getBaseIngredientsMap(): Map<number, IngredientStorageRecord> {
  if (!baseIngredientsMap) {
    buildBaseMaps();
  }
  return baseIngredientsMap!;
}

export function refreshBaseCache() {
  buildBaseMaps();
}
