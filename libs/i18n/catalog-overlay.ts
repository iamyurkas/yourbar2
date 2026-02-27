import bundledData from '@/assets/data/data.json';
import type { SupportedLocale } from '@/libs/i18n/types';
import { normalizeSearchText } from '@/libs/search-normalization';
import type {
  Cocktail,
  CocktailTranslationOverride,
  Ingredient,
  IngredientTranslationOverride,
  InventoryTranslationOverrides,
} from '@/providers/inventory-types';

import enGBCatalogOverlay from '@/libs/i18n/locales/catalog/en-GB.json';
import enUSCatalogOverlay from '@/libs/i18n/locales/catalog/en-US.json';
import esESCatalogOverlay from '@/libs/i18n/locales/catalog/es-ES.json';
import ukUACatalogOverlay from '@/libs/i18n/locales/catalog/uk-UA.json';

type CatalogOverlayDictionary = Record<string, string>;
type CatalogEntity = 'cocktail' | 'ingredient';
type CatalogField = 'name' | 'description' | 'instructions' | 'synonyms';

const CATALOG_OVERLAYS: Record<SupportedLocale, CatalogOverlayDictionary> = {
  'en-GB': enGBCatalogOverlay,
  'en-US': enUSCatalogOverlay,
  'es-ES': esESCatalogOverlay,
  'uk-UA': ukUACatalogOverlay,
};

const DEFAULT_LOCALE: SupportedLocale = 'en-GB';

function getCatalogOverlayValue(locale: SupportedLocale, key: string): string | undefined {
  return CATALOG_OVERLAYS[locale][key] ?? CATALOG_OVERLAYS[DEFAULT_LOCALE][key];
}

function getCatalogFieldTranslation(
  locale: SupportedLocale,
  entity: CatalogEntity,
  id: number | string | null | undefined,
  field: CatalogField,
): string | undefined {
  const numericId = Number(id ?? -1);
  if (!Number.isFinite(numericId) || numericId < 0) {
    return undefined;
  }

  const key = `${entity}.${Math.trunc(numericId)}.${field}`;
  return getCatalogOverlayValue(locale, key)?.trim() || undefined;
}

function getRecipeIngredientNameTranslation(
  locale: SupportedLocale,
  cocktailId: number | string | null | undefined,
  ingredientId: number | string | null | undefined,
): string | undefined {
  const normalizedCocktailId = Number(cocktailId ?? -1);
  const normalizedIngredientId = Number(ingredientId ?? -1);
  if (
    !Number.isFinite(normalizedCocktailId) ||
    normalizedCocktailId < 0 ||
    !Number.isFinite(normalizedIngredientId) ||
    normalizedIngredientId < 0
  ) {
    return undefined;
  }

  const key = `cocktail.${Math.trunc(normalizedCocktailId)}.ingredient.${Math.trunc(normalizedIngredientId)}.name`;
  return getCatalogOverlayValue(locale, key)?.trim() || undefined;
}

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

function buildLocalizedSearchFields(name?: string | null, synonyms: readonly string[] = []) {
  const normalizedNames = [name ?? '', ...synonyms]
    .map((item) => normalizeSearchText(item))
    .filter(Boolean);

  return {
    searchNameNormalized: normalizedNames.join(' '),
    searchTokensNormalized: Array.from(new Set(normalizedNames.flatMap((item) => item.split(/\s+/).filter(Boolean)))),
  };
}

function getLocaleTranslationOverrides(
  overrides: InventoryTranslationOverrides | undefined,
  locale: SupportedLocale,
) {
  return overrides?.[locale];
}

function getLocalizedText(
  locale: SupportedLocale,
  fallbackLocale: SupportedLocale,
  entity: CatalogEntity,
  id: number | string | null | undefined,
  field: CatalogField,
  baseValue?: string | null,
  localeOverrideValue?: string,
): string | undefined {
  return normalizeOptionalText(localeOverrideValue)
    ?? getCatalogFieldTranslation(locale, entity, id, field)
    ?? getCatalogFieldTranslation(fallbackLocale, entity, id, field)
    ?? normalizeOptionalText(baseValue);
}

