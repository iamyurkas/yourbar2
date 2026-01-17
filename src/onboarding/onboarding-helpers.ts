import type { CocktailTabKey, IngredientTabKey } from '@/libs/collection-tabs';

type IngredientsOnboardingActions = {
  focusTab: (tab: IngredientTabKey) => void;
  scrollToIngredient: (name: string, tab: IngredientTabKey) => void;
  openIngredientDetails: (name: string) => void;
};

type CocktailsOnboardingActions = {
  focusTab: (tab: CocktailTabKey) => void;
  scrollToCocktail: (name: string, tab: CocktailTabKey) => void;
  openCocktailDetails: (name: string) => void;
};

type ShakerOnboardingActions = {
  resetFilters: () => void;
  ensureIngredientVisible: (name: string) => void;
  selectIngredient: (name: string) => void;
  showResults: () => void;
};

let ingredientsActions: IngredientsOnboardingActions | null = null;
const listeners = new Set<() => void>();
let cocktailsActions: CocktailsOnboardingActions | null = null;
let shakerActions: ShakerOnboardingActions | null = null;

export const setIngredientsOnboardingActions = (actions: IngredientsOnboardingActions | null) => {
  ingredientsActions = actions;
  listeners.forEach((listener) => listener());
};

export const getIngredientsOnboardingActions = () => ingredientsActions;

export const subscribeIngredientsOnboardingActions = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setCocktailsOnboardingActions = (actions: CocktailsOnboardingActions | null) => {
  cocktailsActions = actions;
  listeners.forEach((listener) => listener());
};

export const getCocktailsOnboardingActions = () => cocktailsActions;

export const setShakerOnboardingActions = (actions: ShakerOnboardingActions | null) => {
  shakerActions = actions;
  listeners.forEach((listener) => listener());
};

export const getShakerOnboardingActions = () => shakerActions;
