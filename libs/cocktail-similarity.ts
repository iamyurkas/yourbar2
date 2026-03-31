import type { Cocktail, Ingredient } from "@/providers/inventory-provider";

type SimilarityOptions = {
  maxResults?: number;
};

export type SimilarCocktailResult = {
  cocktail: Cocktail;
  score: number;
};

type MeasurableIngredient = {
  id: number;
  amount: number;
};

const METRIC_UNIT_ID = 11;
const IMPERIAL_UNIT_ID = 12;
const PARTS_UNIT_ID = 13;
const GRAM_UNIT_ID = 8;
const CENTILITER_UNIT_ID = 3;
const IMPERIAL_TO_ML = 30;

function normalizeIngredientId(value?: number | string | null): number | null {
  if (value == null) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return Math.trunc(numeric);
}

function parseAmount(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function toComparableVolume(amount: number, unitId?: number | null): number {
  if (unitId === METRIC_UNIT_ID) {
    return amount;
  }

  if (unitId === CENTILITER_UNIT_ID) {
    return amount * 10;
  }

  if (unitId === IMPERIAL_UNIT_ID) {
    return amount * IMPERIAL_TO_ML;
  }

  if (unitId === PARTS_UNIT_ID || unitId === GRAM_UNIT_ID || unitId == null) {
    return amount;
  }

  return amount;
}

function resolveIngredientById(
  ingredientsById: Map<number, Ingredient>,
  ingredientId: number,
): Ingredient | undefined {
  return ingredientsById.get(ingredientId);
}

function resolveFamilyId(
  ingredientId: number,
  ingredientsById: Map<number, Ingredient>,
): number {
  const ingredient = resolveIngredientById(ingredientsById, ingredientId);
  if (!ingredient) {
    return ingredientId;
  }

  const styleId = normalizeIngredientId(ingredient.styleIngredientId);
  if (styleId != null) {
    return styleId;
  }

  const baseId = normalizeIngredientId(ingredient.baseIngredientId);
  if (baseId != null) {
    return baseId;
  }

  return ingredientId;
}

function resolveMainCategoryId(
  ingredientId: number | null,
  ingredientsById: Map<number, Ingredient>,
): number | null {
  if (ingredientId == null) {
    return null;
  }

  let currentId: number | null = ingredientId;
  const visited = new Set<number>();

  while (currentId != null && !visited.has(currentId)) {
    visited.add(currentId);
    const ingredient = resolveIngredientById(ingredientsById, currentId);
    const baseId = normalizeIngredientId(ingredient?.baseIngredientId);

    if (baseId == null) {
      return currentId;
    }

    currentId = baseId;
  }

  return currentId;
}

function resolveBaseIngredientId(
  cocktail: Cocktail,
  ingredientsById: Map<number, Ingredient>,
): number | null {
  const nonGarnish = (cocktail.ingredients ?? []).filter((item) => !item.garnish);
  const alcoholic = nonGarnish.find((item) => {
    const ingredientId = normalizeIngredientId(item.ingredientId);
    if (ingredientId == null) {
      return false;
    }

    const ingredient = resolveIngredientById(ingredientsById, ingredientId);
    const abv = Number(ingredient?.abv ?? 0);
    return Number.isFinite(abv) && abv > 0;
  });

  if (alcoholic) {
    return normalizeIngredientId(alcoholic.ingredientId);
  }

  const firstNonGarnish = nonGarnish.find((item) => normalizeIngredientId(item.ingredientId) != null);
  return firstNonGarnish ? normalizeIngredientId(firstNonGarnish.ingredientId) : null;
}

function resolveIngredientIdSet(cocktail: Cocktail): Set<number> {
  const ids = new Set<number>();

  (cocktail.ingredients ?? []).forEach((ingredient) => {
    const id = normalizeIngredientId(ingredient.ingredientId);
    if (id != null) {
      ids.add(id);
    }
  });

  return ids;
}

function resolveMeasurableIngredients(cocktail: Cocktail): MeasurableIngredient[] {
  const measurable: MeasurableIngredient[] = [];

  (cocktail.ingredients ?? []).forEach((ingredient) => {
    if (ingredient.garnish) {
      return;
    }

    const id = normalizeIngredientId(ingredient.ingredientId);
    const amount = parseAmount(ingredient.amount);
    if (id == null || amount == null) {
      return;
    }

    measurable.push({
      id,
      amount: toComparableVolume(amount, ingredient.unitId),
    });
  });

  return measurable;
}

function resolveNormalizedAmountByIngredientId(cocktail: Cocktail): Map<number, number> {
  const measurable = resolveMeasurableIngredients(cocktail);
  const total = measurable.reduce((sum, ingredient) => sum + ingredient.amount, 0);

  if (total <= 0) {
    return new Map<number, number>();
  }

  const ratios = new Map<number, number>();
  measurable.forEach((ingredient) => {
    ratios.set(ingredient.id, ingredient.amount / total);
  });

  return ratios;
}

function resolveSameFamilyCount(
  sourceIngredientIds: Set<number>,
  candidateIngredientIds: Set<number>,
  exactMatches: Set<number>,
  ingredientsById: Map<number, Ingredient>,
): number {
  const sourceFamilyIds = new Set<number>();
  sourceIngredientIds.forEach((ingredientId) => {
    if (!exactMatches.has(ingredientId)) {
      sourceFamilyIds.add(resolveFamilyId(ingredientId, ingredientsById));
    }
  });

  const candidateFamilyIds = new Set<number>();
  candidateIngredientIds.forEach((ingredientId) => {
    if (!exactMatches.has(ingredientId)) {
      candidateFamilyIds.add(resolveFamilyId(ingredientId, ingredientsById));
    }
  });

  let count = 0;
  sourceFamilyIds.forEach((familyId) => {
    if (candidateFamilyIds.has(familyId)) {
      count += 1;
    }
  });

  return count;
}

function resolveProportionPenalty(
  sourceRatios: Map<number, number>,
  candidateRatios: Map<number, number>,
  exactMatches: Set<number>,
): number {
  if (exactMatches.size === 0) {
    return 0;
  }

  let difference = 0;
  exactMatches.forEach((ingredientId) => {
    const sourceRatio = sourceRatios.get(ingredientId) ?? 0;
    const candidateRatio = candidateRatios.get(ingredientId) ?? 0;
    difference += Math.abs(sourceRatio - candidateRatio);
  });

  return Math.min(2, difference * 3);
}

export function findSimilarCocktails(
  sourceCocktail: Cocktail,
  cocktails: Cocktail[],
  ingredients: Ingredient[],
  options?: SimilarityOptions,
): SimilarCocktailResult[] {
  const maxResults = options?.maxResults ?? 10;
  const ingredientsById = new Map<number, Ingredient>(
    ingredients
      .map((ingredient) => {
        const id = normalizeIngredientId(ingredient.id);
        return id != null ? ([id, ingredient] as const) : null;
      })
      .filter((entry): entry is readonly [number, Ingredient] => entry != null),
  );

  const sourceIngredientIds = resolveIngredientIdSet(sourceCocktail);
  const sourceBaseMainCategoryId = resolveMainCategoryId(
    resolveBaseIngredientId(sourceCocktail, ingredientsById),
    ingredientsById,
  );
  const sourceRatios = resolveNormalizedAmountByIngredientId(sourceCocktail);

  const candidates: SimilarCocktailResult[] = [];

  cocktails.forEach((candidate) => {
    if (candidate === sourceCocktail || candidate.id === sourceCocktail.id) {
      return;
    }

    const candidateIngredientIds = resolveIngredientIdSet(candidate);
    if (candidateIngredientIds.size === 0) {
      return;
    }

    const exactMatches = new Set<number>();
    sourceIngredientIds.forEach((ingredientId) => {
      if (candidateIngredientIds.has(ingredientId)) {
        exactMatches.add(ingredientId);
      }
    });
    const exactMatchCount = exactMatches.size;

    const candidateBaseMainCategoryId = resolveMainCategoryId(
      resolveBaseIngredientId(candidate, ingredientsById),
      ingredientsById,
    );
    const hasSameBaseMainCategory =
      sourceBaseMainCategoryId != null &&
      candidateBaseMainCategoryId != null &&
      sourceBaseMainCategoryId === candidateBaseMainCategoryId;

    const isValidCandidate =
      exactMatchCount >= 2 || (hasSameBaseMainCategory && exactMatchCount >= 1);

    if (!isValidCandidate) {
      return;
    }

    const sameFamilyCount = resolveSameFamilyCount(
      sourceIngredientIds,
      candidateIngredientIds,
      exactMatches,
      ingredientsById,
    );

    let score = 0;
    score += exactMatchCount * 2;
    score += sameFamilyCount;

    if (!hasSameBaseMainCategory) {
      score -= 2;
    }

    const candidateRatios = resolveNormalizedAmountByIngredientId(candidate);
    score -= resolveProportionPenalty(sourceRatios, candidateRatios, exactMatches);

    candidates.push({ cocktail: candidate, score });
  });

  return candidates
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return (left.cocktail.name ?? "").localeCompare(right.cocktail.name ?? "");
    })
    .slice(0, maxResults);
}
