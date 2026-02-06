import { normalizeSearchFields, normalizeSynonyms } from '@/libs/inventory-utils';
import {
  type Cocktail,
  type CreateCocktailInput,
  type CocktailIngredient,
  type CocktailSubstitute,
  type BaseCocktailRecord,
  type CocktailTag
} from '../inventory-types';
import { type InventoryState } from '../persistence/snapshot-logic';

export const USER_CREATED_ID_START = 10000;

export function sanitizeCocktailInput(input: CreateCocktailInput): Partial<BaseCocktailRecord> | undefined {
  const trimmedName = input.name?.trim();
  if (!trimmedName) {
    return undefined;
  }

  const sanitizedIngredients = (input.ingredients ?? [])
    .map((ingredient, index) => {
      const trimmedIngredientName = ingredient.name?.trim();
      if (!trimmedIngredientName) {
        return undefined;
      }

      const normalizedIngredientId =
        ingredient.ingredientId != null ? Number(ingredient.ingredientId) : undefined;
      const ingredientId =
        normalizedIngredientId != null &&
          Number.isFinite(normalizedIngredientId) &&
          normalizedIngredientId >= 0
          ? Math.trunc(normalizedIngredientId)
          : undefined;

      const normalizedUnitId = ingredient.unitId != null ? Number(ingredient.unitId) : undefined;
      const unitId =
        normalizedUnitId != null && Number.isFinite(normalizedUnitId) && normalizedUnitId >= 0
          ? Math.trunc(normalizedUnitId)
          : undefined;

      const amount = ingredient.amount?.trim() || undefined;
      const optional = ingredient.optional ? true : undefined;
      const garnish = ingredient.garnish ? true : undefined;
      const allowBase = ingredient.allowBaseSubstitution ? true : undefined;
      const allowBrand = ingredient.allowBrandSubstitution ? true : undefined;

      const substituteInputs = ingredient.substitutes ?? [];
      const substitutes: CocktailSubstitute[] = [];
      const seenKeys = new Set<string>();

      substituteInputs.forEach((candidate) => {
        const substituteName = candidate?.name?.trim();
        if (!substituteName) {
          return;
        }

        const rawIngredientLink =
          candidate.ingredientId != null ? Number(candidate.ingredientId) : undefined;
        const substituteIngredientId =
          rawIngredientLink != null && Number.isFinite(rawIngredientLink) && rawIngredientLink >= 0
            ? Math.trunc(rawIngredientLink)
            : undefined;

        const key =
          substituteIngredientId != null
            ? `id:${substituteIngredientId}`
            : `name:${substituteName.toLowerCase()}`;
        if (seenKeys.has(key)) {
          return;
        }
        seenKeys.add(key);

        const brand = candidate.brand ? true : undefined;

        substitutes.push({
          ingredientId: substituteIngredientId,
          name: substituteName,
          brand,
        });
      });

      return {
        order: index + 1,
        ingredientId,
        name: trimmedIngredientName,
        amount,
        unitId,
        optional,
        garnish,
        allowBaseSubstitution: allowBase,
        allowBrandSubstitution: allowBrand,
        substitutes: substitutes.length > 0 ? substitutes : undefined,
      } satisfies CocktailIngredient;
    })
    .filter((value): value is CocktailIngredient => Boolean(value));

  if (sanitizedIngredients.length === 0) {
    return undefined;
  }

  const description = input.description?.trim() || undefined;
  const instructions = input.instructions?.trim() || undefined;
  const synonyms = normalizeSynonyms(input.synonyms);
  const photoUri = input.photoUri?.trim() || undefined;
  const glassId = input.glassId?.trim() || undefined;
  const methodIds = input.methodIds
    ? Array.from(new Set(input.methodIds)).filter(Boolean)
    : undefined;

  const tagMap = new Map<number, CocktailTag>();
  (input.tags ?? []).forEach((tag) => {
    const id = Number(tag.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return;
    }

    if (!tagMap.has(id)) {
      tagMap.set(id, { id, name: tag.name, color: tag.color });
    }
  });
  const tags = tagMap.size > 0 ? Array.from(tagMap.values()) : undefined;

  return {
    name: trimmedName,
    description,
    instructions,
    synonyms,
    photoUri,
    glassId,
    methodIds: methodIds && methodIds.length > 0 ? methodIds : undefined,
    tags,
    ingredients: sanitizedIngredients,
  };
}

