import { normalizeSearchText } from '@/libs/search-normalization';
import type { Cocktail, Ingredient } from '@/providers/inventory-provider';

type CocktailSimilarityResult = {
  cocktail: Cocktail;
  score: number;
};

type ComputeSimilarCocktailsOptions = {
  limit?: number;
};

const SYNONYM_NAME_MATCH_SCORE = 220;
const SYNONYM_OVERLAP_SCORE = 120;
const INGREDIENT_OVERLAP_SCORE = 90;
const INGREDIENT_CATEGORY_SCORE = 40;
const RATIO_SIMILARITY_SCORE = 35;
const TECHNIQUE_SCORE = 12;

function normalizeToken(value?: string | null): string {
  if (!value) {
    return '';
  }

  return normalizeSearchText(value);
}

function buildNameSynonymSet(cocktail: Cocktail): Set<string> {
  return new Set(
    [cocktail.name, ...(cocktail.synonyms ?? [])]
      .map((item) => normalizeToken(item))
      .filter(Boolean),
  );
}

function getIngredientIds(cocktail: Cocktail): Set<number> {
  const ids = new Set<number>();
  (cocktail.ingredients ?? []).forEach((ingredient) => {
    const rawId = Number(ingredient.ingredientId);
    if (Number.isFinite(rawId) && rawId >= 0) {
      ids.add(Math.trunc(rawId));
    }
  });

  return ids;
}

function getIngredientFamilies(cocktail: Cocktail, ingredientsById: Map<number, Ingredient>): Set<number> {
  const familyIds = new Set<number>();

  getIngredientIds(cocktail).forEach((ingredientId) => {
    const ingredient = ingredientsById.get(ingredientId);
    if (!ingredient) {
      return;
    }

    const baseId = Number(ingredient.baseIngredientId);
    const styleId = Number(ingredient.styleIngredientId);

    if (Number.isFinite(baseId) && baseId >= 0) {
      familyIds.add(Math.trunc(baseId));
      return;
    }

    if (Number.isFinite(styleId) && styleId >= 0) {
      familyIds.add(Math.trunc(styleId));
      return;
    }

    familyIds.add(ingredientId);
  });

  return familyIds;
}

function getMethodIds(cocktail: Cocktail): Set<string> {
  const methodIds = new Set<string>();
  (cocktail.methodIds ?? []).forEach((methodId) => {
    if (methodId) {
      methodIds.add(methodId);
    }
  });

  const legacyMethodId = (cocktail as { methodId?: string | null }).methodId;
  if (legacyMethodId) {
    methodIds.add(legacyMethodId);
  }

  return methodIds;
}

