import { normalizeSearchFields } from '@/libs/inventory-utils';
import { type InventoryData } from '@/libs/inventory-data';
import { type InventorySnapshot, type InventoryDeltaSnapshot } from '@/libs/inventory-storage';
import {
  type Cocktail,
  type Ingredient,
  type CocktailStorageRecord,
  type IngredientStorageRecord
} from '../inventory-types';

export type InventoryState = {
  cocktails: Cocktail[];
  ingredients: Ingredient[];
  imported: boolean;
};

export function createInventoryStateFromData(data: InventoryData, imported: boolean): InventoryState {
  return {
    cocktails: normalizeSearchFields(data.cocktails) as Cocktail[],
    ingredients: normalizeSearchFields(data.ingredients) as Ingredient[],
    imported,
  } satisfies InventoryState;
}

export function applyDeltaToCollection<TRecord extends { id?: number | null }>(
  baseItems: readonly TRecord[],
  delta?: { created?: TRecord[]; updated?: TRecord[]; deletedIds?: number[] },
): TRecord[] {
  if (!delta) {
    return [...baseItems];
  }

  const deletedSet = new Set(
    (delta.deletedIds ?? [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id >= 0)
      .map((id) => Math.trunc(id)),
  );

  const updatedMap = new Map<number, TRecord>();
  (delta.updated ?? []).forEach((record) => {
    const id = Number(record.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return;
    }
    updatedMap.set(Math.trunc(id), record);
  });

  const createdMap = new Map<number, TRecord>();
  (delta.created ?? []).forEach((record) => {
    const id = Number(record.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return;
    }
    createdMap.set(Math.trunc(id), record);
  });

  const next: TRecord[] = [];
  const seen = new Set<number>();

  baseItems.forEach((record) => {
    const id = Number(record.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return;
    }
    const normalizedId = Math.trunc(id);
    if (deletedSet.has(normalizedId)) {
      return;
    }

    const replacement = updatedMap.get(normalizedId) ?? createdMap.get(normalizedId);
    next.push(replacement ?? record);
    seen.add(normalizedId);
  });

  updatedMap.forEach((record, id) => {
    if (seen.has(id) || deletedSet.has(id)) {
      return;
    }
    next.push(record);
    seen.add(id);
  });

  createdMap.forEach((record, id) => {
    if (seen.has(id) || deletedSet.has(id)) {
      return;
    }
    next.push(record);
    seen.add(id);
  });

  return next;
}

export function applyDeltaToInventoryData(
  baseData: InventoryData,
  delta: InventoryDeltaSnapshot<CocktailStorageRecord, IngredientStorageRecord>['delta'],
): InventoryData {
  return {
    ...baseData,
    cocktails: applyDeltaToCollection(baseData.cocktails, delta.cocktails),
    ingredients: applyDeltaToCollection(baseData.ingredients, delta.ingredients),
  };
}

export function createInventoryStateFromSnapshot(
  snapshot: InventorySnapshot<CocktailStorageRecord, IngredientStorageRecord>,
  baseData: InventoryData,
): InventoryState {
  if ('delta' in snapshot) {
    const mergedData = applyDeltaToInventoryData(baseData, snapshot.delta);
    return createInventoryStateFromData(mergedData, Boolean(snapshot.imported));
  }

  return {
    cocktails: normalizeSearchFields(snapshot.cocktails) as Cocktail[],
    ingredients: normalizeSearchFields(snapshot.ingredients) as Ingredient[],
    imported: Boolean(snapshot.imported),
  } satisfies InventoryState;
}