export function createCocktailAction(
  state: InventoryState,
  input: CreateCocktailInput
): { nextState: InventoryState; created: Cocktail } | undefined {
  const sanitized = sanitizeCocktailInput(input);
  if (!sanitized) {
    return undefined;
  }

  const nextId =
    state.cocktails.reduce((maxId, cocktail) => {
      const id = Number(cocktail.id ?? -1);
      if (!Number.isFinite(id) || id < 0) {
        return maxId;
      }
      return Math.max(maxId, id);
    }, USER_CREATED_ID_START - 1) + 1;

  const candidateRecord = {
    ...sanitized,
    id: nextId,
    ingredients: sanitized.ingredients!.map((ingredient, index) => ({
      ...ingredient,
      order: index + 1,
    })),
  } as BaseCocktailRecord;

  const [normalized] = normalizeSearchFields([candidateRecord]);
  if (!normalized) {
    return undefined;
  }

  const created = normalized as Cocktail;
  const nextCocktails = [...state.cocktails, created].sort((a, b) =>
    a.searchNameNormalized.localeCompare(b.searchNameNormalized),
  );

  return {
    nextState: { ...state, cocktails: nextCocktails },
    created,
  };
}

export function updateCocktailAction(
  state: InventoryState,
  id: number,
  input: CreateCocktailInput
): { nextState: InventoryState; updated: Cocktail } | undefined {
  const targetId = Number(id);
  if (!Number.isFinite(targetId) || targetId < 0) {
    return undefined;
  }

  const existingIndex = state.cocktails.findIndex(
    (cocktail) => Number(cocktail.id ?? -1) === Math.trunc(targetId),
  );
  if (existingIndex < 0) {
    return undefined;
  }

  const sanitized = sanitizeCocktailInput(input);
  if (!sanitized) {
    return undefined;
  }

  const existing = state.cocktails[existingIndex];
  const candidateRecord = {
    ...existing,
    ...sanitized,
    id: existing.id,
    ingredients: sanitized.ingredients!.map((ingredient, index) => ({
      ...ingredient,
      order: index + 1,
    })),
  } as BaseCocktailRecord;

  const [normalized] = normalizeSearchFields([candidateRecord]);
  if (!normalized) {
    return undefined;
  }

  const updated = normalized as Cocktail;
  const nextCocktails = [...state.cocktails];
  nextCocktails.splice(existingIndex, 1, updated);

  const sortedCocktails = nextCocktails.sort((a, b) =>
    a.searchNameNormalized.localeCompare(b.searchNameNormalized),
  );

  return {
    nextState: { ...state, cocktails: sortedCocktails },
    updated,
  };
}

export function deleteCocktailAction(
  state: InventoryState,
  id: number
): { nextState: InventoryState; deleted: Cocktail } | undefined {
  const normalizedId = Number(id);
  if (!Number.isFinite(normalizedId) || normalizedId < 0) {
    return undefined;
  }

  const existingIndex = state.cocktails.findIndex(
    (cocktail) => Number(cocktail.id ?? -1) === normalizedId
  );

  if (existingIndex < 0) {
    return undefined;
  }

  const deleted = state.cocktails[existingIndex];
  const nextCocktails = state.cocktails.filter((_, index) => index !== existingIndex);

  return {
    nextState: { ...state, cocktails: nextCocktails },
    deleted,
  };
}
