import type { AmazonStoreOverride } from '@/libs/amazon-stores';
import type {
  AppLocale,
  AppTheme,
  SyncState,
  Bar,
  CocktailTag,
  GoogleUser,
  IngredientTag,
  StartScreen,
} from '@/providers/inventory-types';
import type { InventoryState } from '@/providers/inventory/model/inventory-state';

export type InventoryRuntimeCache = {
  inventoryState: InventoryState | undefined;
  availableIngredientIds: Set<number> | undefined;
  shoppingIngredientIds: Set<number> | undefined;
  cocktailRatings: Record<string, number> | undefined;
  cocktailComments: Record<string, string> | undefined;
  partySelectedCocktailKeys: Set<string> | undefined;
  ignoreGarnish: boolean | undefined;
  allowAllSubstitutes: boolean | undefined;
  useImperialUnits: boolean | undefined;
  keepScreenAwake: boolean | undefined;
  shakerSmartFilteringEnabled: boolean | undefined;
  showTabCounters: boolean | undefined;
  ratingFilterThreshold: number | undefined;
  startScreen: StartScreen | undefined;
  appTheme: AppTheme | undefined;
  appLocale: AppLocale | undefined;
  amazonStoreOverride: AmazonStoreOverride | null | undefined;
  customCocktailTags: CocktailTag[] | undefined;
  customIngredientTags: IngredientTag[] | undefined;
  bars: Bar[] | undefined;
  activeBarId: string | undefined;
  onboardingStep: number | undefined;
  onboardingCompleted: boolean | undefined;
  onboardingStarterApplied: boolean | undefined;
  syncState: SyncState | undefined;
  syncError: string | null | undefined;
  syncRevision: number | undefined;
  syncDeviceId: string | undefined;
  isSyncing: boolean | undefined;
  lastSyncTime: string | null | undefined;
  googleUser: GoogleUser | null | undefined;
};

declare global {
  // eslint-disable-next-line no-var
  var __yourbarInventory: InventoryState | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryAvailableIngredientIds: Set<number> | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryShoppingIngredientIds: Set<number> | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryCocktailRatings: Record<string, number> | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryCocktailComments: Record<string, string> | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryPartySelectedCocktailKeys: Set<string> | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryIgnoreGarnish: boolean | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryAllowAllSubstitutes: boolean | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryUseImperialUnits: boolean | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryKeepScreenAwake: boolean | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryShakerSmartFilteringEnabled: boolean | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryShowTabCounters: boolean | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryRatingFilterThreshold: number | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryStartScreen: StartScreen | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryAppTheme: AppTheme | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryAppLocale: AppLocale | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryAmazonStoreOverride: AmazonStoreOverride | null | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryCustomCocktailTags: CocktailTag[] | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryCustomIngredientTags: IngredientTag[] | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryBars: Bar[] | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryActiveBarId: string | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryOnboardingStep: number | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryOnboardingCompleted: boolean | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryOnboardingStarterApplied: boolean | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventorySyncState: SyncState | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventorySyncError: string | null | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventorySyncRevision: number | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventorySyncDeviceId: string | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryIsSyncing: boolean | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryLastSyncTime: string | null | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryGoogleUser: GoogleUser | null | undefined;
}

