import { compareGlobalAlphabet } from '@/libs/global-sort';
import { createIngredientLookup, type IngredientLookup } from '@/libs/ingredient-availability';
import type { Cocktail, Ingredient } from '@/providers/inventory-provider';

type SimilarityOptions = {
  threshold?: number;
  maxResults?: number;
  ingredientLookup?: IngredientLookup;
  ingredients?: Ingredient[];
};

type ScoredCocktail = {
  cocktail: Cocktail;
  score: number;
};

const DEFAULT_THRESHOLD = 0.33;
const DEFAULT_MAX_RESULTS = 10;
const MIN_TOKEN_LENGTH = 3;
const GENERIC_SYNONYM_TOKENS = new Set([
  'cocktail',
  'drink',
  'special',
  'sour',
]);

function normalizeComparablePhrase(value?: string | null): string {
  return (value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u2012-\u2015]/g, '-')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function extractComparablePhrases(cocktail: Cocktail): Set<string> {
  const phrases = [cocktail.name ?? '', ...(cocktail.synonyms ?? [])]
    .map((value) => normalizeComparablePhrase(value))
    .filter(Boolean);

  return new Set(phrases);
}

function extractComparableTokens(phrases: Set<string>): Set<string> {
  const tokens = new Set<string>();
  phrases.forEach((phrase) => {
    phrase.split(' ').forEach((token) => {
      if (token.length < MIN_TOKEN_LENGTH || GENERIC_SYNONYM_TOKENS.has(token)) {
        return;
      }
      tokens.add(token);
    });
  });

  return tokens;
}

function resolveIngredientIds(cocktail: Cocktail): Set<number> {
  const ids = new Set<number>();
  (cocktail.ingredients ?? []).forEach((item) => {
    const value = Number(item.ingredientId);
    if (Number.isFinite(value) && value >= 0) {
      ids.add(Math.trunc(value));
    }
  });
  return ids;
}

function resolveIngredientFamilies(ids: Set<number>, lookup: IngredientLookup): Set<number> {
  const families = new Set<number>();

  ids.forEach((ingredientId) => {
    const ingredient = lookup.ingredientById.get(ingredientId);
    const baseId = Number(ingredient?.baseIngredientId);
    const styleId = Number(ingredient?.styleIngredientId);

    if (Number.isFinite(styleId) && styleId >= 0) {
      families.add(Math.trunc(styleId));
      return;
    }

    if (Number.isFinite(baseId) && baseId >= 0) {
      families.add(Math.trunc(baseId));
      return;
    }

    families.add(ingredientId);
  });

  return families;
}

function setOverlapScore<T extends string | number>(left: Set<T>, right: Set<T>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let overlap = 0;
  left.forEach((value) => {
    if (right.has(value)) {
      overlap += 1;
    }
  });

  if (overlap === 0) {
    return 0;
  }

  const union = new Set([...left, ...right]).size;
  return union > 0 ? overlap / union : 0;
}

