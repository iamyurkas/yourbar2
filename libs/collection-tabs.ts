export type CocktailTabKey = 'all' | 'my' | 'favorites';
export type IngredientTabKey = 'all' | 'my' | 'shopping';

let lastCocktailTab: CocktailTabKey = 'all';
let lastIngredientTab: IngredientTabKey = 'all';

export const getLastCocktailTab = () => lastCocktailTab;
export const setLastCocktailTab = (tab: CocktailTabKey) => {
  lastCocktailTab = tab;
};

export const getLastIngredientTab = () => lastIngredientTab;
export const setLastIngredientTab = (tab: IngredientTabKey) => {
  lastIngredientTab = tab;
};
