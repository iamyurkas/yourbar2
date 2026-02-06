import { normalizeSearchFields } from '@/libs/inventory-utils';
import {
  type Ingredient,
  type CreateIngredientInput,
  type IngredientTag
} from '../inventory-types';
import { type InventoryState } from '../persistence/snapshot-logic';

export const USER_CREATED_ID_START = 10000;

export function sanitizeIngredientInput(input: CreateIngredientInput): Partial<Ingredient> | undefined {
  const trimmedName = input.name?.trim();
  if (!trimmedName) {
    return undefined;
  }

  const normalizedBaseId =
    input.baseIngredientId != null ? Number(input.baseIngredientId) : undefined;
  const baseIngredientId =
    normalizedBaseId != null && Number.isFinite(normalizedBaseId) && normalizedBaseId >= 0
      ? Math.trunc(normalizedBaseId)
      : undefined;

  const description = input.description?.trim() || undefined;
  const photoUri = input.photoUri?.trim() || undefined;

  const tagMap = new Map<number, IngredientTag>();
  (input.tags ?? []).forEach((tag) => {
    const id = Number(tag.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return;
    }

    if (!tagMap.has(id)) {
      tagMap.set(id, {
        id,
        name: tag.name,
        color: tag.color,
      });
    }
  });
  const tags = tagMap.size > 0 ? Array.from(tagMap.values()) : undefined;

  return {
    name: trimmedName,
    description,
    tags,
    baseIngredientId,
    photoUri,
  };
}

export function createIngredientAction(
  state: InventoryState,
  input: CreateIngredientInput
): { nextState: InventoryState; created: Ingredient } | undefined {
  const sanitized = sanitizeIngredientInput(input);
  if (!sanitized) {
    return undefined;
  }

  const nextId =
    state.ingredients.reduce((maxId, ingredient) => {
      const id = Number(ingredient.id ?? -1);
      if (!Number.isFinite(id) || id < 0) {
        return maxId;
      }
      return Math.max(maxId, id);
    }, USER_CREATED_ID_START - 1) + 1;

  const candidateRecord = {
    ...sanitized,
    id: nextId,
  };

  const [normalized] = normalizeSearchFields([candidateRecord]);
  if (!normalized) {
    return undefined;
  }

  const created = normalized as Ingredient;
  const nextIngredients = [...state.ingredients, created].sort((a, b) =>
    a.searchNameNormalized.localeCompare(b.searchNameNormalized),
  );

  return {
    nextState: { ...state, ingredients: nextIngredients },
    created,
  };
}

export function updateIngredientAction(
  state: InventoryState,
  id: number,
  input: CreateIngredientInput
): { nextState: InventoryState; updated: Ingredient } | undefined {
  const normalizedId = Number(id);
  if (!Number.isFinite(normalizedId) || normalizedId < 0) {
    return undefined;
  }

  const ingredientIndex = state.ingredients.findIndex(
    (item) => Number(item.id ?? -1) === normalizedId,
  );

  if (ingredientIndex === -1) {
    return undefined;
  }

  const sanitized = sanitizeIngredientInput(input);
  if (!sanitized) {
    return undefined;
  }

  const previous = state.ingredients[ingredientIndex];
  const candidateRecord = {
    ...previous,
    ...sanitized,
    id: previous.id,
  };

  const [normalized] = normalizeSearchFields([candidateRecord]);
  if (!normalized) {
    return undefined;
  }

  const updated = normalized as Ingredient;
  const nextIngredients = [...state.ingredients];
  nextIngredients[ingredientIndex] = updated;
  nextIngredients.sort((a, b) =>
    a.searchNameNormalized.localeCompare(b.searchNameNormalized),
  );

  return {
    nextState: { ...state, ingredients: nextIngredients },
    updated,
  };
}

export function deleteIngredientAction(
  state: InventoryState,
  id: number
): { nextState: InventoryState; wasRemoved: boolean } {
  const normalizedId = Number(id);
  if (!Number.isFinite(normalizedId) || normalizedId < 0) {
    return { nextState: state, wasRemoved: false };
  }

  let wasRemoved = false;
  let didUpdateDependents = false;

  const nextIngredients = state.ingredients.reduce<Ingredient[]>((acc, ingredient) => {
    const ingredientId = Number(ingredient.id ?? -1);
    if (ingredientId === normalizedId) {
      wasRemoved = true;
      return acc;
    }

    if (
      ingredient.baseIngredientId != null &&
      Number(ingredient.baseIngredientId) === normalizedId
    ) {
      didUpdateDependents = true;
      acc.push({ ...ingredient, baseIngredientId: undefined } satisfies Ingredient);
      return acc;
    }

    acc.push(ingredient);
    return acc;
  }, []);

  if (!wasRemoved) {
    return { nextState: state, wasRemoved: false };
  }

  if (didUpdateDependents) {
    nextIngredients.sort((a, b) =>
      a.searchNameNormalized.localeCompare(b.searchNameNormalized),
    );
  }

  return {
    nextState: { ...state, ingredients: nextIngredients },
    wasRemoved: true,
  };
}

export function clearBaseIngredientAction(
  state: InventoryState,
  id: number
): InventoryState {
  let didChange = false;
  const nextIngredients = state.ingredients.map((ingredient) => {
    if (Number(ingredient.id ?? -1) === id && ingredient.baseIngredientId != null) {
      didChange = true;
      return { ...ingredient, baseIngredientId: undefined } satisfies Ingredient;
    }
    return ingredient;
  });

  if (!didChange) {
    return state;
  }

  return {
    ...state,
    ingredients: nextIngredients,
  };
}