function parseAmount(amount?: string | null): number | undefined {
  if (!amount) {
    return undefined;
  }

  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function scoreRatioSimilarity(current: Cocktail, other: Cocktail): number {
  const currentByIngredient = new Map<number, number>();
  (current.ingredients ?? []).forEach((item) => {
    const ingredientId = Number(item.ingredientId);
    const amount = parseAmount(item.amount);
    if (Number.isFinite(ingredientId) && ingredientId >= 0 && amount != null) {
      currentByIngredient.set(Math.trunc(ingredientId), amount);
    }
  });

  let comparedCount = 0;
  let closenessSum = 0;

  (other.ingredients ?? []).forEach((item) => {
    const ingredientId = Number(item.ingredientId);
    const currentAmount = Number.isFinite(ingredientId)
      ? currentByIngredient.get(Math.trunc(ingredientId))
      : undefined;
    const otherAmount = parseAmount(item.amount);

    if (currentAmount == null || otherAmount == null) {
      return;
    }

    comparedCount += 1;
    const denominator = Math.max(currentAmount, otherAmount, 0.0001);
    const distance = Math.abs(currentAmount - otherAmount) / denominator;
    closenessSum += Math.max(0, 1 - Math.min(1, distance));
  });

  return comparedCount > 0 ? closenessSum / comparedCount : 0;
}

function resolveMethodIds(cocktail: Cocktail): Set<string> {
  const ids = new Set<string>();

  (cocktail.methodIds ?? []).forEach((methodId) => {
    if (methodId) {
      ids.add(methodId);
    }
  });

  const legacyMethodId = (cocktail as { methodId?: string | null }).methodId;
  if (legacyMethodId) {
    ids.add(legacyMethodId);
  }

  return ids;
}

export function scoreCocktailSimilarity(
  current: Cocktail,
  other: Cocktail,
  ingredientLookup: IngredientLookup,
): number {
  const currentName = normalizeComparablePhrase(current.name);
  const otherName = normalizeComparablePhrase(other.name);
  const currentPhrases = extractComparablePhrases(current);
  const otherPhrases = extractComparablePhrases(other);

  let synonymScore = 0;
  if (currentName && otherPhrases.has(currentName)) {
    synonymScore = Math.max(synonymScore, 1);
  }
  if (otherName && currentPhrases.has(otherName)) {
    synonymScore = Math.max(synonymScore, 0.95);
  }

  const phraseOverlap = setOverlapScore(currentPhrases, otherPhrases);
  if (phraseOverlap > 0) {
    synonymScore = Math.max(synonymScore, 0.9 * phraseOverlap + 0.2);
  }

  const tokenOverlap = setOverlapScore(
    extractComparableTokens(currentPhrases),
    extractComparableTokens(otherPhrases),
  );
  if (tokenOverlap > 0) {
    synonymScore = Math.max(synonymScore, Math.min(0.45, tokenOverlap * 0.45));
  }

  const currentIngredientIds = resolveIngredientIds(current);
  const otherIngredientIds = resolveIngredientIds(other);
  const exactIngredientScore = setOverlapScore(currentIngredientIds, otherIngredientIds);

  const currentFamilies = resolveIngredientFamilies(currentIngredientIds, ingredientLookup);
  const otherFamilies = resolveIngredientFamilies(otherIngredientIds, ingredientLookup);
  const familyScore = setOverlapScore(currentFamilies, otherFamilies);

  const ratioScore = scoreRatioSimilarity(current, other);

  const methodScore = setOverlapScore(resolveMethodIds(current), resolveMethodIds(other));

  const weightedScore =
    synonymScore * 0.55 +
    exactIngredientScore * 0.23 +
    familyScore * 0.1 +
    ratioScore * 0.07 +
    methodScore * 0.05;

  return Math.max(0, Math.min(1, weightedScore));
}

export function getSimilarCocktails(
  current: Cocktail,
  cocktails: Cocktail[],
  options?: SimilarityOptions,
): ScoredCocktail[] {
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
  const maxResults = Math.max(1, Math.min(DEFAULT_MAX_RESULTS, options?.maxResults ?? DEFAULT_MAX_RESULTS));
  const ingredientLookup =
    options?.ingredientLookup ?? createIngredientLookup(options?.ingredients ?? []);

  const currentId = Number(current.id);
  const currentName = normalizeComparablePhrase(current.name);

  return cocktails
    .filter((candidate) => {
      const candidateId = Number(candidate.id);
      if (Number.isFinite(currentId) && Number.isFinite(candidateId)) {
        return Math.trunc(candidateId) !== Math.trunc(currentId);
      }

      return normalizeComparablePhrase(candidate.name) !== currentName;
    })
    .map((candidate) => ({
      cocktail: candidate,
      score: scoreCocktailSimilarity(current, candidate, ingredientLookup),
    }))
    .filter((entry) => entry.score >= threshold)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return compareGlobalAlphabet(left.cocktail.name ?? '', right.cocktail.name ?? '');
    })
    .slice(0, maxResults);
}

export const COCKTAIL_SIMILARITY_THRESHOLD = DEFAULT_THRESHOLD;
