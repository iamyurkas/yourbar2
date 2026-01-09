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
  const allowAllSubstitutes = options?.allowAllSubstitutes ?? true;
  const allowBase = ingredient.allowBaseSubstitution || allowAllSubstitutes;
  const allowBrand = ingredient.allowBrandSubstitution || allowAllSubstitutes;

  if (!ingredient || ingredient.optional || (ignoreGarnish && ingredient.garnish)) {
    return true;
  }

  const candidateIds = new Set<number>();

  const id = typeof ingredient.ingredientId === 'number' ? ingredient.ingredientId : undefined;

  if (id != null) {
    collectVisibleIngredientIds(id, lookup, allowBase, allowBrand, candidateIds);
  }

  (ingredient.substitutes ?? []).forEach((substitute) => {
    const substituteId =
      typeof substitute.ingredientId === 'number'
        ? substitute.ingredientId
        : typeof substitute.id === 'number'
          ? substitute.id
          : undefined;
    if (substituteId != null) {
      collectVisibleIngredientIds(substituteId, lookup, allowBase, allowBrand, candidateIds);
    }
  });

  for (const candidateId of candidateIds) {
    if (availableIngredientIds.has(candidateId)) {
      return true;
    }
  }

  return false;
}

function normalizeIngredientId(value?: number | string | null): number | undefined {
  if (value == null) {
    return undefined;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return undefined;
  }

  return Math.trunc(numeric);
}

function collectVisibleIngredientIds(
  ingredientId: number | undefined,
  lookup: IngredientLookup,
  allowBase: boolean,
  allowBrand: boolean,
  accumulator: Set<number>,
) {
  if (ingredientId == null) {
    return;
  }

  accumulator.add(ingredientId);

  const record = lookup.ingredientById.get(ingredientId);
  const baseId = normalizeIngredientId(record?.baseIngredientId);
  const allowBrandedForBase = allowBrand || baseId == null;

  if (baseId == null) {
    if (allowBrandedForBase) {
      lookup.brandsByBaseId.get(ingredientId)?.forEach((id) => accumulator.add(id));
    }
    return;
  }

  if (allowBase) {
    accumulator.add(baseId);
  }

  if (allowBrandedForBase) {
    lookup.brandsByBaseId.get(baseId)?.forEach((id) => accumulator.add(id));
  }
}

export function getVisibleIngredientIdsForCocktail(
  cocktail: Cocktail,
  lookup: IngredientLookup,
  options?: IngredientAvailabilityOptions,
): Set<number> {
  const allowAllSubstitutes = options?.allowAllSubstitutes ?? true;
  const visibleIngredientIds = new Set<number>();

  (cocktail.ingredients ?? []).forEach((ingredient) => {
    const requestedId = normalizeIngredientId(ingredient.ingredientId);
    const allowBase = Boolean(ingredient.allowBaseSubstitution || allowAllSubstitutes);
    const allowBrand = Boolean(ingredient.allowBrandSubstitution || allowAllSubstitutes);

    collectVisibleIngredientIds(requestedId, lookup, allowBase, allowBrand, visibleIngredientIds);

    (ingredient.substitutes ?? []).forEach((substitute) => {
      const substituteId = normalizeIngredientId(
        typeof substitute.ingredientId === 'number' ? substitute.ingredientId : substitute.id,
      );

      collectVisibleIngredientIds(substituteId, lookup, allowBase, allowBrand, visibleIngredientIds);
    });
  });

  return visibleIngredientIds;
}

export function resolveIngredientAvailability(
  ingredient: NonNullable<Cocktail['ingredients']>[number],
  availableIngredientIds: Set<number>,
  lookup: IngredientLookup,
  options?: IngredientAvailabilityOptions,
): IngredientResolution {
  const ignoreGarnish = options?.ignoreGarnish ?? true;
  const allowAllSubstitutes = options?.allowAllSubstitutes ?? true;

  const requestedId = typeof ingredient.ingredientId === 'number' ? ingredient.ingredientId : undefined;
  const requestedIngredient = requestedId != null ? lookup.ingredientById.get(requestedId) : undefined;
  const requestedName = (ingredient.name ?? requestedIngredient?.name ?? '').trim();

  const baseValue = requestedIngredient?.baseIngredientId;
  const baseId =
    baseValue != null && Number.isFinite(baseValue) && baseValue >= 0 ? Math.trunc(Number(baseValue)) : undefined;

  const allowBase = ingredient.allowBaseSubstitution || allowAllSubstitutes;
  const allowBrand = ingredient.allowBrandSubstitution || allowAllSubstitutes;
  const allowBrandedForBase = allowBrand || baseId == null;

  const baseSubstituteIds = allowBase && baseId != null ? [baseId] : [];
  const brandedSubstituteSet = new Set<number>();

  if (allowBrandedForBase && baseId != null) {
    lookup.brandsByBaseId.get(baseId)?.forEach((id) => {
      if (id !== requestedId) {
        brandedSubstituteSet.add(id);
      }
    });
  }

  if (allowBrandedForBase && requestedId != null && baseId == null) {
    lookup.brandsByBaseId.get(requestedId)?.forEach((id) => {
      if (id !== requestedId) {
        brandedSubstituteSet.add(id);
      }
    });
  }

  const brandedSubstituteIds = Array.from(brandedSubstituteSet);
  const declaredSubstituteIds = new Set<number>();

  const expandCandidateIds = (candidateId?: number) => {
    if (candidateId == null) {
      return;
    }

    const addCandidate = (id?: number) => {
      if (id == null || declaredSubstituteIds.has(id)) {
        return;
      }

      declaredSubstituteIds.add(id);
    };

    addCandidate(candidateId);

    const record = lookup.ingredientById.get(candidateId);
    const candidateBaseId = normalizeIngredientId(record?.baseIngredientId);
    const allowBrandedCandidate = allowBrand || candidateBaseId == null;

    if (candidateBaseId == null) {
      if (allowBrandedCandidate) {
        lookup.brandsByBaseId.get(candidateId)?.forEach((id) => addCandidate(id));
      }
      return;
    }

    if (allowBase) {
      addCandidate(candidateBaseId);
    }

    if (allowBrandedCandidate) {
      lookup.brandsByBaseId.get(candidateBaseId)?.forEach((id) => addCandidate(id));
    }
  };

  (ingredient.substitutes ?? []).forEach((substitute) => {
    const substituteId =
      typeof substitute.ingredientId === 'number'
        ? substitute.ingredientId
        : typeof substitute.id === 'number'
          ? substitute.id
          : undefined;

    expandCandidateIds(substituteId);
  });

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
      ...Array.from(declaredSubstituteIds).map((id) => ({ id, type: 'declared' as const })),
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
