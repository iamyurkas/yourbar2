import { useMemo } from 'react';
import { type Cocktail } from '@/providers/inventory-provider';
import { type IngredientLookup } from '@/libs/ingredient-availability';

export type MyTabListItem =
  | { type: 'cocktail'; key: string; cocktail: Cocktail }
  | { type: 'separator'; key: string }
  | {
      type: 'ingredient-header';
      key: string;
      ingredientId: number;
      name: string;
      photoUri?: string | null;
      tagColor?: string;
      cocktailCount: number;
      isBranded: boolean;
    };

type IngredientOption = {
  id: number;
  name: string;
};

const normalizeIngredientId = (value?: number | string | null): number | undefined => {
  if (value == null) {
    return undefined;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return undefined;
  }

  return Math.trunc(numeric);
};

export function useCocktailTabLogic({
  activeTab,
  allowAllSubstitutes,
  availableIngredientIds,
  filteredCocktails,
  ignoreGarnish,
  ingredientLookup,
  defaultTagColor,
}: {
  activeTab: string;
  allowAllSubstitutes: boolean;
  availableIngredientIds: Set<number>;
  filteredCocktails: Cocktail[];
  ignoreGarnish: boolean;
  ingredientLookup: IngredientLookup;
  defaultTagColor: string;
}) {
  return useMemo(() => {
    if (activeTab !== 'my') {
      return null;
    }

    const resolveNameFromId = (id?: number, fallback?: string): string => {
      if (id == null) {
        return (fallback ?? '').trim();
      }

      const record = ingredientLookup.ingredientById.get(id);
      return (record?.name ?? fallback ?? '').trim();
    };

    const collectIngredientOptions = (
      ingredientId: number | undefined,
      fallbackName: string | undefined,
      allowBase: boolean,
      allowBrand: boolean,
      allowStyle: boolean,
      map: Map<number, string>,
    ) => {
      if (ingredientId == null) {
        return;
      }

      const resolvedName = resolveNameFromId(ingredientId, fallbackName) || 'Unknown ingredient';
      if (!map.has(ingredientId)) {
        map.set(ingredientId, resolvedName);
      }

      const record = ingredientLookup.ingredientById.get(ingredientId);
      const baseId = normalizeIngredientId(record?.baseIngredientId);
      const styleBaseId = normalizeIngredientId(record?.styleIngredientId);
      const allowBrandedForBase = allowBrand || baseId == null;
      const allowStyledForBase = allowStyle || baseId == null;

      if (baseId == null) {
        if (allowBrandedForBase) {
          ingredientLookup.brandsByBaseId.get(ingredientId)?.forEach((brandId) => {
            const brandName = resolveNameFromId(brandId);
            if (brandName) {
              map.set(brandId, brandName);
            }
          });
        }

        if (allowStyledForBase) {
          if (styleBaseId != null) {
            const styleBaseName = resolveNameFromId(styleBaseId);
            if (styleBaseName) {
              map.set(styleBaseId, styleBaseName);
            }

            ingredientLookup.stylesByBaseId.get(styleBaseId)?.forEach((styleId) => {
              if (styleId === ingredientId) {
                return;
              }

              const styleName = resolveNameFromId(styleId);
              if (styleName) {
                map.set(styleId, styleName);
              }
            });
          } else {
            ingredientLookup.stylesByBaseId.get(ingredientId)?.forEach((styleId) => {
              const styleName = resolveNameFromId(styleId);
              if (styleName) {
                map.set(styleId, styleName);
              }
            });
          }
        }
        return;
      }

      if (allowBase) {
        const baseName = resolveNameFromId(baseId);
        if (baseName) {
          map.set(baseId, baseName);
        }
      }

      if (allowBrandedForBase) {
        ingredientLookup.brandsByBaseId.get(baseId)?.forEach((brandId) => {
          const brandName = resolveNameFromId(brandId);
          if (brandName) {
            map.set(brandId, brandName);
          }
        });
      }

      if (allowStyle && styleBaseId != null) {
        const styleBaseName = resolveNameFromId(styleBaseId);
        if (styleBaseName) {
          map.set(styleBaseId, styleBaseName);
        }

        ingredientLookup.stylesByBaseId.get(styleBaseId)?.forEach((styleId) => {
          if (styleId === ingredientId) {
            return;
          }

          const styleName = resolveNameFromId(styleId);
          if (styleName) {
            map.set(styleId, styleName);
          }
        });
      }

    };

    const groups = new Map<
      number,
      {
        name: string;
        photoUri?: string | null;
        tagColor?: string;
        cocktails: Cocktail[];
        keys: Set<string>;
      }
    >();
    const available: Cocktail[] = [];
    const availabilityMap = new Map<string, boolean>();

    filteredCocktails.forEach((cocktail) => {
      const recipe = cocktail.ingredients ?? [];
      const requiredIngredients = recipe.filter(
        (item) => item && !item.optional && !(ignoreGarnish && item.garnish),
      );

      if (requiredIngredients.length === 0) {
        return;
      }

      let missingCount = 0;
      let missingOptions: IngredientOption[] = [];

      requiredIngredients.forEach((ingredient) => {
        const allowBase = Boolean(ingredient.allowBaseSubstitution || allowAllSubstitutes);
        const allowBrand = Boolean(ingredient.allowBrandSubstitution || allowAllSubstitutes);
        const allowStyle = Boolean(ingredient.allowStyleSubstitution || allowAllSubstitutes);
        const candidateMap = new Map<number, string>();
        const requestedId = normalizeIngredientId(ingredient.ingredientId);
        const requestedName = resolveNameFromId(requestedId, ingredient.name ?? undefined);

        collectIngredientOptions(
          requestedId,
          requestedName,
          allowBase,
          allowBrand,
          allowStyle,
          candidateMap,
        );

        (ingredient.substitutes ?? []).forEach((substitute) => {
          const substituteId = normalizeIngredientId(substitute.ingredientId);
          const substituteName = substitute.name ?? requestedName;
          collectIngredientOptions(
            substituteId,
            substituteName,
            allowBase,
            allowBrand,
            allowStyle,
            candidateMap,
          );
        });

        const candidateOptions = Array.from(candidateMap.entries()).map(([id, name]) => ({
          id,
          name,
        }));

        const isSatisfied = candidateOptions.some((option) =>
          availableIngredientIds.has(option.id),
        );

        if (!isSatisfied) {
          missingCount += 1;
          if (missingCount === 1) {
            missingOptions = candidateOptions;
          }
        }
      });

      const cocktailKey = String(cocktail.id ?? cocktail.name);
      if (missingCount === 0) {
        available.push(cocktail);
        availabilityMap.set(cocktailKey, true);
        return;
      }

      availabilityMap.set(cocktailKey, false);

      if (missingCount !== 1) {
        return;
      }

      missingOptions.forEach((option) => {
        if (option.id == null) {
          return;
        }

        const ingredientRecord = ingredientLookup.ingredientById.get(option.id);
        const group = groups.get(option.id) ?? {
          name: option.name,
          photoUri: ingredientRecord?.photoUri ?? null,
          tagColor: ingredientRecord?.tags?.[0]?.color ?? defaultTagColor,
          isBranded: ingredientRecord?.baseIngredientId != null,
          cocktails: [],
          keys: new Set<string>(),
        };

        if (!group.keys.has(cocktailKey)) {
          group.cocktails.push(cocktail);
          group.keys.add(cocktailKey);
        }

        groups.set(option.id, group);
      });
    });

    const sortedGroups = Array.from(groups.entries())
      .map(([ingredientId, group]) => ({
        ingredientId,
        name: group.name,
        photoUri: group.photoUri,
        tagColor: group.tagColor,
        isBranded: group.isBranded,
        cocktails: group.cocktails.sort((a, b) =>
          (a.name ?? '').localeCompare(b.name ?? ''),
        ),
      }))
      .sort((a, b) => {
        if (a.cocktails.length !== b.cocktails.length) {
          return b.cocktails.length - a.cocktails.length;
        }
        return a.name.localeCompare(b.name);
      });

    const items: MyTabListItem[] = [];
    available.forEach((cocktail) => {
      items.push({
        type: 'cocktail',
        key: `cocktail-${cocktail.id ?? cocktail.name}`,
        cocktail,
      });
    });

    if (sortedGroups.length > 0) {
      items.push({ type: 'separator', key: 'more-ingredients-needed' });
      sortedGroups.forEach((group) => {
        items.push({
          type: 'ingredient-header',
          key: `ingredient-${group.ingredientId}`,
          ingredientId: group.ingredientId,
          name: group.name,
          photoUri: group.photoUri,
          tagColor: group.tagColor,
          cocktailCount: group.cocktails.length,
          isBranded: group.isBranded,
        });
        group.cocktails.forEach((cocktail) => {
          items.push({
            type: 'cocktail',
            key: `cocktail-${cocktail.id ?? cocktail.name}-missing-${group.ingredientId}`,
            cocktail,
          });
        });
      });
    }

    return { items, availabilityMap };
  }, [
    activeTab,
    allowAllSubstitutes,
    availableIngredientIds,
    filteredCocktails,
    ignoreGarnish,
    ingredientLookup,
    defaultTagColor,
  ]);
}
