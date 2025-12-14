import type { Cocktail, Ingredient } from '@/providers/inventory-provider';
import {
  createIngredientLookup,
  isRecipeIngredientAvailable,
  type IngredientLookup,
} from '@/libs/ingredient-availability';

const REQUIRED_INGREDIENT_FILTER = (item: Cocktail['ingredients'][number]) =>
  !item?.optional && !item?.garnish;

export type CocktailAvailabilitySummary = {
  missingCount: number;
  missingNames: string[];
  recipeNames: string[];
  isReady: boolean;
};

export function summariseCocktailAvailability(
  cocktail: Cocktail,
  availableIngredientIds: Set<number>,
  ingredientLookup?: IngredientLookup,
  ingredients?: Ingredient[],
): CocktailAvailabilitySummary {
  const lookup = ingredientLookup ?? createIngredientLookup(ingredients ?? []);
  const recipe = cocktail.ingredients ?? [];
  const requiredIngredients = recipe.filter(REQUIRED_INGREDIENT_FILTER);

  const recipeNames = recipe
    .map((ingredient) => ingredient.name)
    .filter((name): name is string => Boolean(name))
    .map((name) => name.trim())
    .filter(Boolean);

  if (requiredIngredients.length === 0) {
    return { missingCount: 0, missingNames: [], recipeNames, isReady: false };
  }

  const missingNames: string[] = [];

  requiredIngredients.forEach((ingredient) => {
    if (!isRecipeIngredientAvailable(ingredient, availableIngredientIds, lookup)) {
      if (ingredient.name) {
        missingNames.push(ingredient.name);
      }
    }
  });

  const missingCount = missingNames.length;
  const isReady = missingCount === 0 && requiredIngredients.length > 0;

  return { missingCount, missingNames, recipeNames, isReady };
}

export function isCocktailReady(
  cocktail: Cocktail,
  availableIngredientIds: Set<number>,
  ingredientLookup?: IngredientLookup,
  ingredients?: Ingredient[],
): boolean {
  return summariseCocktailAvailability(cocktail, availableIngredientIds, ingredientLookup, ingredients).isReady;
}
