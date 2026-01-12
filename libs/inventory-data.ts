import bundledData from '@/assets/data/data.json';
import { COCKTAIL_METHODS } from '@/constants/cocktail-methods';

export type InventoryData = typeof bundledData & {
  cocktailMethods: typeof COCKTAIL_METHODS;
};

let cachedInventoryData: InventoryData | undefined;

function normalizeInventoryData(data: unknown): InventoryData {
  if (data && typeof data === 'object' && 'default' in data) {
    return (data as { default?: InventoryData }).default ?? (data as InventoryData);
  }
  return data as InventoryData;
}

export function loadInventoryData(): InventoryData {
  if (!cachedInventoryData) {
    cachedInventoryData = normalizeInventoryData(bundledData);
    if (!cachedInventoryData.cocktailMethods?.length) {
      cachedInventoryData = {
        ...cachedInventoryData,
        cocktailMethods: COCKTAIL_METHODS,
      };
    }
  }

  return cachedInventoryData;
}

export function reloadInventoryData(): InventoryData {
  cachedInventoryData = normalizeInventoryData(require('@/assets/data/data.json'));
  if (!cachedInventoryData.cocktailMethods?.length) {
    cachedInventoryData = {
      ...cachedInventoryData,
      cocktailMethods: COCKTAIL_METHODS,
    };
  }
  return cachedInventoryData;
}
