import { createIngredientLookup } from '@/libs/ingredient-availability';
import { type Cocktail, type Ingredient } from '@/providers/inventory-provider';

export const SIMILAR_COCKTAILS_MIN_SCORE = 0.45;
export const SIMILAR_COCKTAILS_MAX_RESULTS = 10;

export const SIMILARITY_WEIGHT_SYNONYM = 0.45;
export const SIMILARITY_WEIGHT_INGREDIENT_OVERLAP = 0.25;
export const SIMILARITY_WEIGHT_INGREDIENT_CATEGORY = 0.15;
export const SIMILARITY_WEIGHT_AMOUNT_RATIO = 0.1;
export const SIMILARITY_WEIGHT_TECHNIQUE = 0.05;

const MIN_MEANINGFUL_TOKEN_LENGTH = 4;
const MIN_MEANINGFUL_PHRASE_LENGTH = 4;

type CocktailIngredient = NonNullable<Cocktail['ingredients']>[number];

type SimilarityScoreBreakdown = {
  lexical: number;
  ingredientOverlap: number;
  ingredientCategory: number;
  amountRatio: number;
  technique: number;
};

export type SimilarCocktailResult = {
  cocktail: Cocktail;
  score: number;
  breakdown: SimilarityScoreBreakdown;
};

