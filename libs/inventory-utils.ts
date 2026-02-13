import { BUILTIN_COCKTAIL_TAGS } from '@/constants/cocktail-tags';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import { buildPhotoBaseName } from '@/libs/photo-utils';
import { normalizeSearchText } from '@/libs/search-normalization';
import {
  type Cocktail,
  type CocktailIngredient,
  type CocktailStorageRecord,
  type CocktailSubstitute,
  type BaseCocktailRecord,
  type InventoryExportData,
  type Ingredient,
  type IngredientStorageRecord,
  type IngredientRecord,
} from '@/providers/inventory-types';
import { type InventoryData } from '@/libs/inventory-data';

export const BUILTIN_COCKTAIL_TAGS_BY_ID = new Map(BUILTIN_COCKTAIL_TAGS.map((tag) => [tag.id, tag]));
export const BUILTIN_INGREDIENT_TAGS_BY_ID = new Map(BUILTIN_INGREDIENT_TAGS.map((tag) => [tag.id, tag]));

export type NormalizedSearchFields = {
  searchNameNormalized: string;
  searchTokensNormalized: string[];
};

export function normalizeSynonyms(values?: string[] | null): string[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  const sanitized = values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (sanitized.length === 0) {
    return undefined;
  }

  const seen = new Set<string>();
  const unique: string[] = [];

  sanitized.forEach((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    unique.push(value);
  });

  return unique.length > 0 ? unique : undefined;
}

export function normalizeSearchFields<
  T extends {
    name?: string | null;
    searchName?: string | null;
    searchTokens?: string[] | null;
    synonyms?: string[] | null;
  },
>(items: readonly T[] = []): (T & NormalizedSearchFields)[] {
  return items.map((item) => {
    const { searchName: _searchName, searchTokens: _searchTokens, ...rest } = item;
    const baseName = item.name ?? '';
    const synonyms = Array.isArray(item.synonyms) ? item.synonyms : [];
    const normalizedNames = [baseName, ...synonyms]
      .map((name) => normalizeSearchText(name ?? ''))
      .filter(Boolean);
    const searchNameNormalized = normalizedNames.join(' ');
    const searchTokensNormalized = Array.from(
      new Set(normalizedNames.flatMap((name) => name.split(/\s+/).filter(Boolean))),
    );

    return {
      ...rest,
      searchNameNormalized,
      searchTokensNormalized,
    } as T & NormalizedSearchFields;
  });
}

export function normalizeTagList<TTag extends { id?: number | null; name?: string | null; color?: string | null }>(
  tags: readonly TTag[] | null | undefined,
): Array<{ id: number; name: string; color?: string | null }> | undefined {
  if (!tags || tags.length === 0) {
    return undefined;
  }

  return tags
    .map((tag) => ({
      id: Number(tag.id ?? -1),
      name: tag.name?.trim() ?? '',
      color: tag.color ?? undefined,
    }))
    .filter((tag) => Number.isFinite(tag.id) && tag.id >= 0 && tag.name)
    .map((tag) => ({
      id: Math.trunc(tag.id),
      name: tag.name,
      color: tag.color,
    }))
    .sort((a, b) => a.id - b.id || a.name.localeCompare(b.name));
}

export function normalizeTagIds<TTag extends { id?: number | null }>(
  tags: readonly TTag[] | null | undefined,
): number[] | undefined {
  if (!tags || tags.length === 0) {
    return undefined;
  }

  const ids = new Set<number>();
  tags.forEach((tag) => {
    const id = Number(tag.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return;
    }
    ids.add(Math.trunc(id));
  });

  const sorted = Array.from(ids).sort((a, b) => a - b);
  return sorted.length > 0 ? sorted : undefined;
}

export function hydrateTagsFromCode(
  tags: readonly number[] | null | undefined,
  lookup: Map<number, { id: number; name: string; color: string }>,
): Array<{ id: number; name: string; color: string }> | undefined {
  if (!tags || tags.length === 0) {
    return undefined;
  }

  const resolved = new Map<number, { id: number; name: string; color: string }>();
  tags.forEach((tagId) => {
    const id = Number(tagId ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return;
    }

    const normalizedId = Math.trunc(id);
    const match = lookup.get(normalizedId);
    if (match) {
      resolved.set(normalizedId, match);
    }
  });

  const list = Array.from(resolved.values()).sort((a, b) => a.id - b.id || a.name.localeCompare(b.name));
  return list.length > 0 ? list : undefined;
}

export function hydrateInventoryTagsFromCode(data: InventoryExportData): InventoryData {
  return {
    ...data,
    cocktails: data.cocktails.map((cocktail) => ({
      ...cocktail,
      tags: hydrateTagsFromCode(cocktail.tags, BUILTIN_COCKTAIL_TAGS_BY_ID),
    })),
    ingredients: data.ingredients.map((ingredient) => ({
      ...ingredient,
      tags: hydrateTagsFromCode(ingredient.tags, BUILTIN_INGREDIENT_TAGS_BY_ID),
    })),
  } as InventoryData;
}

