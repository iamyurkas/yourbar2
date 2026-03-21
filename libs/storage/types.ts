import type { Bar } from '@/providers/inventory-types';

export type InventorySnapshotV1<TCocktail, TIngredient> = {
  version: 1;
  cocktails: TCocktail[];
  ingredients: TIngredient[];
  imported?: boolean;
  availableIngredientIds?: number[];
  shoppingIngredientIds?: number[];
  cocktailRatings?: Record<string, number>;
  cocktailComments?: Record<string, string>;
  partySelectedCocktailKeys?: string[];
  ignoreGarnish?: boolean;
  allowAllSubstitutes?: boolean;
  useImperialUnits?: boolean;
  keepScreenAwake?: boolean;
  shakerSmartFilteringEnabled?: boolean;
  showTabCounters?: boolean;
  ratingFilterThreshold?: number;
  startScreen?: string;
  appTheme?: string;
  appLocale?: string;
  amazonStoreOverride?: string | null;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
  onboardingStarterApplied?: boolean;
};

export type InventoryDeltaSnapshot<TCocktail, TIngredient> = {
  version: 2;
  delta: {
    cocktails?: {
      created?: TCocktail[];
      updated?: TCocktail[];
      deletedIds?: number[];
    };
    ingredients?: {
      created?: TIngredient[];
      updated?: TIngredient[];
      deletedIds?: number[];
    };
  };
  imported?: boolean;
  customCocktailTags?: Array<{ id: number; name: string; color: string }>;
  customIngredientTags?: Array<{ id: number; name: string; color: string }>;
  availableIngredientIds?: number[];
  shoppingIngredientIds?: number[];
  cocktailRatings?: Record<string, number>;
  cocktailComments?: Record<string, string>;
  partySelectedCocktailKeys?: string[];
  ignoreGarnish?: boolean;
  allowAllSubstitutes?: boolean;
  useImperialUnits?: boolean;
  keepScreenAwake?: boolean;
  shakerSmartFilteringEnabled?: boolean;
  showTabCounters?: boolean;
  ratingFilterThreshold?: number;
  startScreen?: string;
  appTheme?: string;
  appLocale?: string;
  amazonStoreOverride?: string | null;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
  onboardingStarterApplied?: boolean;
};

export type InventoryDeltaSnapshotV3<TCocktail, TIngredient> = {
  version: 3;
  delta: {
    cocktails?: {
      created?: TCocktail[];
      updated?: TCocktail[];
      deletedIds?: number[];
    };
    ingredients?: {
      created?: TIngredient[];
      updated?: TIngredient[];
      deletedIds?: number[];
    };
  };
  imported?: boolean;
  customCocktailTags?: Array<{ id: number; name: string; color: string }>;
  customIngredientTags?: Array<{ id: number; name: string; color: string }>;
  availableIngredientIds?: number[];
  shoppingIngredientIds?: number[];
  cocktailRatings?: Record<string, number>;
  cocktailComments?: Record<string, string>;
  partySelectedCocktailKeys?: string[];
  ignoreGarnish?: boolean;
  allowAllSubstitutes?: boolean;
  useImperialUnits?: boolean;
  keepScreenAwake?: boolean;
  shakerSmartFilteringEnabled?: boolean;
  showTabCounters?: boolean;
  ratingFilterThreshold?: number;
  startScreen?: string;
  appTheme?: string;
  appLocale?: string;
  amazonStoreOverride?: string | null;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
  onboardingStarterApplied?: boolean;
  translationOverrides?: unknown;
  bars?: Bar[];
  activeBarId?: string;
};

export type InventorySnapshot<TCocktail, TIngredient> =
  | InventorySnapshotV1<TCocktail, TIngredient>
  | InventoryDeltaSnapshot<TCocktail, TIngredient>
  | InventoryDeltaSnapshotV3<TCocktail, TIngredient>;

export type CocktailTagDeltaSnapshot = Record<
  string,
  Array<{ id: number; name?: string; color?: string }> | null
>;

export type InventoryStorageAdapter = {
  loadInventoryState<TCocktail, TIngredient>(): Promise<InventorySnapshot<TCocktail, TIngredient> | undefined>;
  saveInventoryState<TCocktail, TIngredient>(snapshot: InventorySnapshot<TCocktail, TIngredient>): Promise<void>;
  loadCocktailTagDelta(): Promise<CocktailTagDeltaSnapshot>;
  saveCocktailTagDelta(snapshot: CocktailTagDeltaSnapshot): Promise<void>;
  syncBundledCatalogIfNeeded(): Promise<void>;
};
