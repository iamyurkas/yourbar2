import { createIngredientLookup } from '@/libs/ingredient-availability';
import type { Cocktail, Ingredient } from '@/providers/inventory-provider';

type ParsedRecipeIngredient = {
  id: number;
  amount?: number;
};

type IngredientRoots = {
  selfId: number;
  styleRootId: number;
  baseRootId: number;
};

export type SimilarCocktailScore = {
  cocktail: Cocktail;
  score: number;
  ingredientMatch: number;
  categorySimilarity: number;
  ratioSimilarity: number;
  techniqueMatch: number;
};

type BuildSimilarCocktailsOptions = {
  cocktail: Cocktail;
  candidates: Cocktail[];
  ingredients: Ingredient[];
  maxResults?: number;
};

const EXACT_MATCH_WEIGHT = 1;
const CLOSE_STYLE_MATCH_WEIGHT = 0.65;
const BASE_MATCH_WEIGHT = 0.35;
const MIN_MEANINGFUL_SCORE = 0.2;
const DEFAULT_MAX_RESULTS = 10;

function normalizeId(value: number | string | undefined | null): number | undefined {
  if (value == null) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function parseRecipeIngredients(cocktail: Cocktail): ParsedRecipeIngredient[] {
  return (cocktail.ingredients ?? []).reduce<ParsedRecipeIngredient[]>((accumulator, entry) => {
      const id = normalizeId(entry.ingredientId);
      if (id == null) {
        return accumulator;
      }

      const parsedAmount = Number(entry.amount);
      const amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined;
      accumulator.push({ id, amount });
      return accumulator;
    }, []);
}

function resolveIngredientRoots(
  ingredientId: number,
  ingredientById: Map<number, Ingredient>,
): IngredientRoots {
  const ingredient = ingredientById.get(ingredientId);
  const styleRootId = normalizeId(ingredient?.styleIngredientId) ?? ingredientId;
  const baseRootId = normalizeId(ingredient?.baseIngredientId) ?? styleRootId;

  return {
    selfId: ingredientId,
    styleRootId,
    baseRootId,
  };
}

function buildIngredientWeights(entries: ParsedRecipeIngredient[]): Map<number, number> {
  const totalAmount = entries.reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
  const fallbackWeight = entries.length > 0 ? 1 / entries.length : 0;
  const weights = new Map<number, number>();

  entries.forEach((entry) => {
    const weight = totalAmount > 0 && entry.amount != null ? entry.amount / totalAmount : fallbackWeight;
    const previous = weights.get(entry.id) ?? 0;
    weights.set(entry.id, previous + weight);
  });

  return weights;
}

function ingredientMatchScore(source: ParsedRecipeIngredient[], candidate: ParsedRecipeIngredient[]): number {
  if (!source.length || !candidate.length) {
    return 0;
  }

  const sourceWeights = buildIngredientWeights(source);
  const candidateWeights = buildIngredientWeights(candidate);
  const allIds = new Set<number>([...sourceWeights.keys(), ...candidateWeights.keys()]);

  let intersectionWeight = 0;
  let unionWeight = 0;

  allIds.forEach((id) => {
    const left = sourceWeights.get(id) ?? 0;
    const right = candidateWeights.get(id) ?? 0;
    intersectionWeight += Math.min(left, right);
    unionWeight += Math.max(left, right);
  });

  if (unionWeight <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, intersectionWeight / unionWeight));
}

function categorySimilarityScore(
  source: ParsedRecipeIngredient[],
  candidate: ParsedRecipeIngredient[],
  ingredientById: Map<number, Ingredient>,
): number {
  if (!source.length || !candidate.length) {
    return 0;
  }

  const candidateRoots = candidate.map((entry) => resolveIngredientRoots(entry.id, ingredientById));
  const sourceWeights = buildIngredientWeights(source);
  let weightedScore = 0;

  source.forEach((entry) => {
    const sourceRoots = resolveIngredientRoots(entry.id, ingredientById);
    let bestMatchScore = 0;

    candidateRoots.forEach((candidateRootsEntry) => {
      if (sourceRoots.selfId === candidateRootsEntry.selfId) {
        bestMatchScore = Math.max(bestMatchScore, EXACT_MATCH_WEIGHT);
        return;
      }

      if (sourceRoots.styleRootId === candidateRootsEntry.styleRootId) {
        bestMatchScore = Math.max(bestMatchScore, CLOSE_STYLE_MATCH_WEIGHT);
        return;
      }

      if (sourceRoots.baseRootId === candidateRootsEntry.baseRootId) {
        bestMatchScore = Math.max(bestMatchScore, BASE_MATCH_WEIGHT);
      }
    });

    const weight = sourceWeights.get(entry.id) ?? 0;
    weightedScore += bestMatchScore * weight;
  });

  return Math.max(0, Math.min(1, weightedScore));
}

