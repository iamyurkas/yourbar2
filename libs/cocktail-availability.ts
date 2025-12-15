import type { Cocktail, Ingredient } from '@/providers/inventory-provider';
import {
  createIngredientLookup,
  resolveIngredientAvailability,
  type IngredientAvailabilityOptions,
  type IngredientLookup,
} from '@/libs/ingredient-availability';

const DEFAULT_AVAILABILITY_OPTIONS: IngredientAvailabilityOptions = {
  ignoreGarnish: true,
  allowAllSubstitutes: false,
};

export type CocktailAvailabilitySummary = {
  missingCount: number;
  missingNames: string[];
  recipeNames: string[];
  isReady: boolean;
  ingredientLine: string;
};

export function summariseCocktailAvailability(
  cocktail: Cocktail,
  availableIngredientIds: Set<number>,
  ingredientLookup?: IngredientLookup,
  ingredients?: Ingredient[],
  options?: IngredientAvailabilityOptions,
): CocktailAvailabilitySummary {
  const resolvedOptions = { ...DEFAULT_AVAILABILITY_OPTIONS, ...options };
  const lookup = ingredientLookup ?? createIngredientLookup(ingredients ?? []);
  const recipe = cocktail.ingredients ?? [];
  const requiredIngredients = recipe.filter(
    (item) => !item?.optional && !(resolvedOptions.ignoreGarnish && item?.garnish),
  );

  const recipeNames = recipe
    .map((ingredient) => ingredient.name)
    .filter((name): name is string => Boolean(name))
    .map((name) => name.trim())
    .filter(Boolean);

  if (requiredIngredients.length === 0) {
    return { missingCount: 0, missingNames: [], recipeNames, isReady: false, ingredientLine: '' };
  }

  const missingNames: string[] = [];
  const resolvedNames: string[] = [];
  let missingCount = 0;

  requiredIngredients.forEach((ingredient) => {
    const resolution = resolveIngredientAvailability(
      ingredient,
      availableIngredientIds,
      lookup,
      resolvedOptions,
    );

    if (resolution.isAvailable) {
      if (resolution.resolvedName) {
        resolvedNames.push(resolution.resolvedName);
      }
      return;
    }

    missingCount += 1;
    if (resolution.missingName) {
      missingNames.push(resolution.missingName);
    }
  });

  let ingredientLine = '';

  if (missingCount === 0) {
    ingredientLine = resolvedNames.join(', ');
  } else if (missingCount >= 3 || missingNames.length === 0) {
    ingredientLine = `Missing: ${missingCount} ingredients`;
  } else {
    ingredientLine = `Missing: ${missingNames.join(', ')}`;
  }

  const isReady = missingCount === 0 && requiredIngredients.length > 0;

  return { missingCount, missingNames, recipeNames, isReady, ingredientLine };
}

export function isCocktailReady(
  cocktail: Cocktail,
  availableIngredientIds: Set<number>,
  ingredientLookup?: IngredientLookup,
  ingredients?: Ingredient[],
  options?: IngredientAvailabilityOptions,
): boolean {
  return summariseCocktailAvailability(
    cocktail,
    availableIngredientIds,
    ingredientLookup,
    ingredients,
    options,
  ).isReady;
}
