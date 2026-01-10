import bundledData from '@/assets/data/data.json';

export type InventoryData = typeof bundledData;

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
    if (!cachedInventoryData?.cocktailMethods?.length) {
      cachedInventoryData = reloadInventoryData();
    }
  }

  return cachedInventoryData;
}

export function reloadInventoryData(): InventoryData {
  cachedInventoryData = normalizeInventoryData(require('@/assets/data/data.json'));
  return cachedInventoryData;
}
