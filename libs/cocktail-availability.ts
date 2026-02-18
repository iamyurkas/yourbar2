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

type IndexedCocktailIngredient = NonNullable<Cocktail['ingredients']>[number] & {
  __originalIndex: number;
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
    .map((ingredient, index) => ({ ...ingredient, __originalIndex: index }))
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
  let missingCount = 0;
  let displayMissingCount = 0;
  let hasBrandFallback = false;
  let hasStyleFallback = false;

  requiredIngredients.forEach((ingredient) => {
    const shouldIncludeInSecondLine = !ingredient?.garnish;
    const resolution = resolveIngredientAvailability(
      ingredient,
      availableIngredientIds,
      lookup,
      resolvedOptions,
    );

    if (resolution.isAvailable) {
      if (shouldIncludeInSecondLine && resolution.resolvedName) {
        resolvedNames.push(resolution.resolvedName);
      }
      return;
    }

    missingCount += 1;

    const missingIngredientId =
      typeof ingredient.ingredientId === 'number' && Number.isFinite(ingredient.ingredientId)
        ? Math.trunc(ingredient.ingredientId)
        : undefined;
    const missingIngredientRecord =
      missingIngredientId != null ? lookup.ingredientById.get(missingIngredientId) : undefined;

    const missingBrandBaseId =
      missingIngredientRecord?.baseIngredientId != null && Number.isFinite(Number(missingIngredientRecord.baseIngredientId))
        ? Math.trunc(Number(missingIngredientRecord.baseIngredientId))
        : undefined;

    if (missingBrandBaseId != null) {
      if (availableIngredientIds.has(missingBrandBaseId)) {
        hasBrandFallback = true;
      } else {
        const siblingBrands = lookup.brandsByBaseId.get(missingBrandBaseId) ?? [];
        if (siblingBrands.some((id) => id !== missingIngredientId && availableIngredientIds.has(id))) {
          hasBrandFallback = true;
        }
      }
    }

    const missingStyleBaseId =
      missingIngredientRecord?.styleIngredientId != null && Number.isFinite(Number(missingIngredientRecord.styleIngredientId))
        ? Math.trunc(Number(missingIngredientRecord.styleIngredientId))
        : undefined;

    if (missingStyleBaseId != null) {
      if (availableIngredientIds.has(missingStyleBaseId)) {
        hasStyleFallback = true;
      } else {
        const siblingStyles = lookup.stylesByBaseId.get(missingStyleBaseId) ?? [];
        if (siblingStyles.some((id) => id !== missingIngredientId && availableIngredientIds.has(id))) {
          hasStyleFallback = true;
        }
      }
    }

    if (!shouldIncludeInSecondLine) {
      return;
    }

    displayMissingCount += 1;
    if (resolution.missingName) {
      missingNames.push(resolution.missingName);
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