function parseSynonymsValue(value?: string): string[] {
  if (!value?.trim()) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(/[,;\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function localizeIngredient(
  ingredient: Ingredient,
  locale: SupportedLocale,
  overrides?: InventoryTranslationOverrides,
  fallbackLocale: SupportedLocale = DEFAULT_LOCALE,
): Ingredient {
  const localeOverrides = getLocaleTranslationOverrides(overrides, locale);
  const entityOverrides = localeOverrides?.ingredients?.[String(ingredient.id ?? '')] as IngredientTranslationOverride | undefined;

  const localizedName = getLocalizedText(
    locale,
    fallbackLocale,
    'ingredient',
    ingredient.id,
    'name',
    ingredient.name,
    entityOverrides?.name,
  );
  const localizedDescription = getLocalizedText(
    locale,
    fallbackLocale,
    'ingredient',
    ingredient.id,
    'description',
    ingredient.description,
    entityOverrides?.description,
  );

  const localizedSynonyms = normalizeSynonymList(ingredient.synonyms);
  const localizedSearch = buildLocalizedSearchFields(localizedName, localizedSynonyms);

  return {
    ...ingredient,
    name: localizedName,
    description: localizedDescription,
    ...(localizedSynonyms.length ? { synonyms: localizedSynonyms } : {}),
    ...localizedSearch,
  };
}

export function localizeCocktail(
  cocktail: Cocktail,
  locale: SupportedLocale,
  overrides?: InventoryTranslationOverrides,
  fallbackLocale: SupportedLocale = DEFAULT_LOCALE,
): Cocktail {
  const localeOverrides = getLocaleTranslationOverrides(overrides, locale);
  const entityOverrides = localeOverrides?.cocktails?.[String(cocktail.id ?? '')] as CocktailTranslationOverride | undefined;

  const localizedName = getLocalizedText(
    locale,
    fallbackLocale,
    'cocktail',
    cocktail.id,
    'name',
    cocktail.name,
    entityOverrides?.name,
  );
  const localizedDescription = getLocalizedText(
    locale,
    fallbackLocale,
    'cocktail',
    cocktail.id,
    'description',
    cocktail.description,
    entityOverrides?.description,
  );
  const localizedInstructions = getLocalizedText(
    locale,
    fallbackLocale,
    'cocktail',
    cocktail.id,
    'instructions',
    cocktail.instructions,
    entityOverrides?.instructions,
  );

  const overrideSynonyms = entityOverrides?.synonyms;
  const localizedSynonyms =
    (overrideSynonyms && overrideSynonyms.length > 0 ? normalizeSynonymList(overrideSynonyms) : undefined)
    ?? parseSynonymsValue(getCatalogFieldTranslation(locale, 'cocktail', cocktail.id, 'synonyms'))
    ?? normalizeSynonymList(cocktail.synonyms);

  const localizedSearch = buildLocalizedSearchFields(localizedName, localizedSynonyms);

  const localizedIngredients = (cocktail.ingredients ?? []).map((ingredient) => {
    const localizedIngredientName =
      getRecipeIngredientNameTranslation(locale, cocktail.id, ingredient.ingredientId)
      ?? getRecipeIngredientNameTranslation(fallbackLocale, cocktail.id, ingredient.ingredientId)
      ?? normalizeOptionalText(ingredient.name);

    return {
      ...ingredient,
      name: localizedIngredientName,
    };
  });

  return {
    ...cocktail,
    name: localizedName,
    description: localizedDescription,
    instructions: localizedInstructions,
    synonyms: localizedSynonyms.length ? localizedSynonyms : cocktail.synonyms,
    ingredients: localizedIngredients,
    ...localizedSearch,
  };
}

export function localizeIngredients(
  ingredients: Ingredient[],
  locale: SupportedLocale,
  overrides?: InventoryTranslationOverrides,
): Ingredient[] {
  return ingredients.map((ingredient) => localizeIngredient(ingredient, locale, overrides));
}

export function localizeCocktails(
  cocktails: Cocktail[],
  locale: SupportedLocale,
  overrides?: InventoryTranslationOverrides,
): Cocktail[] {
  return cocktails.map((cocktail) => localizeCocktail(cocktail, locale, overrides));
}

export function getBundledInventoryData() {
  return bundledData;
}