export function readInventoryRuntimeCache(): InventoryRuntimeCache {
  return {
    inventoryState: globalThis.__yourbarInventory,
    availableIngredientIds: globalThis.__yourbarInventoryAvailableIngredientIds,
    shoppingIngredientIds: globalThis.__yourbarInventoryShoppingIngredientIds,
    cocktailRatings: globalThis.__yourbarInventoryCocktailRatings,
    cocktailComments: globalThis.__yourbarInventoryCocktailComments,
    partySelectedCocktailKeys: globalThis.__yourbarInventoryPartySelectedCocktailKeys,
    ignoreGarnish: globalThis.__yourbarInventoryIgnoreGarnish,
    allowAllSubstitutes: globalThis.__yourbarInventoryAllowAllSubstitutes,
    useImperialUnits: globalThis.__yourbarInventoryUseImperialUnits,
    keepScreenAwake: globalThis.__yourbarInventoryKeepScreenAwake,
    shakerSmartFilteringEnabled: globalThis.__yourbarInventoryShakerSmartFilteringEnabled,
    showTabCounters: globalThis.__yourbarInventoryShowTabCounters,
    ratingFilterThreshold: globalThis.__yourbarInventoryRatingFilterThreshold,
    startScreen: globalThis.__yourbarInventoryStartScreen,
    appTheme: globalThis.__yourbarInventoryAppTheme,
    appLocale: globalThis.__yourbarInventoryAppLocale,
    amazonStoreOverride: globalThis.__yourbarInventoryAmazonStoreOverride,
    customCocktailTags: globalThis.__yourbarInventoryCustomCocktailTags,
    customIngredientTags: globalThis.__yourbarInventoryCustomIngredientTags,
    bars: globalThis.__yourbarInventoryBars,
    activeBarId: globalThis.__yourbarInventoryActiveBarId,
    onboardingStep: globalThis.__yourbarInventoryOnboardingStep,
    onboardingCompleted: globalThis.__yourbarInventoryOnboardingCompleted,
    onboardingStarterApplied: globalThis.__yourbarInventoryOnboardingStarterApplied,
    syncState: globalThis.__yourbarInventorySyncState,
    syncError: globalThis.__yourbarInventorySyncError,
    syncRevision: globalThis.__yourbarInventorySyncRevision,
    syncDeviceId: globalThis.__yourbarInventorySyncDeviceId,
    isSyncing: globalThis.__yourbarInventoryIsSyncing,
    lastSyncTime: globalThis.__yourbarInventoryLastSyncTime,
    googleUser: globalThis.__yourbarInventoryGoogleUser,
  };
}

export function writeInventoryRuntimeCache(cache: InventoryRuntimeCache): void {
  globalThis.__yourbarInventory = cache.inventoryState;
  globalThis.__yourbarInventoryAvailableIngredientIds = cache.availableIngredientIds;
  globalThis.__yourbarInventoryShoppingIngredientIds = cache.shoppingIngredientIds;
  globalThis.__yourbarInventoryCocktailRatings = cache.cocktailRatings;
  globalThis.__yourbarInventoryCocktailComments = cache.cocktailComments;
  globalThis.__yourbarInventoryPartySelectedCocktailKeys = cache.partySelectedCocktailKeys;
  globalThis.__yourbarInventoryIgnoreGarnish = cache.ignoreGarnish;
  globalThis.__yourbarInventoryAllowAllSubstitutes = cache.allowAllSubstitutes;
  globalThis.__yourbarInventoryUseImperialUnits = cache.useImperialUnits;
  globalThis.__yourbarInventoryKeepScreenAwake = cache.keepScreenAwake;
  globalThis.__yourbarInventoryShakerSmartFilteringEnabled = cache.shakerSmartFilteringEnabled;
  globalThis.__yourbarInventoryShowTabCounters = cache.showTabCounters;
  globalThis.__yourbarInventoryRatingFilterThreshold = cache.ratingFilterThreshold;
  globalThis.__yourbarInventoryStartScreen = cache.startScreen;
  globalThis.__yourbarInventoryAppTheme = cache.appTheme;
  globalThis.__yourbarInventoryAppLocale = cache.appLocale;
  globalThis.__yourbarInventoryAmazonStoreOverride = cache.amazonStoreOverride;
  globalThis.__yourbarInventoryCustomCocktailTags = cache.customCocktailTags;
  globalThis.__yourbarInventoryCustomIngredientTags = cache.customIngredientTags;
  globalThis.__yourbarInventoryBars = cache.bars;
  globalThis.__yourbarInventoryActiveBarId = cache.activeBarId;
  globalThis.__yourbarInventoryOnboardingStep = cache.onboardingStep;
  globalThis.__yourbarInventoryOnboardingCompleted = cache.onboardingCompleted;
  globalThis.__yourbarInventoryOnboardingStarterApplied = cache.onboardingStarterApplied;
  globalThis.__yourbarInventorySyncState = cache.syncState;
  globalThis.__yourbarInventorySyncError = cache.syncError;
  globalThis.__yourbarInventorySyncRevision = cache.syncRevision;
  globalThis.__yourbarInventorySyncDeviceId = cache.syncDeviceId;
  globalThis.__yourbarInventoryIsSyncing = cache.isSyncing;
  globalThis.__yourbarInventoryLastSyncTime = cache.lastSyncTime;
  globalThis.__yourbarInventoryGoogleUser = cache.googleUser;
}
