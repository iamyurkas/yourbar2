import bundledData from '@/assets/data/data.json';
import type { SupportedLocale } from '@/libs/i18n/types';
import type { CocktailStorageRecord, IngredientStorageRecord, LocalizedCatalogDictionary } from '@/providers/inventory-types';

type BundledCocktail = {
  id?: number | null;
  name?: string | null;
  description?: string | null;
  instructions?: string | null;
  synonyms?: string[] | null;
  ingredients?: Array<{
    ingredientId?: number | null;
    name?: string | null;
  }> | null;
};

type BundledIngredient = {
  id?: number | null;
  name?: string | null;
  description?: string | null;
  synonyms?: string[] | null;
};

const DEFAULT_LOCALE: SupportedLocale = 'en-GB';

const BUNDLED_COCKTAILS_BY_ID = new Map<number, BundledCocktail>();
const BUNDLED_INGREDIENTS_BY_ID = new Map<number, BundledIngredient>();

(bundledData.cocktails as BundledCocktail[]).forEach((cocktail) => {
  const id = Number(cocktail.id ?? -1);
  if (!Number.isFinite(id) || id < 0) {
    return;
  }

  BUNDLED_COCKTAILS_BY_ID.set(Math.trunc(id), cocktail);
});

(bundledData.ingredients as BundledIngredient[]).forEach((ingredient) => {
  const id = Number(ingredient.id ?? -1);
  if (!Number.isFinite(id) || id < 0) {
    return;
  }

  BUNDLED_INGREDIENTS_BY_ID.set(Math.trunc(id), ingredient);
});

function normalizeOptionalText(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeSynonyms(values?: readonly string[] | null): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function areTextEqual(left?: string | null, right?: string | null): boolean {
  return normalizeOptionalText(left) === normalizeOptionalText(right);
}

function areSynonymsEqual(left?: readonly string[] | null, right?: readonly string[] | null): boolean {
  const a = normalizeSynonyms(left);
  const b = normalizeSynonyms(right);

  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
}

function setOverlayValue(
  overlay: LocalizedCatalogDictionary,
  key: string,
  value?: string | null,
) {
  const normalized = value?.trim();
  if (!normalized) {
    return;
  }

  overlay[key] = normalized;
}

export function buildCatalogOverlayFromStorageRecords(input: {
  locale: string;
  cocktails: readonly CocktailStorageRecord[];
  ingredients: readonly IngredientStorageRecord[];
}): LocalizedCatalogDictionary {
  const locale = input.locale;
  if (!locale || locale === DEFAULT_LOCALE) {
    return {};
  }

  const overlay: LocalizedCatalogDictionary = {};

  input.ingredients.forEach((ingredient) => {
    const id = Number(ingredient.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return;
    }

    const normalizedId = Math.trunc(id);
    const bundled = BUNDLED_INGREDIENTS_BY_ID.get(normalizedId);
    if (!bundled) {
      return;
    }

    if (!areTextEqual(ingredient.name, bundled.name)) {
      setOverlayValue(overlay, `ingredient.${normalizedId}.name`, ingredient.name);
    }

    if (!areTextEqual(ingredient.description, bundled.description)) {
      setOverlayValue(overlay, `ingredient.${normalizedId}.description`, ingredient.description);
    }

    if (!areSynonymsEqual(ingredient.synonyms, bundled.synonyms)) {
      setOverlayValue(overlay, `ingredient.${normalizedId}.synonyms`, normalizeSynonyms(ingredient.synonyms).join(', '));
    }
  });

  input.cocktails.forEach((cocktail) => {
    const id = Number(cocktail.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return;
    }

    const normalizedId = Math.trunc(id);
    const bundled = BUNDLED_COCKTAILS_BY_ID.get(normalizedId);
    if (!bundled) {
      return;
    }

    if (!areTextEqual(cocktail.name, bundled.name)) {
      setOverlayValue(overlay, `cocktail.${normalizedId}.name`, cocktail.name);
    }

    if (!areTextEqual(cocktail.description, bundled.description)) {
      setOverlayValue(overlay, `cocktail.${normalizedId}.description`, cocktail.description);
    }

    if (!areTextEqual(cocktail.instructions, bundled.instructions)) {
      setOverlayValue(overlay, `cocktail.${normalizedId}.instructions`, cocktail.instructions);
    }

    if (!areSynonymsEqual(cocktail.synonyms, bundled.synonyms)) {
      setOverlayValue(overlay, `cocktail.${normalizedId}.synonyms`, normalizeSynonyms(cocktail.synonyms).join(', '));
    }

    const bundledIngredientNamesById = new Map<number, string | null | undefined>();
    (bundled.ingredients ?? []).forEach((ingredient) => {
      const ingredientId = Number(ingredient.ingredientId ?? -1);
      if (!Number.isFinite(ingredientId) || ingredientId < 0) {
        return;
      }

      bundledIngredientNamesById.set(Math.trunc(ingredientId), ingredient.name);
    });

    (cocktail.ingredients ?? []).forEach((ingredient) => {
      const ingredientId = Number(ingredient.ingredientId ?? -1);
      if (!Number.isFinite(ingredientId) || ingredientId < 0) {
        return;
      }

      const normalizedIngredientId = Math.trunc(ingredientId);
      const bundledIngredientName = bundledIngredientNamesById.get(normalizedIngredientId);
      if (!areTextEqual(ingredient.name, bundledIngredientName)) {
        setOverlayValue(
          overlay,
          `cocktail.${normalizedId}.ingredient.${normalizedIngredientId}.name`,
          ingredient.name,
        );
      }
    });
  });

  return overlay;
}