export function normalizeSubstitutes(substitutes: readonly CocktailSubstitute[] | null | undefined): CocktailSubstitute[] | undefined {
  if (!substitutes || substitutes.length === 0) {
    return undefined;
  }

  return substitutes
    .map((substitute) => ({
      ingredientId: substitute.ingredientId != null ? Math.trunc(Number(substitute.ingredientId)) : undefined,
      name: substitute.name,
      brand: substitute.brand,
    }))
    .filter((substitute) => substitute.name && Number.isFinite(Number(substitute.ingredientId ?? -1)));
}

export function normalizeCocktailIngredients(
  ingredients: readonly CocktailIngredient[] | null | undefined,
): CocktailIngredient[] | undefined {
  if (!ingredients || ingredients.length === 0) {
    return undefined;
  }

  return ingredients
    .map((ingredient) => ({
      order: ingredient.order != null ? Math.trunc(Number(ingredient.order)) : undefined,
      ingredientId: ingredient.ingredientId != null ? Math.trunc(Number(ingredient.ingredientId)) : undefined,
      name: ingredient.name,
      amount: ingredient.amount ?? undefined,
      unitId: ingredient.unitId != null ? Math.trunc(Number(ingredient.unitId)) : undefined,
      optional: ingredient.optional ? true : undefined,
      garnish: ingredient.garnish ? true : undefined,
      allowBaseSubstitution: ingredient.allowBaseSubstitution ? true : undefined,
      allowBrandSubstitution: ingredient.allowBrandSubstitution ? true : undefined,
      substitutes: normalizeSubstitutes(ingredient.substitutes),
    }))
    .filter((ingredient) => ingredient.name)
    .sort((a, b) => {
      const orderDelta = (a.order ?? 0) - (b.order ?? 0);
      return orderDelta !== 0 ? orderDelta : a.name.localeCompare(b.name);
    });
}

export function toCocktailStorageRecord(cocktail: Cocktail | BaseCocktailRecord): CocktailStorageRecord {
  const normalizedTags = normalizeTagList(cocktail.tags);
  const normalizedIngredients = normalizeCocktailIngredients(cocktail.ingredients);

  return {
    id: cocktail.id,
    name: cocktail.name,
    synonyms: cocktail.synonyms ?? undefined,
    description: cocktail.description ?? undefined,
    instructions: cocktail.instructions ?? undefined,
    photoUri: cocktail.photoUri ?? undefined,
    glassId: cocktail.glassId ?? undefined,
    methodIds: 'methodIds' in cocktail ? cocktail.methodIds ?? undefined : undefined,
    tags: normalizedTags && normalizedTags.length > 0 ? normalizedTags : undefined,
    ingredients: normalizedIngredients && normalizedIngredients.length > 0 ? normalizedIngredients : undefined,
    createdAt: 'createdAt' in cocktail ? cocktail.createdAt : undefined,
    updatedAt: 'updatedAt' in cocktail ? cocktail.updatedAt : undefined,
  } satisfies CocktailStorageRecord;
}

export function toIngredientStorageRecord(ingredient: Ingredient | IngredientRecord): IngredientStorageRecord {
  const normalizedTags = normalizeTagList(ingredient.tags);

  return {
    id: ingredient.id,
    name: ingredient.name,
    description: ingredient.description ?? undefined,
    tags: normalizedTags && normalizedTags.length > 0 ? normalizedTags : undefined,
    baseIngredientId: ingredient.baseIngredientId ?? undefined,
    photoUri: ingredient.photoUri ?? undefined,
  } satisfies IngredientStorageRecord;
}

export const BACKUP_PHOTO_URI_PATTERN = /\/photos\/(cocktails|ingredients)\/([^/]+)$/;

export type PhotoBackupContext = {
  uri?: string | null;
  category: 'cocktails' | 'ingredients';
  id?: number | string | null;
  name?: string | null;
};

export function normalizePhotoUriForBackup({
  uri,
  category,
  id,
  name,
}: PhotoBackupContext): string | undefined {
  if (!uri) {
    return undefined;
  }

  if (uri.startsWith('assets/')) {
    return uri;
  }

  const match = uri.match(BACKUP_PHOTO_URI_PATTERN);
  if (!match) {
    return uri;
  }

  const baseName = buildPhotoBaseName(id ?? 'photo', name ?? 'photo');
  return `assets/${category}/${baseName}.jpg`;
}

export function areStorageRecordsEqual<TRecord>(left: TRecord, right: TRecord): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
