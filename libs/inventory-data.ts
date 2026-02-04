import bundledData from '@/assets/data/data.json';
import { getBuiltinCocktailTags } from '@/constants/cocktail-tags';
import { getBuiltinIngredientTags } from '@/constants/ingredient-tags';

export type InventoryData = typeof bundledData;

let cachedInventoryData: InventoryData | undefined;

type TagLike = {
  id?: number | null;
  name?: string | null;
  color?: string | null;
};

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

  const list = Array.from(resolved.values()).sort((a, b) => a.id - b.id || (a.name ?? "").localeCompare(b.name ?? ""));
  return list.length > 0 ? list : undefined;
}

function hydrateInventoryTagsFromCode(data: InventoryData): InventoryData {
  const cocktailTagsById = new Map(getBuiltinCocktailTags().map((tag) => [tag.id, tag]));
  const ingredientTagsById = new Map(getBuiltinIngredientTags().map((tag) => [tag.id, tag]));

  return {
    ...data,
    cocktails: data.cocktails.map((cocktail) => ({
      ...cocktail,
      tags: hydrateTagList(cocktail.tags, cocktailTagsById),
    })),
    ingredients: data.ingredients.map((ingredient) => ({
      ...ingredient,
      tags: hydrateTagList(ingredient.tags, ingredientTagsById),
    })),
  };
}

function normalizeInventoryData(data: unknown): InventoryData {
  if (data && typeof data === 'object' && 'default' in data) {
    return (data as { default?: InventoryData }).default ?? (data as InventoryData);
  }
  return data as InventoryData;
}

export function loadInventoryData(lang: string = 'en'): InventoryData {
  if (lang === 'en') {
    if (!cachedInventoryData) {
      cachedInventoryData = hydrateInventoryTagsFromCode(normalizeInventoryData(bundledData));
      if (!cachedInventoryData?.ingredients?.length) {
        cachedInventoryData = reloadInventoryData('en');
      }
    }
    return cachedInventoryData;
  }

  return reloadInventoryData(lang);
}

export function reloadInventoryData(lang: string = 'en'): InventoryData {
  const englishData = require('@/assets/data/data.json');
  if (lang === 'en') {
    const hydrated = hydrateInventoryTagsFromCode(normalizeInventoryData(englishData));
    cachedInventoryData = hydrated;
    return hydrated;
  }

  let localizedData;
  try {
    if (lang === 'es') {
      localizedData = require('@/assets/data/data_es.json');
    } else if (lang === 'ua') {
      localizedData = require('@/assets/data/data_ua.json');
    }
  } catch {
    // Fallback to English if file not found or error loading
  }

  if (!localizedData) {
    return hydrateInventoryTagsFromCode(normalizeInventoryData(englishData));
  }

  // Merge localized names/descriptions into englishData
  const merged = {
    ...englishData,
    cocktails: englishData.cocktails.map((ec: any) => {
      const lc = localizedData.cocktails?.find((c: any) => c.id === ec.id);
      if (!lc) return ec;
      return {
        ...ec,
        ...lc,
        ingredients: ec.ingredients?.map((ei: any) => {
          const li = lc.ingredients?.find((i: any) => i.order === ei.order);
          return li ? { ...ei, ...li } : ei;
        }),
      };
    }),
    ingredients: englishData.ingredients.map((ei: any) => {
      const li = localizedData.ingredients?.find((i: any) => i.id === ei.id);
      return li ? { ...ei, ...li } : ei;
    }),
  };

  return hydrateInventoryTagsFromCode(normalizeInventoryData(merged));
}
