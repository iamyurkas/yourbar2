import {
  toCocktailStorageRecord,
  toIngredientStorageRecord,
  areStorageRecordsEqual,
  normalizePhotoUriForBackup,
  normalizeTagIds
} from '@/libs/inventory-utils';
import { loadInventoryData } from '@/libs/inventory-data';
import {
  type CocktailStorageRecord,
  type InventoryExportData,
  type PhotoBackupEntry
} from '../inventory-types';
import { type InventoryState } from '../persistence/snapshot-logic';

export function getExportInventoryData(state: InventoryState): InventoryExportData | null {
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

  const cocktails = state.cocktails.reduce<InventoryExportData['cocktails']>((acc, cocktail) => {
    const record = toCocktailStorageRecord(cocktail);
    const id = Number(record.id ?? -1);
    const normalizedId = Number.isFinite(id) && id >= 0 ? Math.trunc(id) : undefined;
    const baseRecord = normalizedId != null ? baseCocktails.get(normalizedId) : undefined;

    if (baseRecord && areStorageRecordsEqual(record, baseRecord)) {
      return acc;
    }

    const tags = normalizeTagIds(cocktail.tags);
    acc.push({
      ...record,
      tags,
      photoUri: normalizePhotoUriForBackup({
        uri: record.photoUri,
        category: 'cocktails',
        id: record.id,
        name: record.name,
      }),
    });
    return acc;
  }, []);

  const ingredients = state.ingredients.map((ingredient) => {
    const record = toIngredientStorageRecord(ingredient);
    const tags = normalizeTagIds(ingredient.tags);
    return {
      ...record,
      tags,
      photoUri: normalizePhotoUriForBackup({
        uri: record.photoUri,
        category: 'ingredients',
        id: record.id,
        name: record.name,
      }),
    };
  });

  return {
    cocktails,
    ingredients,
  };
}

export function getExportInventoryPhotoEntries(state: InventoryState): PhotoBackupEntry[] | null {
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

  return [
    ...state.cocktails.reduce<PhotoBackupEntry[]>((acc, cocktail) => {
      const record = toCocktailStorageRecord(cocktail);
      const id = Number(record.id ?? -1);
      const normalizedId = Number.isFinite(id) && id >= 0 ? Math.trunc(id) : undefined;
      const baseRecord = normalizedId != null ? baseCocktails.get(normalizedId) : undefined;

      if (baseRecord && areStorageRecordsEqual(record, baseRecord)) {
        return acc;
      }

      acc.push({
        type: 'cocktails' as const,
        id: cocktail.id ?? '',
        name: cocktail.name ?? 'cocktail',
        uri: cocktail.photoUri ?? undefined,
      });
      return acc;
    }, []),
    ...state.ingredients.map((ingredient) => ({
      type: 'ingredients' as const,
      id: ingredient.id ?? '',
      name: ingredient.name ?? 'ingredient',
      uri: ingredient.photoUri ?? undefined,
    })),
  ];
}
