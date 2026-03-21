import { loadInventorySnapshot, persistInventorySnapshot, type InventorySnapshot } from '@/libs/inventory-storage';
import type { CocktailStorageRecord, IngredientStorageRecord } from '@/providers/inventory-types';

export type InventorySnapshotRecord = InventorySnapshot<CocktailStorageRecord, IngredientStorageRecord>;

export interface InventoryStorageAdapter {
  loadState(): Promise<InventorySnapshotRecord | undefined>;
  persistStateDelta(snapshot: InventorySnapshotRecord): Promise<void>;
  replaceState(snapshot: InventorySnapshotRecord): Promise<void>;
  clearState(): Promise<void>;
  exportSnapshot(): Promise<InventorySnapshotRecord | undefined>;
  importSnapshot(snapshot: InventorySnapshotRecord): Promise<void>;
}

export class JsonInventoryStorageAdapter implements InventoryStorageAdapter {
  async loadState(): Promise<InventorySnapshotRecord | undefined> {
    return loadInventorySnapshot<CocktailStorageRecord, IngredientStorageRecord>();
  }

  async persistStateDelta(snapshot: InventorySnapshotRecord): Promise<void> {
    await persistInventorySnapshot(snapshot);
  }

  async replaceState(snapshot: InventorySnapshotRecord): Promise<void> {
    await persistInventorySnapshot(snapshot);
  }

  async clearState(): Promise<void> {
    await persistInventorySnapshot({
      version: 3,
      delta: {},
      imported: true,
    });
  }

  async exportSnapshot(): Promise<InventorySnapshotRecord | undefined> {
    return this.loadState();
  }

  async importSnapshot(snapshot: InventorySnapshotRecord): Promise<void> {
    await this.replaceState(snapshot);
  }
}

export function getInventoryStorageFlag(): boolean {
  return String(process.env.EXPO_PUBLIC_USE_SQLITE_STORAGE ?? '').toLowerCase() === 'true';
}
