import { createContext, useContext } from 'react';

import type { Cocktail, CocktailTag, Ingredient, IngredientTag, InventoryBar } from '@/providers/inventory-types';

export type InventoryDataContextValue = {
  cocktails: Cocktail[];
  ingredients: Ingredient[];
  loading: boolean;
  availableIngredientIds: Set<number>;
  shoppingIngredientIds: Set<number>;
  customCocktailTags: CocktailTag[];
  customIngredientTags: IngredientTag[];
  ratingsByCocktailId: Record<string, number>;
  getCocktailRating: (cocktail: Cocktail) => number;
  bars: InventoryBar[];
  currentBarId: string;
  currentBarName: string;
};

export const InventoryDataContext = createContext<InventoryDataContextValue | undefined>(undefined);

export function useInventoryData() {
  const context = useContext(InventoryDataContext);

  if (!context) {
    throw new Error('useInventoryData must be used within an InventoryProvider');
  }

  return context;
}
