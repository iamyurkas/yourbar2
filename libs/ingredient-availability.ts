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

  const candidateIds = collectIngredientCandidateIds(ingredient, lookup, { allowAllSubstitutes });

  for (const candidateId of candidateIds) {
    if (availableIngredientIds.has(candidateId)) {
      return true;
    }
  }

  return false;
}

const normalizeIngredientId = (value?: number | string | null) => {
  const normalized = Number(value ?? -1);
  if (!Number.isFinite(normalized) || normalized < 0) {
    return undefined;
  }

  return Math.trunc(normalized);
};

const expandWithBaseAndBrands = (
  rawId: number | null | undefined,
  lookup: IngredientLookup,
  allowBase: boolean,
  allowBrand: boolean,
): number[] => {
  const resolved: number[] = [];
  const id = normalizeIngredientId(rawId);
  if (id == null) {
    return resolved;
  }

  resolved.push(id);

  const record = lookup.ingredientById.get(id);
  const baseId = normalizeIngredientId(record?.baseIngredientId);
  if (baseId == null) {
    return resolved;
  }

  if (allowBase && !resolved.includes(baseId)) {
    resolved.push(baseId);
  }

  const allowBrandsFromBase = allowBrand || baseId === id;
  if (!allowBrandsFromBase) {
    return resolved;
  }

  lookup.brandsByBaseId.get(baseId)?.forEach((brandId) => {
    if (!resolved.includes(brandId)) {
      resolved.push(brandId);
    }
  });

  return resolved;
};

export function collectIngredientCandidateIds(
  ingredient: NonNullable<Cocktail['ingredients']>[number],
  lookup: IngredientLookup,
  options?: IngredientAvailabilityOptions,
): Set<number> {
  const allowAllSubstitutes = options?.allowAllSubstitutes ?? false;
  const allowBase = ingredient.allowBaseSubstitution || allowAllSubstitutes;
  const allowBrand = ingredient.allowBrandSubstitution || allowAllSubstitutes;
  const candidateIds = new Set<number>();

  const addCandidateIds = (rawId: number | null | undefined) => {
    expandWithBaseAndBrands(rawId, lookup, allowBase, allowBrand).forEach((id) => candidateIds.add(id));
  };

  addCandidateIds(
    typeof ingredient.ingredientId === 'number' ? ingredient.ingredientId : ingredient.ingredientId ?? null,
  );

  (ingredient.substitutes ?? []).forEach((substitute) => {
    addCandidateIds(
      typeof substitute.ingredientId === 'number'
        ? substitute.ingredientId
        : typeof substitute.id === 'number'
          ? substitute.id
          : null,
    );
  });

  return candidateIds;
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
  const allowBrandsFromBase = allowBrand || (baseId != null && requestedId === baseId);

  const baseSubstituteIds = allowBase && baseId != null ? [baseId] : [];
  const brandedSubstituteSet = new Set<number>();

  if (allowBrandsFromBase && baseId != null) {
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
  const declaredSubstituteIds = (() => {
    const declaredSubstitutes = new Set<number>();
    (ingredient.substitutes ?? []).forEach((substitute) => {
      const substituteId =
        typeof substitute.ingredientId === 'number'
          ? substitute.ingredientId
          : typeof substitute.id === 'number'
            ? substitute.id
            : null;

      expandWithBaseAndBrands(substituteId, lookup, allowBase, allowBrand).forEach((id) =>
        declaredSubstitutes.add(id),
      );
    });
    return Array.from(declaredSubstitutes);
  })();

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
  const declaredSubstituteOptions = (() => {
    const options = new Map<number, SubstituteOption>();

    (ingredient.substitutes ?? []).forEach((substitute) => {
      const fallbackName = substitute.name ?? requestedCandidateName;
      const substituteId =
        typeof substitute.ingredientId === 'number'
          ? substitute.ingredientId
          : typeof substitute.id === 'number'
            ? substitute.id
            : null;

      expandWithBaseAndBrands(substituteId, lookup, allowBase, allowBrand).forEach((id) => {
        if (!options.has(id)) {
          options.set(id, resolveSubstituteOption(id, fallbackName));
        }
      });
    });

    return Array.from(options.values());
  })();

  let substitutes: IngredientSubstituteLists = {
    base: baseSubstitutes,
    branded: brandedSubstitutes,
    declared: declaredSubstituteOptions,
  };

  if (resolvedId != null && substituteFor == null) {
    substitutes = { base: [], branded: [], declared: [] };
    } else if (resolvedId != null) {
      substitutes = {
        base: baseSubstitutes.filter((option) => option.id !== resolvedId),
        branded: brandedSubstitutes.filter((option) => option.id !== resolvedId),
        declared: declaredSubstituteOptions.filter((option) => option.id !== resolvedId),
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
