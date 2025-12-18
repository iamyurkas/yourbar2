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

export function getIngredientBaseGroupId(
  rawId: number | string | null | undefined,
  lookup: IngredientLookup,
): number | undefined {
  if (rawId == null) {
    return undefined;
  }

  const numericId = Number(rawId);
  if (!Number.isFinite(numericId) || numericId < 0) {
    return undefined;
  }

  const id = Math.trunc(numericId);
  const record = lookup.ingredientById.get(id);
  const rawBaseId = record?.baseIngredientId;
  const baseId =
    rawBaseId != null && Number.isFinite(Number(rawBaseId)) && Number(rawBaseId) >= 0
      ? Math.trunc(Number(rawBaseId))
      : undefined;

  return baseId ?? id;
}

export function getIngredientCandidateIds(
  ingredient: NonNullable<Cocktail['ingredients']>[number],
  lookup: IngredientLookup,
  options?: IngredientAvailabilityOptions,
): number[] {
  const allowAllSubstitutes = options?.allowAllSubstitutes ?? false;
  const allowBase = ingredient.allowBaseSubstitution || allowAllSubstitutes;
  const allowBrand = ingredient.allowBrandSubstitution || allowAllSubstitutes;

  const seen = new Set<number>();
  const order: number[] = [];

  const addCandidate = (rawId: number | null | undefined) => {
    if (rawId == null) {
      return;
    }

    const numericId = Number(rawId);
    if (!Number.isFinite(numericId) || numericId < 0) {
      return;
    }

    const id = Math.trunc(numericId);
    if (seen.has(id)) {
      return;
    }

    seen.add(id);
    order.push(id);
  };

  const addHierarchy = (rawId: number | null | undefined) => {
    if (rawId == null) {
      return;
    }

    addCandidate(rawId);

    const baseGroupId = getIngredientBaseGroupId(rawId, lookup);

    const rawBaseId = lookup.ingredientById.get(Number(rawId))?.baseIngredientId;
    const baseId =
      rawBaseId != null && Number.isFinite(Number(rawBaseId)) && Number(rawBaseId) >= 0
        ? Math.trunc(Number(rawBaseId))
        : undefined;

    if (allowBase && baseId != null) {
      addCandidate(baseId);
    }

    if (allowBrand && baseGroupId != null) {
      lookup.brandsByBaseId.get(baseGroupId)?.forEach(addCandidate);
    }
  };

  const requestedId = typeof ingredient.ingredientId === 'number' ? ingredient.ingredientId : undefined;
  addHierarchy(requestedId);

  (ingredient.substitutes ?? []).forEach((substitute) => {
    const substituteId =
      typeof substitute.ingredientId === 'number'
        ? substitute.ingredientId
        : typeof substitute.id === 'number'
          ? substitute.id
          : undefined;

    addHierarchy(substituteId);
  });

  return order;
}

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

  const candidateIds = new Set(
    getIngredientCandidateIds(ingredient, lookup, { allowAllSubstitutes, ignoreGarnish }),
  );

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
    const substitutionOrder = getIngredientCandidateIds(ingredient, lookup, {
      allowAllSubstitutes,
      ignoreGarnish,
    });

    for (const candidate of substitutionOrder) {
      if (!availableIngredientIds.has(candidate)) {
        continue;
      }

      resolvedId = candidate;
      resolvedName = resolveNameFromId(candidate, requestedCandidateName);
      resolvedIngredient = lookup.ingredientById.get(candidate);
      substituteFor = requestedCandidateName;
      isAvailable = true;
      break;
    }
  }

  const isConsideredAvailable = isAvailable || (ignoreGarnish && Boolean(ingredient.garnish));

  const missingName = isConsideredAvailable ? undefined : requestedCandidateName || undefined;

  const baseSubstitutes = baseSubstituteIds.map((id) => resolveSubstituteOption(id, requestedCandidateName));
  const brandedSubstitutes = brandedSubstituteIds.map((id) => resolveSubstituteOption(id));
  const declaredSubstitutes: SubstituteOption[] = [];
  const declaredSeen = new Set<string>();
  const addDeclaredOption = (id?: number, fallback?: string) => {
    const option = resolveSubstituteOption(id, fallback);
    const key = option.id != null ? `id:${option.id}` : `name:${option.name.toLowerCase()}`;
    if (declaredSeen.has(key)) {
      return;
    }

    declaredSeen.add(key);
    declaredSubstitutes.push(option);
  };

  (ingredient.substitutes ?? []).forEach((substitute) => {
    const substituteId =
      typeof substitute.ingredientId === 'number'
        ? substitute.ingredientId
        : typeof substitute.id === 'number'
          ? substitute.id
          : undefined;

    addDeclaredOption(substituteId, substitute.name ?? requestedCandidateName);

    const substituteBaseGroupId = getIngredientBaseGroupId(substituteId, lookup);
    const substituteRecord = substituteId != null ? lookup.ingredientById.get(substituteId) : undefined;
    const rawSubstituteBaseId = substituteRecord?.baseIngredientId;
    const substituteBaseId =
      rawSubstituteBaseId != null && Number.isFinite(Number(rawSubstituteBaseId)) && Number(rawSubstituteBaseId) >= 0
        ? Math.trunc(Number(rawSubstituteBaseId))
        : undefined;

    if (allowBase && substituteBaseId != null) {
      addDeclaredOption(substituteBaseId, substituteRecord?.name ?? substitute.name ?? requestedCandidateName);
    }

    if (allowBrand && substituteBaseGroupId != null) {
      lookup.brandsByBaseId
        .get(substituteBaseGroupId)
        ?.forEach((id) => addDeclaredOption(id, lookup.ingredientById.get(id)?.name ?? substitute.name));
    }
  });

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
