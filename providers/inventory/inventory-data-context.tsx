import { createContext, useContext } from 'react';

import type { Cocktail, CocktailTag, Ingredient, IngredientTag } from '@/providers/inventory-types';

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
};

export const InventoryDataContext = createContext<InventoryDataContextValue | undefined>(undefined);

export function useInventoryData() {
  const context = useContext(InventoryDataContext);

  if (!context) {
    throw new Error('useInventoryData must be used within an InventoryProvider');
  }

  return context;
}
