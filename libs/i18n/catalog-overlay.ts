import type { SupportedLocale } from '@/libs/i18n/types';
import type { Cocktail, Ingredient } from '@/providers/inventory-types';

import enGBCatalogOverlay from '@/libs/i18n/locales/catalog/en-GB.json';
import ukUACatalogOverlay from '@/libs/i18n/locales/catalog/uk-UA.json';

type CatalogOverlayDictionary = Record<string, string>;

type CatalogEntity = 'cocktail' | 'ingredient';
type CatalogField = 'name' | 'description' | 'instructions';

const CATALOG_OVERLAYS: Record<SupportedLocale, CatalogOverlayDictionary> = {
  'en-GB': enGBCatalogOverlay,
  'uk-UA': ukUACatalogOverlay,
};

const DEFAULT_LOCALE: SupportedLocale = 'en-GB';

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
  const localizedName = getCatalogFieldTranslation(locale, 'ingredient', ingredient.id, 'name', ingredient.name);
  const localizedDescription = getCatalogFieldTranslation(
    locale,
    'ingredient',
    ingredient.id,
    'description',
    ingredient.description,
  );

  if (localizedName === ingredient.name && localizedDescription === ingredient.description) {
    return ingredient;
  }

  return {
    ...ingredient,
    name: localizedName,
    description: localizedDescription,
  };
}

export function localizeCocktail(cocktail: Cocktail, locale: SupportedLocale): Cocktail {
  const localizedName = getCatalogFieldTranslation(locale, 'cocktail', cocktail.id, 'name', cocktail.name);
  const localizedDescription = getCatalogFieldTranslation(
    locale,
    'cocktail',
    cocktail.id,
    'description',
    cocktail.description,
  );
  const localizedInstructions = getCatalogFieldTranslation(
    locale,
    'cocktail',
    cocktail.id,
    'instructions',
    cocktail.instructions,
  );

  const localizedIngredients = (cocktail.ingredients ?? []).map((ingredient) => {
    const localizedIngredientName = getRecipeIngredientNameTranslation(
      locale,
      cocktail.id,
      ingredient.ingredientId,
      ingredient.name,
    );

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
    !hasIngredientChanges
  ) {
    return cocktail;
  }

  return {
    ...cocktail,
    name: localizedName,
    description: localizedDescription,
    instructions: localizedInstructions,
    ingredients: hasIngredientChanges ? localizedIngredients : cocktail.ingredients,
  };
}

export function localizeIngredients(ingredients: Ingredient[], locale: SupportedLocale): Ingredient[] {
  return ingredients.map((ingredient) => localizeIngredient(ingredient, locale));
}

export function localizeCocktails(cocktails: Cocktail[], locale: SupportedLocale): Cocktail[] {
  return cocktails.map((cocktail) => localizeCocktail(cocktail, locale));
}