function buildRatioByCategory(
  entries: ParsedRecipeIngredient[],
  ingredientById: Map<number, Ingredient>,
): Map<number, number> {
  const measurable = entries.filter((entry) => entry.amount != null && entry.amount > 0);
  const total = measurable.reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
  const ratios = new Map<number, number>();

  if (total <= 0) {
    return ratios;
  }

  measurable.forEach((entry) => {
    const roots = resolveIngredientRoots(entry.id, ingredientById);
    const categoryId = roots.baseRootId;
    const nextValue = (ratios.get(categoryId) ?? 0) + (entry.amount ?? 0) / total;
    ratios.set(categoryId, nextValue);
  });

  return ratios;
}

function ratioSimilarityScore(
  source: ParsedRecipeIngredient[],
  candidate: ParsedRecipeIngredient[],
  ingredientById: Map<number, Ingredient>,
): number {
  const sourceRatios = buildRatioByCategory(source, ingredientById);
  const candidateRatios = buildRatioByCategory(candidate, ingredientById);

  if (!sourceRatios.size || !candidateRatios.size) {
    return 0;
  }

  const categoryIds = new Set<number>([...sourceRatios.keys(), ...candidateRatios.keys()]);
  let totalDistance = 0;
  categoryIds.forEach((id) => {
    totalDistance += Math.abs((sourceRatios.get(id) ?? 0) - (candidateRatios.get(id) ?? 0));
  });

  const normalizedDistance = Math.min(1, totalDistance / 2);
  return 1 - normalizedDistance;
}

function techniqueMatchScore(source: Cocktail, candidate: Cocktail): number {
  const sourceMethods = new Set((source.methodIds ?? []).filter(Boolean));
  const candidateMethods = new Set((candidate.methodIds ?? []).filter(Boolean));
  if (!sourceMethods.size || !candidateMethods.size) {
    return 0;
  }

  for (const method of sourceMethods) {
    if (candidateMethods.has(method)) {
      return 1;
    }
  }

  return 0;
}

function passesCandidateFilter(
  source: ParsedRecipeIngredient[],
  candidate: ParsedRecipeIngredient[],
  ingredientById: Map<number, Ingredient>,
): boolean {
  const sourceIds = new Set(source.map((entry) => entry.id));
  const sharedExact = candidate.reduce(
    (count, entry) => count + (sourceIds.has(entry.id) ? 1 : 0),
    0,
  );
  if (sharedExact >= 2) {
    return true;
  }

  const sourceRoots = source.map((entry) => resolveIngredientRoots(entry.id, ingredientById));
  const candidateRoots = candidate.map((entry) => resolveIngredientRoots(entry.id, ingredientById));

  let sharedBaseCategory = false;
  let meaningfulOverlap = 0;
  for (const sourceRoot of sourceRoots) {
    for (const candidateRoot of candidateRoots) {
      if (sourceRoot.baseRootId === candidateRoot.baseRootId) {
        sharedBaseCategory = true;
      }
      if (
        sourceRoot.styleRootId === candidateRoot.styleRootId ||
        sourceRoot.baseRootId === candidateRoot.baseRootId
      ) {
        meaningfulOverlap += 1;
        break;
      }
    }
  }

  return sharedBaseCategory && meaningfulOverlap >= 1;
}

export function findSimilarCocktails({
  cocktail,
  candidates,
  ingredients,
  maxResults = DEFAULT_MAX_RESULTS,
}: BuildSimilarCocktailsOptions): SimilarCocktailScore[] {
  const lookup = createIngredientLookup(ingredients);
  const ingredientById = lookup.ingredientById;
  const sourceIngredients = parseRecipeIngredients(cocktail);
  const sourceKey = String(cocktail.id ?? cocktail.name ?? '');
  const limit = Math.max(1, maxResults);

  if (!sourceIngredients.length) {
    return [];
  }

  return candidates
    .filter((candidate) => String(candidate.id ?? candidate.name ?? '') !== sourceKey)
    .map((candidate) => {
      const candidateIngredients = parseRecipeIngredients(candidate);
      if (!passesCandidateFilter(sourceIngredients, candidateIngredients, ingredientById)) {
        return undefined;
      }

      const ingredientMatch = ingredientMatchScore(sourceIngredients, candidateIngredients);
      const categorySimilarity = categorySimilarityScore(sourceIngredients, candidateIngredients, ingredientById);
      const ratioSimilarity = ratioSimilarityScore(sourceIngredients, candidateIngredients, ingredientById);
      const techniqueMatch = techniqueMatchScore(cocktail, candidate);
      const score = (0.4 * ingredientMatch)
        + (0.3 * categorySimilarity)
        + (0.2 * ratioSimilarity)
        + (0.1 * techniqueMatch);

      if (score < MIN_MEANINGFUL_SCORE) {
        return undefined;
      }

      return {
        cocktail: candidate,
        score,
        ingredientMatch,
        categorySimilarity,
        ratioSimilarity,
        techniqueMatch,
      } satisfies SimilarCocktailScore;
    })
    .filter((entry): entry is SimilarCocktailScore => entry != null && entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
