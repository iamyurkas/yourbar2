import bundledData from '@/assets/data/data.json';
import { BUILTIN_COCKTAIL_TAGS } from '@/constants/cocktail-tags';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';

export type InventoryData = typeof bundledData;

let cachedInventoryData: InventoryData | undefined;

type TagLike = {
  id?: number | null;
  name?: string | null;
  color?: string | null;
};

const BUILTIN_COCKTAIL_TAGS_BY_ID = new Map(BUILTIN_COCKTAIL_TAGS.map((tag) => [tag.id, tag]));
const BUILTIN_INGREDIENT_TAGS_BY_ID = new Map(BUILTIN_INGREDIENT_TAGS.map((tag) => [tag.id, tag]));

function hydrateTagList(
  tags: readonly (TagLike | number | string | null | undefined)[] | null | undefined,
  lookup: Map<number, { id: number; name: string; color: string }>,
): Array<{ id: number; name: string; color: string }> | undefined {
  if (!tags || tags.length === 0) {
    return undefined;
  }

  const resolved = new Map<number, { id: number; name: string; color: string }>();

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

    if (typeof tag !== 'object') {
      return;
    }

    const rawId = Number(tag.id ?? -1);
    const normalizedId =
      Number.isFinite(rawId) && rawId >= 0 ? Math.trunc(rawId) : undefined;
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

  const list = Array.from(resolved.values()).sort((a, b) => a.id - b.id || a.name.localeCompare(b.name));
  return list.length > 0 ? list : undefined;
}

function hydrateInventoryTagsFromCode(data: InventoryData): InventoryData {
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

function normalizeInventoryData(data: unknown): InventoryData {
  if (data && typeof data === 'object' && 'default' in data) {
    return (data as { default?: InventoryData }).default ?? (data as InventoryData);
  }
  return data as InventoryData;
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
  cachedInventoryData = hydrateInventoryTagsFromCode(normalizeInventoryData(require('@/assets/data/data.json')));
  return cachedInventoryData;
}
