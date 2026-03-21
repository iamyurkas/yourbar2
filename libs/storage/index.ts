import { fileStorageAdapter } from '@/libs/storage/file-storage';
import sqliteStorageAdapter from '@/libs/storage/sqlite-storage';
import type {
  CocktailTagDeltaSnapshot,
  InventorySnapshot,
  InventoryStorageAdapter,
} from '@/libs/storage/types';

export * from '@/libs/storage/types';

export function shouldUseSqliteStorage(): boolean {
  return process.env.EXPO_PUBLIC_USE_SQLITE_STORAGE === 'true';
}

export function getInventoryStorageAdapter(): InventoryStorageAdapter {
  return shouldUseSqliteStorage() ? sqliteStorageAdapter : fileStorageAdapter;
}

export async function loadInventoryState<TCocktail, TIngredient>(): Promise<InventorySnapshot<TCocktail, TIngredient> | undefined> {
  return getInventoryStorageAdapter().loadInventorySnapshot<TCocktail, TIngredient>();
}

export async function saveInventoryState<TCocktail, TIngredient>(snapshot: InventorySnapshot<TCocktail, TIngredient>): Promise<void> {
  return getInventoryStorageAdapter().persistInventorySnapshot(snapshot);
}

export async function loadCocktailTagDelta(): Promise<CocktailTagDeltaSnapshot> {
  return getInventoryStorageAdapter().loadCocktailTagDeltaSnapshot();
}

export async function saveCocktailTagDelta(snapshot: CocktailTagDeltaSnapshot): Promise<void> {
  return getInventoryStorageAdapter().persistCocktailTagDeltaSnapshot(snapshot);
}

export async function syncBundledCatalogIfNeeded(): Promise<void> {
  return getInventoryStorageAdapter().syncBundledCatalogIfNeeded();
}
