import bundledData from '@/assets/data/data.json';
import type { SupportedLocale } from '@/libs/i18n/types';
import { normalizeSearchText } from '@/libs/search-normalization';
import type { Cocktail, Ingredient } from '@/providers/inventory-types';

import enGBCatalogOverlay from '@/libs/i18n/locales/catalog/en-GB.json';
import enUSCatalogOverlay from '@/libs/i18n/locales/catalog/en-US.json';
import ukUACatalogOverlay from '@/libs/i18n/locales/catalog/uk-UA.json';
import esESCatalogOverlay from '@/libs/i18n/locales/catalog/es-ES.json';

type CatalogOverlayDictionary = Record<string, string>;

type CatalogEntity = 'cocktail' | 'ingredient';
type CatalogField = 'name' | 'description' | 'instructions' | 'synonyms';

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

const CATALOG_OVERLAYS: Record<SupportedLocale, CatalogOverlayDictionary> = {
  'en-GB': enGBCatalogOverlay,
  'en-US': enUSCatalogOverlay,
  'uk-UA': ukUACatalogOverlay,
  'es-ES': esESCatalogOverlay,
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

function normalizeSynonymList(values?: readonly string[] | null): string[] {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function areOptionalTextsEqual(left?: string | null, right?: string | null): boolean {
  return normalizeOptionalText(left) === normalizeOptionalText(right);
}

function shouldApplyLocalizedValue(current?: string | null, bundled?: string | null): boolean {
  if (bundled == null) {
    return true;
  }

  return areOptionalTextsEqual(current, bundled);
}

function shouldApplyLocalizedSynonyms(current?: readonly string[] | null, bundled?: readonly string[] | null): boolean {
  const normalizedCurrent = normalizeSynonymList(current);
  const normalizedBundled = normalizeSynonymList(bundled);
  return areArraysEqual(normalizedCurrent, normalizedBundled);
}

function getCatalogOverlayValue(locale: SupportedLocale, key: string): string | undefined {
  return CATALOG_OVERLAYS[locale][key] ?? CATALOG_OVERLAYS[DEFAULT_LOCALE][key];
}

export function getCatalogFieldTranslation(
  locale: SupportedLocale,
  entity: CatalogEntity,
  id: number | string | null | undefined,
  field: CatalogField,
  fallback?: string | null,
): string | undefined {
  const numericId = Number(id ?? -1);
  if (!Number.isFinite(numericId) || numericId < 0) {
    return fallback?.trim() || undefined;
  }

  const key = `${entity}.${Math.trunc(numericId)}.${field}`;
  return getCatalogOverlayValue(locale, key)?.trim() || fallback?.trim() || undefined;
}

export function getRecipeIngredientNameTranslation(
  locale: SupportedLocale,
  cocktailId: number | string | null | undefined,
  ingredientId: number | string | null | undefined,
  fallback?: string | null,
): string | undefined {
  const normalizedCocktailId = Number(cocktailId ?? -1);
  const normalizedIngredientId = Number(ingredientId ?? -1);
  if (
    !Number.isFinite(normalizedCocktailId) ||
    normalizedCocktailId < 0 ||
    !Number.isFinite(normalizedIngredientId) ||
    normalizedIngredientId < 0
  ) {
    return fallback?.trim() || undefined;
  }

  const key = `cocktail.${Math.trunc(normalizedCocktailId)}.ingredient.${Math.trunc(normalizedIngredientId)}.name`;
  return getCatalogOverlayValue(locale, key)?.trim() || fallback?.trim() || undefined;
}

export function localizeIngredient(ingredient: Ingredient, locale: SupportedLocale): Ingredient {
  const fallbackSynonyms =
    'synonyms' in ingredient && Array.isArray(ingredient.synonyms)
      ? ingredient.synonyms.filter((item): item is string => typeof item === 'string')
      : undefined;

  const ingredientId = Number(ingredient.id ?? -1);
  const bundledIngredient =
    Number.isFinite(ingredientId) && ingredientId >= 0
      ? BUNDLED_INGREDIENTS_BY_ID.get(Math.trunc(ingredientId))
      : undefined;

  const useLocalizedName = shouldApplyLocalizedValue(ingredient.name, bundledIngredient?.name);
  const useLocalizedDescription = shouldApplyLocalizedValue(ingredient.description, bundledIngredient?.description);
  const useLocalizedSynonyms = shouldApplyLocalizedSynonyms(fallbackSynonyms, bundledIngredient?.synonyms);

  const localizedName = useLocalizedName
    ? getCatalogFieldTranslation(locale, 'ingredient', ingredient.id, 'name', ingredient.name)
    : ingredient.name;
  const localizedDescription = useLocalizedDescription
    ? getCatalogFieldTranslation(
        locale,
        'ingredient',
        ingredient.id,
        'description',
        ingredient.description,
      )
    : ingredient.description;
  const localizedSynonyms = useLocalizedSynonyms
    ? getLocalizedSynonyms(
        getCatalogFieldTranslation(locale, 'ingredient', ingredient.id, 'synonyms'),
        fallbackSynonyms,
      )
    : getLocalizedSynonyms(undefined, fallbackSynonyms);

  const localizedSearch = buildLocalizedSearchFields(localizedName, localizedSynonyms);

  if (
    localizedName === ingredient.name &&
    localizedDescription === ingredient.description &&
    localizedSearch.searchNameNormalized === ingredient.searchNameNormalized &&
    areArraysEqual(localizedSearch.searchTokensNormalized, ingredient.searchTokensNormalized)
  ) {
    return ingredient;
  }

  return {
    ...ingredient,
    name: localizedName,
    description: localizedDescription,
    ...(localizedSynonyms.length ? { synonyms: localizedSynonyms } : {}),
    ...localizedSearch,
  };
}

export function localizeCocktail(cocktail: Cocktail, locale: SupportedLocale): Cocktail {
  const fallbackSynonyms = Array.isArray(cocktail.synonyms)
    ? cocktail.synonyms.filter((item): item is string => typeof item === 'string')
    : undefined;

  const cocktailId = Number(cocktail.id ?? -1);
  const bundledCocktail =
    Number.isFinite(cocktailId) && cocktailId >= 0
      ? BUNDLED_COCKTAILS_BY_ID.get(Math.trunc(cocktailId))
      : undefined;

  const useLocalizedName = shouldApplyLocalizedValue(cocktail.name, bundledCocktail?.name);
  const useLocalizedDescription = shouldApplyLocalizedValue(cocktail.description, bundledCocktail?.description);
  const useLocalizedInstructions = shouldApplyLocalizedValue(cocktail.instructions, bundledCocktail?.instructions);
  const useLocalizedSynonyms = shouldApplyLocalizedSynonyms(fallbackSynonyms, bundledCocktail?.synonyms);

  const localizedName = useLocalizedName
    ? getCatalogFieldTranslation(locale, 'cocktail', cocktail.id, 'name', cocktail.name)
    : cocktail.name;
  const localizedDescription = useLocalizedDescription
    ? getCatalogFieldTranslation(
        locale,
        'cocktail',
        cocktail.id,
        'description',
        cocktail.description,
      )
    : cocktail.description;
  const localizedInstructions = useLocalizedInstructions
    ? getCatalogFieldTranslation(
        locale,
        'cocktail',
        cocktail.id,
        'instructions',
        cocktail.instructions,
      )
    : cocktail.instructions;
  const localizedSynonyms = useLocalizedSynonyms
    ? getLocalizedSynonyms(
        getCatalogFieldTranslation(locale, 'cocktail', cocktail.id, 'synonyms'),
        fallbackSynonyms,
      )
    : getLocalizedSynonyms(undefined, fallbackSynonyms);
  const localizedSearch = buildLocalizedSearchFields(localizedName, localizedSynonyms);

  const bundledIngredientNamesById = new Map<number, string | null | undefined>();
  (bundledCocktail?.ingredients ?? []).forEach((ingredient) => {
    const ingredientId = Number(ingredient.ingredientId ?? -1);
    if (!Number.isFinite(ingredientId) || ingredientId < 0) {
      return;
    }

    bundledIngredientNamesById.set(Math.trunc(ingredientId), ingredient.name);
  });

  const localizedIngredients = (cocktail.ingredients ?? []).map((ingredient) => {
    const normalizedIngredientId = Number(ingredient.ingredientId ?? -1);
    const bundledIngredientName =
      Number.isFinite(normalizedIngredientId) && normalizedIngredientId >= 0
        ? bundledIngredientNamesById.get(Math.trunc(normalizedIngredientId))
        : undefined;

    const useLocalizedIngredientName = shouldApplyLocalizedValue(ingredient.name, bundledIngredientName);
    const localizedIngredientName = useLocalizedIngredientName
      ? getRecipeIngredientNameTranslation(
          locale,
          cocktail.id,
          ingredient.ingredientId,
          ingredient.name,
        )
      : ingredient.name;

    if (localizedIngredientName === ingredient.name) {
      return ingredient;
    }

    return {
      ...ingredient,
      name: localizedIngredientName,
    };
  });

  const hasIngredientChanges = localizedIngredients.some((item, index) => item !== (cocktail.ingredients ?? [])[index]);

  if (
    localizedName === cocktail.name &&
    localizedDescription === cocktail.description &&
    localizedInstructions === cocktail.instructions &&
    areArraysEqual(localizedSynonyms, fallbackSynonyms ?? []) &&
    localizedSearch.searchNameNormalized === cocktail.searchNameNormalized &&
    areArraysEqual(localizedSearch.searchTokensNormalized, cocktail.searchTokensNormalized) &&
    !hasIngredientChanges
  ) {
    return cocktail;
  }

  return {
    ...cocktail,
    name: localizedName,
    description: localizedDescription,
    instructions: localizedInstructions,
    synonyms: localizedSynonyms.length ? localizedSynonyms : cocktail.synonyms,
    ingredients: hasIngredientChanges ? localizedIngredients : cocktail.ingredients,
    ...localizedSearch,
  };
}

function getLocalizedSynonyms(localizedValue?: string, fallback: readonly string[] = []): string[] {
  const base = localizedValue?.trim()
    ? localizedValue
        .split(/[,;\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [...fallback];

  return Array.from(new Set(base));
}

function buildLocalizedSearchFields(name?: string | null, synonyms: readonly string[] = []) {
  const normalizedNames = [name ?? '', ...synonyms]
    .map((item) => normalizeSearchText(item))
    .filter(Boolean);

  return {
    searchNameNormalized: normalizedNames.join(' '),
    searchTokensNormalized: Array.from(new Set(normalizedNames.flatMap((item) => item.split(/\s+/).filter(Boolean)))),
  };
}

function areArraysEqual(values: readonly string[] = [], other: readonly string[] = []): boolean {
  if (values.length !== other.length) {
    return false;
  }

  return values.every((value, index) => value === other[index]);
}

export function localizeIngredients(ingredients: Ingredient[], locale: SupportedLocale): Ingredient[] {
  return ingredients.map((ingredient) => localizeIngredient(ingredient, locale));
}

export function localizeCocktails(cocktails: Cocktail[], locale: SupportedLocale): Cocktail[] {
  return cocktails.map((cocktail) => localizeCocktail(cocktail, locale));
}
