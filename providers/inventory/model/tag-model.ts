import { BUILTIN_COCKTAIL_TAGS } from '@/constants/cocktail-tags';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import {
  type CocktailTag,
  type IngredientTag,
  type Cocktail,
  type Ingredient
} from '../inventory-types';
import { type InventoryState } from '../persistence/snapshot-logic';

export const BUILTIN_COCKTAIL_TAG_MAX = BUILTIN_COCKTAIL_TAGS.reduce((max, tag) => Math.max(max, tag.id), 0);
export const BUILTIN_INGREDIENT_TAG_MAX = BUILTIN_INGREDIENT_TAGS.reduce((max, tag) => Math.max(max, tag.id), 0);

export function getNextCustomTagId(tags: readonly { id?: number | null }[], minimum: number): number {
  const maxId = tags.reduce((max, tag) => {
    const id = Number(tag.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return max;
    }
    return Math.max(max, Math.trunc(id));
  }, minimum);

  return maxId + 1;
}

export function updateCocktailTagInState(state: InventoryState, updated: CocktailTag): InventoryState {
  let didChange = false;
  const nextCocktails = state.cocktails.map((cocktail) => {
    if (!cocktail.tags?.length) {
      return cocktail;
    }

    let didUpdateTag = false;
    const nextTags = cocktail.tags.map((tag) => {
      if (Number(tag.id ?? -1) === updated.id) {
        didUpdateTag = true;
        return { ...tag, name: updated.name, color: updated.color };
      }
      return tag;
    });

    if (!didUpdateTag) {
      return cocktail;
    }

    didChange = true;
    return { ...cocktail, tags: nextTags } as Cocktail;
  });

  return didChange ? { ...state, cocktails: nextCocktails } : state;
}

export function deleteCocktailTagFromState(state: InventoryState, tagId: number): InventoryState {
  let didChange = false;
  const nextCocktails = state.cocktails.map((cocktail) => {
    if (!cocktail.tags?.length) {
      return cocktail;
    }

    const nextTags = cocktail.tags.filter((tag) => Number(tag.id ?? -1) !== Math.trunc(tagId));
    if (nextTags.length !== cocktail.tags.length) {
      didChange = true;
      return { ...cocktail, tags: nextTags.length ? nextTags : undefined } as Cocktail;
    }
    return cocktail;
  });

  return didChange ? { ...state, cocktails: nextCocktails } : state;
}

export function updateIngredientTagInState(state: InventoryState, updated: IngredientTag): InventoryState {
  let didChange = false;
  const nextIngredients = state.ingredients.map((ingredient) => {
    if (!ingredient.tags?.length) {
      return ingredient;
    }

    let didUpdateTag = false;
    const nextTags = ingredient.tags.map((tag) => {
      if (Number(tag.id ?? -1) === updated.id) {
        didUpdateTag = true;
        return { ...tag, name: updated.name, color: updated.color };
      }
      return tag;
    });

    if (!didUpdateTag) {
      return ingredient;
    }

    didChange = true;
    return { ...ingredient, tags: nextTags } as Ingredient;
  });

  return didChange ? { ...state, ingredients: nextIngredients } : state;
}

export function deleteIngredientTagFromState(state: InventoryState, tagId: number): InventoryState {
  let didChange = false;
  const nextIngredients = state.ingredients.map((ingredient) => {
    if (!ingredient.tags?.length) {
      return ingredient;
    }

    const nextTags = ingredient.tags.filter((tag) => Number(tag.id ?? -1) !== Math.trunc(tagId));
    if (nextTags.length !== ingredient.tags.length) {
      didChange = true;
      return { ...ingredient, tags: nextTags.length ? nextTags : undefined } as Ingredient;
    }
    return ingredient;
  });

  return didChange ? { ...state, ingredients: nextIngredients } : state;
}
