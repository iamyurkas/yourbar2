import { loadInventoryData, type InventoryData } from '@/libs/inventory-data';
import { type InventoryDeltaSnapshot, type InventorySnapshot } from '@/libs/inventory-storage';
import { normalizeSearchText } from '@/libs/search-normalization';
import type { Cocktail, CocktailStorageRecord, Ingredient, IngredientStorageRecord } from '@/providers/inventory-types';

export type InventoryState = {
  cocktails: Cocktail[];
  ingredients: Ingredient[];
  imported: boolean;
};

type NormalizedSearchFields = {
  searchNameNormalized: string;
  searchTokensNormalized: string[];
};

function normalizeSearchFields<
  T extends {
    name?: string | null;
    searchName?: string | null;
    searchTokens?: string[] | null;
    synonyms?: string[] | null;
  },
>(items: readonly T[] = []): (T & NormalizedSearchFields)[] {
  return items.map((item) => {
    const { searchName: _searchName, searchTokens: _searchTokens, ...rest } = item;
    const baseName = item.name ?? '';
    const synonyms = Array.isArray(item.synonyms) ? item.synonyms : [];
    const normalizedNames = [baseName, ...synonyms]
      .map((name) => normalizeSearchText(name ?? ''))
      .filter(Boolean);
    const searchNameNormalized = normalizedNames.join(' ');
    const searchTokensNormalized = Array.from(
      new Set(normalizedNames.flatMap((name) => name.split(/\s+/).filter(Boolean))),
    );

    return {
      ...rest,
      searchNameNormalized,
      searchTokensNormalized,
    } as T & NormalizedSearchFields;
  });
}

function applyDeltaToCollection<TRecord extends { id?: number | null }>(
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

function applyDeltaToInventoryData(
  baseData: InventoryData,
  delta: InventoryDeltaSnapshot<CocktailStorageRecord, IngredientStorageRecord>['delta'],
): InventoryData {
  return {
    ...baseData,
    cocktails: applyDeltaToCollection(
      baseData.cocktails as CocktailStorageRecord[],
      delta.cocktails as { created?: CocktailStorageRecord[]; updated?: CocktailStorageRecord[]; deletedIds?: number[] } | undefined,
    ) as unknown as InventoryData["cocktails"],
    ingredients: applyDeltaToCollection(
      baseData.ingredients as unknown as IngredientStorageRecord[],
      delta.ingredients as { created?: IngredientStorageRecord[]; updated?: IngredientStorageRecord[]; deletedIds?: number[] } | undefined,
    ) as unknown as InventoryData["ingredients"],
  };
}

function backfillMissingIngredientStyleIds(
  ingredients: readonly IngredientStorageRecord[],
  baseData: InventoryData,
): IngredientStorageRecord[] {
  const baseIngredientsById = new Map<number, IngredientStorageRecord>();
  baseData.ingredients.forEach((ingredient) => {
    const id = Number(ingredient.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return;
    }

    baseIngredientsById.set(Math.trunc(id), ingredient as unknown as IngredientStorageRecord);
  });

  return ingredients.map((ingredient) => {
    const id = Number(ingredient.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return ingredient;
    }

    const baseIngredient = baseIngredientsById.get(Math.trunc(id));
    if (!baseIngredient) {
      return ingredient;
    }

    return {
      ...ingredient,
      styleIngredientId: ingredient.styleIngredientId ?? baseIngredient.styleIngredientId,
    } satisfies IngredientStorageRecord;
  });
}


export function createInventoryStateFromData(data: InventoryData, imported: boolean): InventoryState {
  return {
    cocktails: normalizeSearchFields(data.cocktails) as Cocktail[],
    ingredients: normalizeSearchFields(data.ingredients) as unknown as Ingredient[],
    imported,
  } satisfies InventoryState;
}

export function createInventoryStateFromSnapshot(
  snapshot: InventorySnapshot<CocktailStorageRecord, IngredientStorageRecord>,
  baseData?: InventoryData,
): InventoryState {
  const resolvedBaseData = baseData ?? loadInventoryData();

  if ('delta' in snapshot) {
    const mergedData = applyDeltaToInventoryData(resolvedBaseData, snapshot.delta);
    return createInventoryStateFromData(
      {
        ...mergedData,
        ingredients: backfillMissingIngredientStyleIds(
          mergedData.ingredients as unknown as IngredientStorageRecord[],
          resolvedBaseData,
        ) as unknown as InventoryData["ingredients"],
      },
      Boolean(snapshot.imported),
    );
  }

  const mergedLegacyIngredients = backfillMissingIngredientStyleIds(
    snapshot.ingredients,
    resolvedBaseData,
  );

  return {
    cocktails: normalizeSearchFields(snapshot.cocktails) as Cocktail[],
    ingredients: normalizeSearchFields(mergedLegacyIngredients) as Ingredient[],
    imported: Boolean(snapshot.imported),
  } satisfies InventoryState;
}
