import bundledData from '@/assets/data/data.json';

export type InventoryData = typeof bundledData;

let cachedInventoryData: InventoryData | undefined;

export function loadInventoryData(): InventoryData {
  if (!cachedInventoryData) {
    cachedInventoryData = bundledData;
  }

  return cachedInventoryData;
}

export function reloadInventoryData(): InventoryData {
  cachedInventoryData = require('@/assets/data/data.json');
  return cachedInventoryData;
}
