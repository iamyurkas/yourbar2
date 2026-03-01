import bundledData from '@/assets/data/data.json';
import { BUILTIN_COCKTAIL_TAGS } from '@/constants/cocktail-tags';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import { compareGlobalAlphabet } from '@/libs/global-sort';

type RawTag =
  | {
      id?: number | null;
      name?: string | null;
      color?: string | null;
    }
  | number
  | string
  | null
  | undefined;

type RawCocktail = {
  id: number;
  name: string;
  description?: string;
  instructions?: string;
  photoUri?: string;
  glassId?: string;
  methodIds?: string[];
  methodId?: string | null;
  tags?: RawTag[];
  ingredients?: Array<{
    order: number;
    ingredientId?: number;
    name?: string;
    amount?: string;
    unitId?: number;
    optional?: boolean;
    garnish?: boolean;
    allowBaseSubstitution?: boolean;
    allowBrandSubstitution?: boolean;
    allowStyleSubstitution?: boolean;
    substitutes?: Array<{
      ingredientId?: number;
      name?: string;
      brand?: boolean;
    }>;
  }>;
  synonyms?: string[];
  searchName?: string;
  searchTokens?: string[];
};

type RawIngredient = {
  id: number;
  name: string;
  description?: string;
  photoUri?: string;
  baseIngredientId?: number;
  styleIngredientId?: number;
  tags?: RawTag[];
  synonyms?: string[];
  searchName?: string;
  searchTokens?: string[];
};

type RawInventoryData = {
  cocktails: RawCocktail[];
  ingredients: RawIngredient[];
  [key: string]: unknown;
};

type HydratedTag = {
  id: number;
  name: string;
  color: string;
};

export type InventoryData = Omit<RawInventoryData, 'cocktails' | 'ingredients'> & {
  cocktails: Array<Omit<RawCocktail, 'tags'> & { tags?: HydratedTag[] }>;
  ingredients: Array<Omit<RawIngredient, 'tags'> & { tags?: HydratedTag[] }>;
};

let cachedInventoryData: InventoryData | undefined;

const BUILTIN_COCKTAIL_TAGS_BY_ID = new Map(BUILTIN_COCKTAIL_TAGS.map((tag) => [tag.id, tag]));
const BUILTIN_INGREDIENT_TAGS_BY_ID = new Map(BUILTIN_INGREDIENT_TAGS.map((tag) => [tag.id, tag]));

function hydrateTagList(
  tags: readonly RawTag[] | null | undefined,
  lookup: Map<number, { id: number; name: string; color: string }>,
): HydratedTag[] | undefined {
  if (!tags || tags.length === 0) {
    return undefined;
  }

  const resolved = new Map<number, HydratedTag>();

  tags.forEach((tag) => {
    if (tag == null) {
      return;
    }

    if (typeof tag === 'number' || typeof tag === 'string') {
      const id = Number(tag);
      if (!Number.isFinite(id) || id < 0) {
        return;
      }
      const match = lookup.get(Math.trunc(id));
      if (match) {
        resolved.set(match.id, match);
      }
      return;
    }

    const rawId = Number(tag.id ?? -1);
    const normalizedId = Number.isFinite(rawId) && rawId >= 0 ? Math.trunc(rawId) : undefined;
    const builtinMatch = normalizedId != null ? lookup.get(normalizedId) : undefined;
    const name = tag.name?.trim() || builtinMatch?.name;
    const color = tag.color?.trim() || builtinMatch?.color;

    if (!name || !color) {
      return;
    }

    const id = builtinMatch?.id ?? normalizedId;
    if (id == null) {
      return;
    }

    resolved.set(id, { id, name, color });
  });

  const list = Array.from(resolved.values()).sort(
    (a, b) => a.id - b.id || compareGlobalAlphabet(a.name, b.name),
  );
  return list.length > 0 ? list : undefined;
}

function hydrateInventoryTagsFromCode(data: RawInventoryData): InventoryData {
  return {
    ...data,
    cocktails: data.cocktails.map((cocktail) => ({
      ...cocktail,
      tags: hydrateTagList(cocktail.tags, BUILTIN_COCKTAIL_TAGS_BY_ID),
    })),
    ingredients: data.ingredients.map((ingredient) => ({
      ...ingredient,
      tags: hydrateTagList(ingredient.tags, BUILTIN_INGREDIENT_TAGS_BY_ID),
    })),
  };
}

function isRawInventoryData(value: unknown): value is RawInventoryData {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<RawInventoryData>;
  return Array.isArray(candidate.cocktails) && Array.isArray(candidate.ingredients);
}

function normalizeInventoryData(data: unknown): RawInventoryData {
  if (isRawInventoryData(data)) {
    return data;
  }

  if (data && typeof data === 'object' && 'default' in data) {
    const maybeDefault = (data as { default?: unknown }).default;
    if (isRawInventoryData(maybeDefault)) {
      return maybeDefault;
    }
  }

  return bundledData as unknown as RawInventoryData;
}

export function loadInventoryData(): InventoryData {
  if (!cachedInventoryData) {
    cachedInventoryData = hydrateInventoryTagsFromCode(normalizeInventoryData(bundledData));
    if (!cachedInventoryData?.ingredients?.length) {
      cachedInventoryData = reloadInventoryData();
    }
  }

  return cachedInventoryData;
}

export function reloadInventoryData(): InventoryData {
  cachedInventoryData = hydrateInventoryTagsFromCode(
    normalizeInventoryData(require('@/assets/data/data.json')),
  );
  return cachedInventoryData;
}
