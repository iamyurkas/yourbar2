import { createContext, useContext } from 'react';

import type { AmazonStoreOverride } from '@/libs/amazon-stores';
import type {
  Cocktail,
  CocktailTag,
  CreateCocktailInput,
  CreateIngredientInput,
  Ingredient,
  IngredientTag,
  InventoryExportData,
  PhotoBackupEntry,
  ImportedPhotoEntry,
  StartScreen,
  AppTheme,
} from '@/providers/inventory-types';

export type InventoryActionsContextValue = {
  setIngredientAvailability: (id: number, available: boolean) => void;
  toggleIngredientAvailability: (id: number) => void;
  toggleIngredientShopping: (id: number) => void;
  clearBaseIngredient: (id: number) => void;
  createCocktail: (input: CreateCocktailInput) => Cocktail | undefined;
  createIngredient: (input: CreateIngredientInput) => Ingredient | undefined;
  resetInventoryFromBundle: () => Promise<void>;
  exportInventoryData: () => InventoryExportData | null;
  exportInventoryPhotoEntries: () => PhotoBackupEntry[] | null;
  importInventoryData: (data: InventoryExportData) => void;
  importInventoryPhotos: (entries: ImportedPhotoEntry[]) => number;
  updateIngredient: (id: number, input: CreateIngredientInput) => Ingredient | undefined;
  updateCocktail: (id: number, input: CreateCocktailInput) => Cocktail | undefined;
  deleteCocktail: (id: number) => boolean;
  deleteIngredient: (id: number) => boolean;
  createCustomCocktailTag: (input: { name: string; color?: string | null }) => CocktailTag | undefined;
  updateCustomCocktailTag: (id: number, input: { name: string; color?: string | null }) => CocktailTag | undefined;
  deleteCustomCocktailTag: (id: number) => boolean;
  createCustomIngredientTag: (input: { name: string; color?: string | null }) => IngredientTag | undefined;
  updateCustomIngredientTag: (id: number, input: { name: string; color?: string | null }) => IngredientTag | undefined;
  deleteCustomIngredientTag: (id: number) => boolean;
  setCocktailRating: (cocktail: Cocktail, rating: number) => void;
  setIgnoreGarnish: (value: boolean) => void;
  setAllowAllSubstitutes: (value: boolean) => void;
  setUseImperialUnits: (value: boolean) => void;
  setKeepScreenAwake: (value: boolean) => void;
  setShakerSmartFilteringEnabled: (value: boolean) => void;
  setRatingFilterThreshold: (value: number) => void;
  setStartScreen: (value: StartScreen) => void;
  setAppTheme: (value: AppTheme) => void;
  setAmazonStoreOverride: (value: AmazonStoreOverride | null) => void;
  setOnboardingStep: (step: number) => void;
  completeOnboarding: () => void;
  restartOnboarding: () => void;
  connectGoogleDriveSync: () => Promise<boolean>;
  disconnectGoogleDrive: () => Promise<void>;
};

export const InventoryActionsContext = createContext<InventoryActionsContextValue | undefined>(undefined);

export function useInventoryActions() {
  const context = useContext(InventoryActionsContext);

  if (!context) {
    throw new Error('useInventoryActions must be used within an InventoryProvider');
  }

  return context;
}