function parseAmount(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildIngredientRatioMap(cocktail: Cocktail): Map<number, number> {
  const amountByIngredient = new Map<number, number>();
  let total = 0;

  (cocktail.ingredients ?? []).forEach((ingredient) => {
    const ingredientId = Number(ingredient.ingredientId);
    const amount = parseAmount(ingredient.amount);

    if (!Number.isFinite(ingredientId) || ingredientId < 0 || amount == null) {
      return;
    }

    const normalizedId = Math.trunc(ingredientId);
    amountByIngredient.set(normalizedId, (amountByIngredient.get(normalizedId) ?? 0) + amount);
    total += amount;
  });

  if (total <= 0) {
    return new Map();
  }

  const ratios = new Map<number, number>();
  amountByIngredient.forEach((amount, ingredientId) => {
    ratios.set(ingredientId, amount / total);
  });

  return ratios;
}

function overlapSize<T>(left: Set<T>, right: Set<T>): number {
  let overlap = 0;
  left.forEach((value) => {
    if (right.has(value)) {
      overlap += 1;
    }
  });
  return overlap;
}

function computeRatioSimilarity(current: Map<number, number>, candidate: Map<number, number>): number {
  if (current.size === 0 || candidate.size === 0) {
    return 0;
  }

  const sharedIngredientIds = [...current.keys()].filter((ingredientId) => candidate.has(ingredientId));
  if (sharedIngredientIds.length === 0) {
    return 0;
  }

  const averageDistance =
    sharedIngredientIds.reduce((totalDistance, ingredientId) => {
      const currentRatio = current.get(ingredientId) ?? 0;
      const candidateRatio = candidate.get(ingredientId) ?? 0;
      return totalDistance + Math.abs(currentRatio - candidateRatio);
    }, 0) / sharedIngredientIds.length;

  return Math.max(0, 1 - averageDistance * 2);
}

export function findSimilarCocktails(
  currentCocktail: Cocktail,
  cocktails: Cocktail[],
  ingredients: Ingredient[],
  options?: ComputeSimilarCocktailsOptions,
): CocktailSimilarityResult[] {
  const limit = options?.limit ?? 10;
  if (limit <= 0) {
    return [];
  }

  const ingredientsById = new Map<number, Ingredient>();
  ingredients.forEach((ingredient) => {
    const ingredientId = Number(ingredient.id);
    if (Number.isFinite(ingredientId) && ingredientId >= 0) {
      ingredientsById.set(Math.trunc(ingredientId), ingredient);
    }
  });

  const currentTerms = buildNameSynonymSet(currentCocktail);
  const currentName = normalizeToken(currentCocktail.name);
  const currentIngredientIds = getIngredientIds(currentCocktail);
  const currentFamilies = getIngredientFamilies(currentCocktail, ingredientsById);
  const currentRatios = buildIngredientRatioMap(currentCocktail);
  const currentMethods = getMethodIds(currentCocktail);
  const currentId = Number(currentCocktail.id);

  const ranked = cocktails.reduce<CocktailSimilarityResult[]>((acc, candidate) => {
    const candidateId = Number(candidate.id);
    const isSameId = Number.isFinite(currentId) && Number.isFinite(candidateId) && Math.trunc(currentId) === Math.trunc(candidateId);
    const isSameName = normalizeToken(candidate.name) === currentName;
    if (isSameId || isSameName) {
      return acc;
    }

    const candidateTerms = buildNameSynonymSet(candidate);
    const candidateName = normalizeToken(candidate.name);
    const currentSynonyms = new Set([...currentTerms].filter((item) => item !== currentName));
    const candidateSynonyms = new Set([...candidateTerms].filter((item) => item !== candidateName));

    let score = 0;

    const directNameSynonymMatch =
      (currentName && candidateSynonyms.has(currentName)) ||
      (candidateName && currentSynonyms.has(candidateName));
    if (directNameSynonymMatch) {
      score += SYNONYM_NAME_MATCH_SCORE;
    }

    const synonymOverlapCount = overlapSize(currentSynonyms, candidateSynonyms);
    if (synonymOverlapCount > 0) {
      score += SYNONYM_OVERLAP_SCORE + synonymOverlapCount * 12;
    }

    const candidateIngredientIds = getIngredientIds(candidate);
    const ingredientOverlap = overlapSize(currentIngredientIds, candidateIngredientIds);
    if (ingredientOverlap > 0) {
      const ingredientUnion = new Set([...currentIngredientIds, ...candidateIngredientIds]).size || 1;
      score += INGREDIENT_OVERLAP_SCORE * (ingredientOverlap / ingredientUnion);
    }

    const candidateFamilies = getIngredientFamilies(candidate, ingredientsById);
    const familyOverlap = overlapSize(currentFamilies, candidateFamilies);
    if (familyOverlap > 0) {
      const familyUnion = new Set([...currentFamilies, ...candidateFamilies]).size || 1;
      score += INGREDIENT_CATEGORY_SCORE * (familyOverlap / familyUnion);
    }

    const candidateRatios = buildIngredientRatioMap(candidate);
    const ratioSimilarity = computeRatioSimilarity(currentRatios, candidateRatios);
    if (ratioSimilarity > 0) {
      score += RATIO_SIMILARITY_SCORE * ratioSimilarity;
    }

    const candidateMethods = getMethodIds(candidate);
    if (overlapSize(currentMethods, candidateMethods) > 0) {
      score += TECHNIQUE_SCORE;
    }

    if (score <= 0) {
      return acc;
    }

    acc.push({ cocktail: candidate, score });
    return acc;
  }, []);

  return ranked
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return (left.cocktail.name ?? '').localeCompare(right.cocktail.name ?? '');
    })
    .slice(0, limit);
}
