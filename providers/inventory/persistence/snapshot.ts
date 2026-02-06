import {
  type InventoryDeltaSnapshot
} from '@/libs/inventory-storage';
import {
  type CocktailStorageRecord,
  type IngredientStorageRecord,
  type StartScreen,
  type AppTheme,
  type CocktailTag,
  type IngredientTag
} from '../inventory-types';
import { type InventoryState } from './snapshot-logic';
import { sanitizeCocktailRatings, toSortedArray } from '../model/sanitization';
import { type InventoryDelta } from './delta-calculator';

const INVENTORY_SNAPSHOT_VERSION = 2;

/**
 * Assembles the final delta snapshot for persistence.
 * Note: The delta itself is now pre-calculated to avoid traversing full collections here.
 */
export function createDeltaSnapshotFromInventory(
  state: InventoryState,
  delta: InventoryDelta | undefined,
  options: {
    availableIngredientIds: Set<number>;
    shoppingIngredientIds: Set<number>;
    cocktailRatings: Record<string, number>;
    ignoreGarnish: boolean;
    allowAllSubstitutes: boolean;
    useImperialUnits: boolean;
    keepScreenAwake: boolean;
    ratingFilterThreshold: number;
    startScreen: StartScreen;
    appTheme: AppTheme;
    customCocktailTags: CocktailTag[];
    customIngredientTags: IngredientTag[];
    onboardingStep: number;
    onboardingCompleted: boolean;
  },
): InventoryDeltaSnapshot<CocktailStorageRecord, IngredientStorageRecord> {
  const sanitizedRatings = sanitizeCocktailRatings(options.cocktailRatings);

  return {
    version: INVENTORY_SNAPSHOT_VERSION,
    delta: delta || {},
    imported: state.imported,
    customCocktailTags: options.customCocktailTags,
    customIngredientTags: options.customIngredientTags,
    availableIngredientIds:
      options.availableIngredientIds.size > 0
        ? toSortedArray(options.availableIngredientIds)
        : undefined,
    shoppingIngredientIds:
      options.shoppingIngredientIds.size > 0
        ? toSortedArray(options.shoppingIngredientIds)
        : undefined,
    cocktailRatings: Object.keys(sanitizedRatings).length > 0 ? sanitizedRatings : undefined,
    ignoreGarnish: options.ignoreGarnish,
    allowAllSubstitutes: options.allowAllSubstitutes,
    useImperialUnits: options.useImperialUnits,
    keepScreenAwake: options.keepScreenAwake,
    ratingFilterThreshold: options.ratingFilterThreshold,
    startScreen: options.startScreen,
    appTheme: options.appTheme,
    onboardingStep: options.onboardingStep,
    onboardingCompleted: options.onboardingCompleted,
  } satisfies InventoryDeltaSnapshot<CocktailStorageRecord, IngredientStorageRecord>;
}
