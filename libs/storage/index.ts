import { fileStorageAdapter } from '@/libs/storage/file-storage';
import { sqliteStorageAdapter } from '@/libs/storage/sqlite-storage';
import type { CocktailTagDeltaSnapshot, InventorySnapshot } from '@/libs/storage/types';

const useSqliteStorage = process.env.EXPO_PUBLIC_USE_SQLITE_STORAGE === 'true';
const activeAdapter = useSqliteStorage ? sqliteStorageAdapter : fileStorageAdapter;

export function getActiveStorageAdapter() {
  return activeAdapter;
}

export async function loadInventoryState<TCocktail, TIngredient>(): Promise<InventorySnapshot<TCocktail, TIngredient> | undefined> {
  return activeAdapter.loadInventoryState<TCocktail, TIngredient>();
}

export async function saveInventoryState<TCocktail, TIngredient>(
  snapshot: InventorySnapshot<TCocktail, TIngredient>,
): Promise<void> {
  return activeAdapter.saveInventoryState(snapshot);
}

export async function loadCocktailTagDelta(): Promise<CocktailTagDeltaSnapshot> {
  return activeAdapter.loadCocktailTagDelta();
}

export async function saveCocktailTagDelta(snapshot: CocktailTagDeltaSnapshot): Promise<void> {
  return activeAdapter.saveCocktailTagDelta(snapshot);
}

export async function syncBundledCatalogIfNeeded(): Promise<void> {
  return activeAdapter.syncBundledCatalogIfNeeded();
}
