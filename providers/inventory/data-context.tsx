import { createContext, useContext } from 'react';
import { type Cocktail, type Ingredient, type CocktailTag, type IngredientTag } from '../inventory-types';

export type InventoryDataContextValue = {
  cocktails: Cocktail[];
  ingredients: Ingredient[];
  customCocktailTags: CocktailTag[];
  customIngredientTags: IngredientTag[];
  availableIngredientIds: Set<number>;
  shoppingIngredientIds: Set<number>;
  cocktailRatings: Record<string, number>;
  ignoreGarnish: boolean;
  allowAllSubstitutes: boolean;
  useImperialUnits: boolean;
  ratingFilterThreshold: number;
  getCocktailRating: (cocktail: Cocktail) => number;
  loading: boolean;
};

export const InventoryDataContext = createContext<InventoryDataContextValue | undefined>(undefined);

export function useInventoryData() {
  const context = useContext(InventoryDataContext);
  if (!context) {
    throw new Error('useInventoryData must be used within an InventoryProvider');
  }
  return context;
}
