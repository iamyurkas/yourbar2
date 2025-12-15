import type { Cocktail, Ingredient } from '@/providers/inventory-provider';

export type IngredientLookup = {
  ingredientById: Map<number, Ingredient>;
  brandsByBaseId: Map<number, number[]>;
};

export type IngredientAvailabilityOptions = {
  ignoreGarnish?: boolean;
  allowAllSubstitutes?: boolean;
};

export type IngredientSubstituteLists = {
  base: SubstituteOption[];
  branded: SubstituteOption[];
  declared: SubstituteOption[];
};

export type SubstituteOption = {
  id?: number;
  name: string;
};

export type IngredientResolution = {
  resolvedId?: number;
  resolvedName: string;
  resolvedIngredient?: Ingredient;
  substituteFor?: string;
  isAvailable: boolean;
  isConsideredAvailable: boolean;
  missingName?: string;
  substitutes: IngredientSubstituteLists;
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
  const allowAllSubstitutes = options?.allowAllSubstitutes ?? false;

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
      if (ingredient.allowBaseSubstitution || allowAllSubstitutes) {
        candidateIds.add(baseId);
      }

      if (ingredient.allowBrandSubstitution || allowAllSubstitutes) {
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

export function resolveIngredientAvailability(
  ingredient: NonNullable<Cocktail['ingredients']>[number],
  availableIngredientIds: Set<number>,
  lookup: IngredientLookup,
  options?: IngredientAvailabilityOptions,
): IngredientResolution {
  const ignoreGarnish = options?.ignoreGarnish ?? true;
  const allowAllSubstitutes = options?.allowAllSubstitutes ?? false;

  const requestedId = typeof ingredient.ingredientId === 'number' ? ingredient.ingredientId : undefined;
  const requestedIngredient = requestedId != null ? lookup.ingredientById.get(requestedId) : undefined;
  const requestedName = (ingredient.name ?? requestedIngredient?.name ?? '').trim();

  const baseValue = requestedIngredient?.baseIngredientId;
  const baseId =
    baseValue != null && Number.isFinite(baseValue) && baseValue >= 0 ? Math.trunc(Number(baseValue)) : undefined;

  const allowBase = ingredient.allowBaseSubstitution || allowAllSubstitutes;
  const allowBrand = ingredient.allowBrandSubstitution || allowAllSubstitutes;

  const baseSubstituteIds = allowBase && baseId != null ? [baseId] : [];
  const brandedSubstituteSet = new Set<number>();

  if (allowBrand && baseId != null) {
    lookup.brandsByBaseId.get(baseId)?.forEach((id) => {
      if (id !== requestedId) {
        brandedSubstituteSet.add(id);
      }
    });
  }

  if (requestedId != null) {
    lookup.brandsByBaseId.get(requestedId)?.forEach((id) => {
      if (id !== requestedId) {
        brandedSubstituteSet.add(id);
      }
    });
  }

  const brandedSubstituteIds = Array.from(brandedSubstituteSet);
  const declaredSubstituteIds = (ingredient.substitutes ?? [])
    .map((substitute) => {
      if (typeof substitute.ingredientId === 'number') {
        return substitute.ingredientId;
      }

      if (typeof substitute.id === 'number') {
        return substitute.id;
      }

      return undefined;
    })
    .filter((id): id is number => id != null);

  const resolveNameFromId = (id?: number, fallback?: string): string => {
    if (id == null) {
      return (fallback ?? '').trim();
    }

    const record = lookup.ingredientById.get(id);
    return (record?.name ?? fallback ?? '').trim();
  };

  const resolveSubstituteOption = (id?: number, fallback?: string): SubstituteOption => ({
    id,
    name: resolveNameFromId(id, fallback) || 'Unknown ingredient',
  });

  let resolvedId: number | undefined;
  let resolvedName = requestedName;
  let substituteFor: string | undefined;
  let isAvailable = false;
  let resolvedIngredient: Ingredient | undefined;

  const requestedCandidateName = resolveNameFromId(requestedId, requestedName);

  if (requestedId != null && availableIngredientIds.has(requestedId)) {
    resolvedId = requestedId;
    resolvedName = requestedCandidateName;
    resolvedIngredient = requestedIngredient;
    isAvailable = true;
  } else {
    const substitutionOrder = [
      ...baseSubstituteIds.map((id) => ({ id, type: 'base' as const })),
      ...brandedSubstituteIds.map((id) => ({ id, type: 'brand' as const })),
      ...declaredSubstituteIds.map((id) => ({ id, type: 'declared' as const })),
    ];

    for (const candidate of substitutionOrder) {
      if (!availableIngredientIds.has(candidate.id)) {
        continue;
      }

      resolvedId = candidate.id;
      resolvedName = resolveNameFromId(candidate.id, requestedCandidateName);
      resolvedIngredient = lookup.ingredientById.get(candidate.id);
      substituteFor = requestedCandidateName;
      isAvailable = true;
      break;
    }
  }

  const isConsideredAvailable = isAvailable || (ignoreGarnish && Boolean(ingredient.garnish));

  const missingName = isConsideredAvailable ? undefined : requestedCandidateName || undefined;

  const baseSubstitutes = baseSubstituteIds.map((id) => resolveSubstituteOption(id, requestedCandidateName));
  const brandedSubstitutes = brandedSubstituteIds.map((id) => resolveSubstituteOption(id));
  const declaredSubstitutes = (ingredient.substitutes ?? []).map((substitute) =>
    resolveSubstituteOption(
      typeof substitute.ingredientId === 'number'
        ? substitute.ingredientId
        : typeof substitute.id === 'number'
          ? substitute.id
          : undefined,
      substitute.name ?? requestedCandidateName,
    ),
  );

  let substitutes: IngredientSubstituteLists = {
    base: baseSubstitutes,
    branded: brandedSubstitutes,
    declared: declaredSubstitutes,
  };

  if (resolvedId != null && substituteFor == null) {
    substitutes = { base: [], branded: [], declared: [] };
  } else if (resolvedId != null) {
    substitutes = {
      base: baseSubstitutes.filter((option) => option.id !== resolvedId),
      branded: brandedSubstitutes.filter((option) => option.id !== resolvedId),
      declared: declaredSubstitutes.filter((option) => option.id !== resolvedId),
    };
  }

  return {
    resolvedId,
    resolvedName,
    resolvedIngredient,
    substituteFor,
    isAvailable,
    isConsideredAvailable,
    missingName,
    substitutes,
  } satisfies IngredientResolution;
}