export function normalizeString(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u201A\u201B`´]/g, "'")
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normalizeSynonyms(list?: string[] | null): string[] {
  if (!Array.isArray(list) || list.length === 0) {
    return [];
  }

  return Array.from(
    new Set(
      list
        .map((item) => normalizeString(item ?? ''))
        .filter(Boolean),
    ),
  );
}

function extractPhraseTokens(value: string): string[] {
  return value
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= MIN_MEANINGFUL_TOKEN_LENGTH);
}

function isMeaningfulPhrase(value: string): boolean {
  if (value.length < MIN_MEANINGFUL_PHRASE_LENGTH) {
    return false;
  }

  return extractPhraseTokens(value).length > 0;
}

function resolveLexicalSimilarity(current: Cocktail, candidate: Cocktail): number {
  const currentName = normalizeString(current.name ?? '');
  const candidateName = normalizeString(candidate.name ?? '');
  const currentSynonyms = normalizeSynonyms(current.synonyms);
  const candidateSynonyms = normalizeSynonyms(candidate.synonyms);

  const currentTerms = Array.from(new Set([currentName, ...currentSynonyms].filter(Boolean)));
  const candidateTerms = Array.from(new Set([candidateName, ...candidateSynonyms].filter(Boolean)));

  if (currentTerms.length === 0 || candidateTerms.length === 0) {
    return 0;
  }

  if (currentTerms.some((term) => candidateTerms.includes(term))) {
    return 1;
  }

  const currentInCandidateSynonyms =
    currentName &&
    candidateSynonyms.some((candidateSynonym) => {
      if (!isMeaningfulPhrase(currentName) || !isMeaningfulPhrase(candidateSynonym)) {
        return false;
      }

      return candidateSynonym.includes(currentName);
    });

  if (currentInCandidateSynonyms) {
    return 1;
  }

  const currentSynonymsInCandidate = currentSynonyms.some((currentSynonym) => {
    if (!isMeaningfulPhrase(currentSynonym)) {
      return false;
    }

    if (candidateName.includes(currentSynonym)) {
      return true;
    }

    return candidateSynonyms.some((candidateSynonym) => candidateSynonym.includes(currentSynonym));
  });

  if (currentSynonymsInCandidate) {
    return 0.95;
  }

  const phraseInclusionMatch = currentTerms.some((left) => {
    if (!isMeaningfulPhrase(left)) {
      return false;
    }

    return candidateTerms.some((right) => {
      if (!isMeaningfulPhrase(right)) {
        return false;
      }
      return left.includes(right) || right.includes(left);
    });
  });

  if (phraseInclusionMatch) {
    return 0.85;
  }

  const leftTokenSet = new Set(currentTerms.flatMap(extractPhraseTokens));
  const rightTokenSet = new Set(candidateTerms.flatMap(extractPhraseTokens));
  const overlap = [...leftTokenSet].filter((token) => rightTokenSet.has(token)).length;
  if (overlap === 0) {
    return 0;
  }

  const denominator = leftTokenSet.size + rightTokenSet.size - overlap;
  if (denominator <= 0) {
    return 0;
  }

  return Math.min(0.7, overlap / denominator);
}

function normalizeIngredientId(value?: number | string | null): number | undefined {
  if (value == null) {
    return undefined;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return undefined;
  }

  return Math.trunc(numeric);
}

function getCoreIngredients(cocktail: Cocktail): CocktailIngredient[] {
  return (cocktail.ingredients ?? []).filter((item) => !item.optional && !item.garnish);
}

function getIngredientIdSet(cocktail: Cocktail): Set<number> {
  const result = new Set<number>();
  getCoreIngredients(cocktail).forEach((item) => {
    const ingredientId = normalizeIngredientId(item.ingredientId);
    if (ingredientId != null) {
      result.add(ingredientId);
    }
  });
  return result;
}

function resolveIngredientOverlapSimilarity(current: Cocktail, candidate: Cocktail): number {
  const left = getIngredientIdSet(current);
  const right = getIngredientIdSet(candidate);
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let matches = 0;
  left.forEach((id) => {
    if (right.has(id)) {
      matches += 1;
    }
  });

  return (2 * matches) / (left.size + right.size);
}

function buildIngredientRelationSet(
  recipeIngredient: CocktailIngredient,
  lookup: ReturnType<typeof createIngredientLookup>,
): Set<number> {
  const values = new Set<number>();
  const requestedId = normalizeIngredientId(recipeIngredient.ingredientId);
  if (requestedId != null) {
    values.add(requestedId);
    const ingredientRecord = lookup.ingredientById.get(requestedId);
    const baseId = normalizeIngredientId(ingredientRecord?.baseIngredientId);
    const styleBaseId = normalizeIngredientId(ingredientRecord?.styleIngredientId);
    if (baseId != null) {
      values.add(baseId);
    }
    if (styleBaseId != null) {
      values.add(styleBaseId);
    }
  }

  (recipeIngredient.substitutes ?? []).forEach((substitute) => {
    const substituteId = normalizeIngredientId(substitute.ingredientId);
    if (substituteId != null) {
      values.add(substituteId);
    }
  });

  return values;
}

function resolveIngredientCategorySimilarity(
  current: Cocktail,
  candidate: Cocktail,
  ingredientLookup: ReturnType<typeof createIngredientLookup>,
): number {
  const leftIngredients = getCoreIngredients(current);
  const rightIngredients = getCoreIngredients(candidate);
  if (leftIngredients.length === 0 || rightIngredients.length === 0) {
    return 0;
  }

  const rightIngredientSets = rightIngredients.map((item) => buildIngredientRelationSet(item, ingredientLookup));

  let accumulatedScore = 0;
  leftIngredients.forEach((leftIngredient) => {
    const leftId = normalizeIngredientId(leftIngredient.ingredientId);
    const leftRelations = buildIngredientRelationSet(leftIngredient, ingredientLookup);

    let bestMatch = 0;
    rightIngredientSets.forEach((rightSet) => {
      if (leftId != null && rightSet.has(leftId)) {
        bestMatch = Math.max(bestMatch, 1);
        return;
      }

      const shared = [...leftRelations].filter((id) => rightSet.has(id)).length;
      if (shared > 0) {
        const union = leftRelations.size + rightSet.size - shared;
        if (union > 0) {
          bestMatch = Math.max(bestMatch, 0.75 * (shared / union));
        }
      }
    });

    accumulatedScore += bestMatch;
  });

  return accumulatedScore / leftIngredients.length;
}

function parseAmount(raw?: string | null): number | undefined {
  if (!raw) {
    return undefined;
  }

  const value = Number(raw.trim());
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return value;
}

function resolveAmountRatioSimilarity(current: Cocktail, candidate: Cocktail): number {
  const currentById = new Map<number, number>();
  getCoreIngredients(current).forEach((item) => {
    const ingredientId = normalizeIngredientId(item.ingredientId);
    const amount = parseAmount(item.amount);
    if (ingredientId != null && amount != null) {
      currentById.set(ingredientId, amount);
    }
  });

  const candidateById = new Map<number, number>();
  getCoreIngredients(candidate).forEach((item) => {
    const ingredientId = normalizeIngredientId(item.ingredientId);
    const amount = parseAmount(item.amount);
    if (ingredientId != null && amount != null) {
      candidateById.set(ingredientId, amount);
    }
  });

  const sharedIds = [...currentById.keys()].filter((id) => candidateById.has(id));
  if (sharedIds.length === 0) {
    return 0;
  }

  const score = sharedIds.reduce((sum, ingredientId) => {
    const left = currentById.get(ingredientId) ?? 0;
    const right = candidateById.get(ingredientId) ?? 0;
    const denominator = Math.max(left, right);
    if (denominator <= 0) {
      return sum;
    }

    const normalizedDifference = Math.min(1, Math.abs(left - right) / denominator);
    return sum + (1 - normalizedDifference);
  }, 0);

  return score / sharedIds.length;
}

function resolveTechniqueSimilarity(current: Cocktail, candidate: Cocktail): number {
  const toMethodSet = (cocktail: Cocktail) => {
    const methodIds = Array.isArray(cocktail.methodIds) && cocktail.methodIds.length > 0
      ? cocktail.methodIds
      : cocktail.methodId
        ? [cocktail.methodId]
        : [];

    return new Set(methodIds.filter(Boolean));
  };

  const currentMethods = toMethodSet(current);
  const candidateMethods = toMethodSet(candidate);
  if (currentMethods.size === 0 || candidateMethods.size === 0) {
    return 0;
  }

  return [...currentMethods].some((methodId) => candidateMethods.has(methodId)) ? 1 : 0;
}

function resolveSimilarityScore(
  current: Cocktail,
  candidate: Cocktail,
  ingredientLookup: ReturnType<typeof createIngredientLookup>,
): SimilarCocktailResult {
  const breakdown: SimilarityScoreBreakdown = {
    lexical: resolveLexicalSimilarity(current, candidate),
    ingredientOverlap: resolveIngredientOverlapSimilarity(current, candidate),
    ingredientCategory: resolveIngredientCategorySimilarity(current, candidate, ingredientLookup),
    amountRatio: resolveAmountRatioSimilarity(current, candidate),
    technique: resolveTechniqueSimilarity(current, candidate),
  };

  const score = (
    breakdown.lexical * SIMILARITY_WEIGHT_SYNONYM +
    breakdown.ingredientOverlap * SIMILARITY_WEIGHT_INGREDIENT_OVERLAP +
    breakdown.ingredientCategory * SIMILARITY_WEIGHT_INGREDIENT_CATEGORY +
    breakdown.amountRatio * SIMILARITY_WEIGHT_AMOUNT_RATIO +
    breakdown.technique * SIMILARITY_WEIGHT_TECHNIQUE
  );

  return {
    cocktail: candidate,
    score,
    breakdown,
  };
}

export function getSimilarCocktails(
  current: Cocktail,
  cocktails: Cocktail[],
  ingredients: Ingredient[],
): SimilarCocktailResult[] {
  const currentKey = String(current.id ?? current.name ?? '');
  const ingredientLookup = createIngredientLookup(ingredients);

  return cocktails
    .filter((candidate) => String(candidate.id ?? candidate.name ?? '') !== currentKey)
    .map((candidate) => resolveSimilarityScore(current, candidate, ingredientLookup))
    .filter((result) => result.score >= SIMILAR_COCKTAILS_MIN_SCORE)
    .sort((left, right) => right.score - left.score)
    .slice(0, SIMILAR_COCKTAILS_MAX_RESULTS);
}
