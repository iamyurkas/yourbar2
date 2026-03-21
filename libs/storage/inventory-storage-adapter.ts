import type { InventorySnapshot, CocktailTagDeltaSnapshot } from '@/libs/inventory-storage';

export type InventoryStorageAdapter<TCocktail, TIngredient> = {
  loadAppState: () => Promise<InventorySnapshot<TCocktail, TIngredient> | undefined>;
  saveAppState: (snapshot: InventorySnapshot<TCocktail, TIngredient>) => Promise<void>;
  loadCatalogOverlayState: () => Promise<CocktailTagDeltaSnapshot>;
  saveCatalogOverlayState: (snapshot: CocktailTagDeltaSnapshot) => Promise<void>;
};
