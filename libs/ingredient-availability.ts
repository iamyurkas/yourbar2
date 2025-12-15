import type { Cocktail, Ingredient } from '@/providers/inventory-provider';

export type IngredientLookup = {
  ingredientById: Map<number, Ingredient>;
  brandsByBaseId: Map<number, number[]>;
};

export type IngredientAvailabilityOptions = {
  ignoreGarnish?: boolean;
};

export function createIngredientLookup(ingredients: Ingredient[]): IngredientLookup {
  const ingredientById = new Map<number, Ingredient>();
  const brandsByBaseId = new Map<number, number[]>();

  ingredients.forEach((item) => {
    const idValue = Number(item.id ?? -1);
    if (!Number.isFinite(idValue) || idValue < 0) {
      return;
    }

    const ingredientId = Math.trunc(idValue);
    ingredientById.set(ingredientId, item);

    const baseValue = item.baseIngredientId != null ? Number(item.baseIngredientId) : undefined;
    const baseId =
      baseValue != null && Number.isFinite(baseValue) && baseValue >= 0 ? Math.trunc(baseValue) : undefined;

    if (baseId == null) {
      return;
    }

    const brandedList = brandsByBaseId.get(baseId) ?? [];
    brandedList.push(ingredientId);
    brandsByBaseId.set(baseId, brandedList);
  });

  return { ingredientById, brandsByBaseId } satisfies IngredientLookup;
}

export function isRecipeIngredientAvailable(
  ingredient: NonNullable<Cocktail['ingredients']>[number],
  availableIngredientIds: Set<number>,
  lookup: IngredientLookup,
  options?: IngredientAvailabilityOptions,
) {
  const ignoreGarnish = options?.ignoreGarnish ?? true;

  if (!ingredient || ingredient.optional || (ignoreGarnish && ingredient.garnish)) {
    return true;
  }

  const candidateIds = new Set<number>();

  const id = typeof ingredient.ingredientId === 'number' ? ingredient.ingredientId : undefined;

  if (id != null) {
    candidateIds.add(id);

    const record = lookup.ingredientById.get(id);
    const rawBaseId = record?.baseIngredientId != null ? Number(record.baseIngredientId) : undefined;
    const baseId =
      rawBaseId != null && Number.isFinite(rawBaseId) && rawBaseId >= 0 ? Math.trunc(rawBaseId) : undefined;

    if (baseId != null) {
      if (ingredient.allowBaseSubstitution) {
        candidateIds.add(baseId);
      }

      if (ingredient.allowBrandSubstitution) {
        const brandedOptions = lookup.brandsByBaseId.get(baseId);
        brandedOptions?.forEach((brandId) => candidateIds.add(brandId));
      }
    }

    const baseBrandedOptions = lookup.brandsByBaseId.get(id);
    baseBrandedOptions?.forEach((brandId) => candidateIds.add(brandId));
  }

  (ingredient.substitutes ?? []).forEach((substitute) => {
    const substituteId =
      typeof substitute.ingredientId === 'number'
        ? substitute.ingredientId
        : typeof substitute.id === 'number'
          ? substitute.id
          : undefined;
    if (substituteId != null) {
      candidateIds.add(substituteId);
    }
  });

  for (const candidateId of candidateIds) {
    if (availableIngredientIds.has(candidateId)) {
      return true;
    }
  }

  return false;
}
