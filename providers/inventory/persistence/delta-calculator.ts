import {
  areStorageRecordsEqual,
  toCocktailStorageRecord,
  toIngredientStorageRecord
} from '@/libs/inventory-utils';
import { type Cocktail, type Ingredient, type CocktailStorageRecord, type IngredientStorageRecord } from '@/providers/inventory-types';
import { getBaseCocktailsMap, getBaseIngredientsMap } from './base-cache';

/**
 * Caches to avoid redundant deep equality checks and traversals.
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

function updateDeltaCollection<TEntity extends { id?: number | null }, TRecord extends { id?: number | null }>(
  delta: DeltaResult<TRecord> | undefined,
  dirtyIds: Set<number>,
  currentEntities: TEntity[],
  baseMap: Map<number, TRecord>,
  toRecord: (entity: TEntity) => TRecord,
  entityCache: Map<TEntity, TRecord>,
  storageRecordsEqual: (a: TRecord, b: TRecord) => boolean
): DeltaResult<TRecord> | undefined {
  if (dirtyIds.size === 0) return delta;

  // Initialize next delta from current one
  const next: DeltaResult<TRecord> = {
    created: delta?.created ? [...delta.created] : undefined,
    updated: delta?.updated ? [...delta.updated] : undefined,
    deletedIds: delta?.deletedIds ? [...delta.deletedIds] : undefined,
  };

  const entityMap = new Map<number, TEntity>();
  currentEntities.forEach(e => {
    if (e.id != null) entityMap.set(Math.trunc(Number(e.id)), e);
  });

  dirtyIds.forEach(id => {
    const normalizedId = Math.trunc(id);
    const entity = entityMap.get(normalizedId);
    const baseRecord = baseMap.get(normalizedId);

    // Remove from all categories first to re-evaluate
    if (next.created) next.created = next.created.filter(r => Math.trunc(Number(r.id)) !== normalizedId);
    if (next.updated) next.updated = next.updated.filter(r => Math.trunc(Number(r.id)) !== normalizedId);
    if (next.deletedIds) next.deletedIds = next.deletedIds.filter(did => Math.trunc(did) !== normalizedId);

    if (entity) {
      // It exists in current state (Created or Updated)
      let storageRecord = entityCache.get(entity);
      if (!storageRecord) {
        storageRecord = toRecord(entity);
        entityCache.set(entity, storageRecord);
      }

      if (!baseRecord) {
        // Not in base data -> Created
        if (!next.created) next.created = [];
        next.created.push(storageRecord);
      } else if (!storageRecordsEqual(storageRecord, baseRecord)) {
        // Differs from base data -> Updated
        if (!next.updated) next.updated = [];
        next.updated.push(storageRecord);
      }
      // If same as base, it remains removed from delta categories
    } else {
      // It does not exist in current state (Deleted)
      if (baseRecord) {
        // It was in base data -> officially deleted
        if (!next.deletedIds) next.deletedIds = [];
        next.deletedIds.push(normalizedId);
      }
      // If not in base data, it was a temp session item that is now gone, so nothing to do
    }
  });

  // Clean up undefined arrays if they became empty
  if (next.created && next.created.length === 0) delete next.created;
  if (next.updated && next.updated.length === 0) delete next.updated;
  if (next.deletedIds && next.deletedIds.length === 0) delete next.deletedIds;

  return (next.created || next.updated || next.deletedIds) ? next : undefined;
}

export function calculateInventoryDelta(
  currentCocktails: Cocktail[],
  currentIngredients: Ingredient[],
  dirtyCocktailIds?: Set<number>,
  dirtyIngredientIds?: Set<number>
): InventoryDelta {
  const baseCocktails = getBaseCocktailsMap();
  const baseIngredients = getBaseIngredientsMap();

  let nextCocktailDelta = lastCocktailDelta;
  let nextIngredientDelta = lastIngredientDelta;

  // 1. Process Cocktails
  if (currentCocktails !== lastCocktailsRef) {
    if (!lastCocktailsRef || !dirtyCocktailIds || dirtyCocktailIds.size === 0) {
      // Full scan on first run or if no dirty hints provided
      const createdCocktails: CocktailStorageRecord[] = [];
      const updatedCocktails: CocktailStorageRecord[] = [];
      const currentCocktailIds = new Set<number>();

      currentCocktails.forEach((cocktail) => {
        const id = Number(cocktail.id ?? -1);
        if (!Number.isFinite(id) || id < 0) return;
        const normalizedId = Math.trunc(id);
        currentCocktailIds.add(normalizedId);

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
    } else {
      // Incremental update using dirty sets
      nextCocktailDelta = updateDeltaCollection(
        lastCocktailDelta,
        dirtyCocktailIds,
        currentCocktails,
        baseCocktails,
        toCocktailStorageRecord,
        cocktailStorageCache,
        areStorageRecordsEqual
      );
    }
    lastCocktailsRef = currentCocktails;
    lastCocktailDelta = nextCocktailDelta;
  }

  // 2. Process Ingredients
  if (currentIngredients !== lastIngredientsRef) {
    if (!lastIngredientsRef || !dirtyIngredientIds || dirtyIngredientIds.size === 0) {
      // Full scan
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
    } else {
      // Incremental update
      nextIngredientDelta = updateDeltaCollection(
        lastIngredientDelta,
        dirtyIngredientIds,
        currentIngredients,
        baseIngredients,
        toIngredientStorageRecord,
        ingredientStorageCache,
        areStorageRecordsEqual
      );
    }
    lastIngredientsRef = currentIngredients;
    lastIngredientDelta = nextIngredientDelta;
  }

  // Cleanup caches periodically to avoid growing indefinitely
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
