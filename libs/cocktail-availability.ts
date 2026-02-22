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

const DEFAULT_TAG_SORT_ORDER = Number.MAX_SAFE_INTEGER;
const DEFAULT_RECIPE_ORDER = Number.MAX_SAFE_INTEGER;

function getIngredientRecipeOrder(
  ingredient: NonNullable<Cocktail['ingredients']>[number],
): number {
  const order = Number(ingredient.order);
  if (!Number.isFinite(order)) {
    return DEFAULT_RECIPE_ORDER;
  }

  return Math.trunc(order);
}

type IndexedCocktailIngredient = NonNullable<Cocktail['ingredients']>[number] & {
  __originalIndex: number;
  __orderValue: number;
};

function getIngredientPrimaryTagOrder(
  ingredient: NonNullable<Cocktail['ingredients']>[number],
  lookup: IngredientLookup,
): number {
  const ingredientId =
    typeof ingredient.ingredientId === 'number' && Number.isFinite(ingredient.ingredientId)
      ? Math.trunc(ingredient.ingredientId)
      : undefined;

  if (ingredientId == null) {
    return DEFAULT_TAG_SORT_ORDER;
  }

  const ingredientRecord = lookup.ingredientById.get(ingredientId);
  const tagIds = (ingredientRecord?.tags ?? [])
    .map((tag) => Number(tag?.id))
    .filter((tagId) => Number.isFinite(tagId) && tagId >= 0)
    .map((tagId) => Math.trunc(tagId));

  if (!tagIds.length) {
    return DEFAULT_TAG_SORT_ORDER;
  }

  return Math.min(...tagIds);
}

function sortRecipeIngredients(
  ingredients: NonNullable<Cocktail['ingredients']>,
  lookup: IngredientLookup,
): IndexedCocktailIngredient[] {
  return ingredients
    .map((ingredient, index) => ({
      ...ingredient,
      __originalIndex: index,
      __orderValue: getIngredientRecipeOrder(ingredient),
    }))
    .sort((left, right) => {
      const garnishDiff = Number(Boolean(left.garnish)) - Number(Boolean(right.garnish));
      if (garnishDiff !== 0) {
        return garnishDiff;
      }

      const leftTagOrder = getIngredientPrimaryTagOrder(left, lookup);
      const rightTagOrder = getIngredientPrimaryTagOrder(right, lookup);
      if (leftTagOrder !== rightTagOrder) {
        return leftTagOrder - rightTagOrder;
      }

      const orderDiff = left.__orderValue - right.__orderValue;
      if (orderDiff !== 0) {
        return orderDiff;
      }

      return left.__originalIndex - right.__originalIndex;
    });
}

export type CocktailAvailabilitySummary = {
  missingCount: number;
  missingNames: string[];
  recipeNames: string[];
  isReady: boolean;
  ingredientLine: string;
  hasBrandFallback: boolean;
  hasStyleFallback: boolean;
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
  const requiredIngredients = sortRecipeIngredients(recipe, lookup).filter(
    (item) => !item?.optional && !(resolvedOptions.ignoreGarnish && item?.garnish),
  );

  const recipeNames = recipe
    .map((ingredient) => ingredient.name)
    .filter((name): name is string => Boolean(name))
    .map((name) => name.trim())
    .filter(Boolean);

  if (requiredIngredients.length === 0) {
    return {
      missingCount: 0,
      missingNames: [],
      recipeNames,
      isReady: false,
      ingredientLine: '',
      hasBrandFallback: false,
      hasStyleFallback: false,
    };
  }

  const missingNames: string[] = [];
  const resolvedNames: string[] = [];
  const seenSecondLineNames = new Set<string>();
  let missingCount = 0;
  let displayMissingCount = 0;
  let hasBrandFallback = false;
  let hasStyleFallback = false;

  requiredIngredients.forEach((ingredient) => {
    const shouldIncludeInSecondLine = !ingredient?.garnish;

    const requestedIngredientId =
      typeof ingredient.ingredientId === 'number' && Number.isFinite(ingredient.ingredientId)
        ? Math.trunc(ingredient.ingredientId)
        : undefined;
    const requestedIngredientRecord =
      requestedIngredientId != null ? lookup.ingredientById.get(requestedIngredientId) : undefined;

    if (requestedIngredientId != null && !availableIngredientIds.has(requestedIngredientId)) {
      const requestedBrandBaseId =
        requestedIngredientRecord?.baseIngredientId != null && Number.isFinite(Number(requestedIngredientRecord.baseIngredientId))
          ? Math.trunc(Number(requestedIngredientRecord.baseIngredientId))
          : undefined;

      if (requestedBrandBaseId != null) {
        if (availableIngredientIds.has(requestedBrandBaseId)) {
          hasBrandFallback = true;
        } else {
          const siblingBrands = lookup.brandsByBaseId.get(requestedBrandBaseId) ?? [];
          if (siblingBrands.some((id) => id !== requestedIngredientId && availableIngredientIds.has(id))) {
            hasBrandFallback = true;
          }
        }
      }

      const requestedStyleBaseId =
        requestedIngredientRecord?.styleIngredientId != null && Number.isFinite(Number(requestedIngredientRecord.styleIngredientId))
          ? Math.trunc(Number(requestedIngredientRecord.styleIngredientId))
          : undefined;

      if (requestedStyleBaseId != null) {
        if (availableIngredientIds.has(requestedStyleBaseId)) {
          hasStyleFallback = true;
        } else {
          const siblingStyles = lookup.stylesByBaseId.get(requestedStyleBaseId) ?? [];
          if (siblingStyles.some((id) => id !== requestedIngredientId && availableIngredientIds.has(id))) {
            hasStyleFallback = true;
          }
        }
      }
    }

    const resolution = resolveIngredientAvailability(
      ingredient,
      availableIngredientIds,
      lookup,
      resolvedOptions,
    );

    if (resolution.isAvailable) {
      if (shouldIncludeInSecondLine && resolution.resolvedName) {
        const normalizedResolvedName = resolution.resolvedName.trim().toLowerCase();
        if (!seenSecondLineNames.has(normalizedResolvedName)) {
          seenSecondLineNames.add(normalizedResolvedName);
          resolvedNames.push(resolution.resolvedName);
        }
      }
      return;
    }

    missingCount += 1;

    if (!shouldIncludeInSecondLine) {
      return;
    }

    displayMissingCount += 1;
    if (resolution.missingName) {
      const normalizedMissingName = resolution.missingName.trim().toLowerCase();
      if (!seenSecondLineNames.has(normalizedMissingName)) {
        seenSecondLineNames.add(normalizedMissingName);
        missingNames.push(resolution.missingName);
      }
    }
  });

  let ingredientLine = '';

  if (displayMissingCount === 0) {
    ingredientLine = resolvedNames.join(', ');
  } else if (displayMissingCount >= 3 || missingNames.length === 0) {
    ingredientLine = `Missing: ${displayMissingCount} ingredients`;
  } else {
    ingredientLine = `Missing: ${missingNames.join(', ')}`;
  }

  const isReady = missingCount === 0 && requiredIngredients.length > 0;

  return {
    missingCount,
    missingNames,
    recipeNames,
    isReady,
    ingredientLine,
    hasBrandFallback,
    hasStyleFallback,
  };
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
