import type { Cocktail, Ingredient } from '@/providers/inventory-provider';

export type IngredientLookup = {
  ingredientById: Map<number, Ingredient>;
  brandsByBaseId: Map<number, number[]>;
  stylesByBaseId: Map<number, number[]>;
};

export type IngredientAvailabilityOptions = {
  ignoreGarnish?: boolean;
  allowAllSubstitutes?: boolean;
};

export type IngredientSubstituteLists = {
  base: SubstituteOption[];
  branded: SubstituteOption[];
  styled: SubstituteOption[];
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
  resolvedFromType?: 'requested' | 'base' | 'brand' | 'style' | 'declared';
  isAvailable: boolean;
  isConsideredAvailable: boolean;
  missingName?: string;
  substitutes: IngredientSubstituteLists;
};

export function createIngredientLookup(ingredients: Ingredient[]): IngredientLookup {
  const ingredientById = new Map<number, Ingredient>();
  const brandsByBaseId = new Map<number, number[]>();
  const stylesByBaseId = new Map<number, number[]>();

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

    if (baseId != null) {
      const brandedList = brandsByBaseId.get(baseId) ?? [];
      brandedList.push(ingredientId);
      brandsByBaseId.set(baseId, brandedList);
    }

    const styleValue = item.styleIngredientId != null ? Number(item.styleIngredientId) : undefined;
    const styleId =
      styleValue != null && Number.isFinite(styleValue) && styleValue >= 0 ? Math.trunc(styleValue) : undefined;

    if (styleId != null) {
      const styledList = stylesByBaseId.get(styleId) ?? [];
      styledList.push(ingredientId);
      stylesByBaseId.set(styleId, styledList);
    }
  });

  return { ingredientById, brandsByBaseId, stylesByBaseId } satisfies IngredientLookup;
}

export function isRecipeIngredientAvailable(
  ingredient: NonNullable<Cocktail['ingredients']>[number],
  availableIngredientIds: Set<number>,
  lookup: IngredientLookup,
  options?: IngredientAvailabilityOptions,
) {
  const ignoreGarnish = options?.ignoreGarnish ?? true;
  const allowAllSubstitutes = options?.allowAllSubstitutes ?? false;
  const allowBase = ingredient.allowBaseSubstitution || allowAllSubstitutes;
  const allowBrand = ingredient.allowBrandSubstitution || allowAllSubstitutes;
  const allowStyle = ingredient.allowStyleSubstitution || allowAllSubstitutes;

  if (!ingredient || ingredient.optional || (ignoreGarnish && ingredient.garnish)) {
    return true;
  }

  const candidateIds = new Set<number>();

  const id = typeof ingredient.ingredientId === 'number' ? ingredient.ingredientId : undefined;

  if (id != null) {
    collectVisibleIngredientIds(id, lookup, allowBase, allowBrand, allowStyle, candidateIds);
  }

  (ingredient.substitutes ?? []).forEach((substitute) => {
    const substituteId = typeof substitute.ingredientId === 'number' ? substitute.ingredientId : undefined;
    if (substituteId != null) {
      collectVisibleIngredientIds(substituteId, lookup, allowBase, allowBrand, allowStyle, candidateIds);
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


function collectStylesAndBrandsForBase(
  baseId: number,
  lookup: IngredientLookup,
  allowBrand: boolean,
  accumulator: Set<number>,
  skipId?: number,
) {
  const styleIds = lookup.stylesByBaseId.get(baseId) ?? [];

  styleIds.forEach((styleId) => {
    if (styleId !== skipId) {
      accumulator.add(styleId);
    }

    if (allowBrand) {
      lookup.brandsByBaseId.get(styleId)?.forEach((brandId) => {
        if (brandId !== skipId) {
          accumulator.add(brandId);
        }
      });
    }
  });
}

function collectVisibleIngredientIds(
  ingredientId: number | undefined,
  lookup: IngredientLookup,
  allowBase: boolean,
  allowBrand: boolean,
  allowStyle: boolean,
  accumulator: Set<number>,
) {
  if (ingredientId == null) {
    return;
  }

  accumulator.add(ingredientId);

  const record = lookup.ingredientById.get(ingredientId);
  const baseId = normalizeIngredientId(record?.baseIngredientId);
  const styleBaseId = normalizeIngredientId(record?.styleIngredientId);
  const allowBrandedForBase = allowBrand || baseId == null;
  const allowStyledForBase = allowStyle || baseId == null;

  if (baseId == null) {
    if (allowBrandedForBase) {
      lookup.brandsByBaseId.get(ingredientId)?.forEach((id) => accumulator.add(id));
    }

    if (allowStyledForBase) {
      if (styleBaseId != null) {
        accumulator.add(styleBaseId);
        lookup.stylesByBaseId.get(styleBaseId)?.forEach((id) => {
          if (id !== ingredientId) {
            accumulator.add(id);
          }
        });
      } else {
        collectStylesAndBrandsForBase(ingredientId, lookup, allowBrandedForBase, accumulator, ingredientId);
      }
    }

    return;
  }

  if (allowBase) {
    accumulator.add(baseId);
  }

  if (allowBrandedForBase) {
    lookup.brandsByBaseId.get(baseId)?.forEach((id) => accumulator.add(id));
  }

  if (allowStyle) {
    if (styleBaseId != null) {
      accumulator.add(styleBaseId);
      lookup.stylesByBaseId.get(styleBaseId)?.forEach((id) => {
        if (id !== ingredientId) {
          accumulator.add(id);
        }
      });
    }

    collectStylesAndBrandsForBase(baseId, lookup, allowBrandedForBase, accumulator, ingredientId);
  }
}

export function getVisibleIngredientIdsForCocktail(
  cocktail: Cocktail,
  lookup: IngredientLookup,
  options?: IngredientAvailabilityOptions,
): Set<number> {
  const allowAllSubstitutes = options?.allowAllSubstitutes ?? false;
  const visibleIngredientIds = new Set<number>();

  (cocktail.ingredients ?? []).forEach((ingredient) => {
    const requestedId = normalizeIngredientId(ingredient.ingredientId);
    const allowBase = Boolean(ingredient.allowBaseSubstitution || allowAllSubstitutes);
    const allowBrand = Boolean(ingredient.allowBrandSubstitution || allowAllSubstitutes);
    const allowStyle = Boolean(ingredient.allowStyleSubstitution || allowAllSubstitutes);

    collectVisibleIngredientIds(requestedId, lookup, allowBase, allowBrand, allowStyle, visibleIngredientIds);

    (ingredient.substitutes ?? []).forEach((substitute) => {
      const substituteId = normalizeIngredientId(substitute.ingredientId);

      collectVisibleIngredientIds(substituteId, lookup, allowBase, allowBrand, allowStyle, visibleIngredientIds);
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
  const allowAllSubstitutes = options?.allowAllSubstitutes ?? false;

  const requestedId = typeof ingredient.ingredientId === 'number' ? ingredient.ingredientId : undefined;
  const requestedIngredient = requestedId != null ? lookup.ingredientById.get(requestedId) : undefined;
  const requestedName = (ingredient.name ?? requestedIngredient?.name ?? '').trim();

  const baseValue = requestedIngredient?.baseIngredientId;
  const baseId =
    baseValue != null && Number.isFinite(baseValue) && baseValue >= 0 ? Math.trunc(Number(baseValue)) : undefined;

  const allowBase = ingredient.allowBaseSubstitution || allowAllSubstitutes;
  const allowBrand = ingredient.allowBrandSubstitution || allowAllSubstitutes;
  const allowStyle = ingredient.allowStyleSubstitution || allowAllSubstitutes;
  const allowBrandedForBase = allowBrand || baseId == null;
  const allowStyledForBase = allowStyle || baseId == null;

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

  const styleSubstituteSet = new Set<number>();

  if (allowStyledForBase && requestedId != null) {
    const styleBaseId = normalizeIngredientId(requestedIngredient?.styleIngredientId);
    if (styleBaseId != null) {
      styleSubstituteSet.add(styleBaseId);
      lookup.stylesByBaseId.get(styleBaseId)?.forEach((id) => {
        if (id !== requestedId) {
          styleSubstituteSet.add(id);
        }
      });
    } else if (baseId != null) {
      collectStylesAndBrandsForBase(baseId, lookup, allowBrandedForBase, styleSubstituteSet, requestedId);
    } else {
      collectStylesAndBrandsForBase(requestedId, lookup, allowBrandedForBase, styleSubstituteSet, requestedId);
    }
  }

  const brandedSubstituteIds = Array.from(brandedSubstituteSet);
  const styledSubstituteIds = Array.from(styleSubstituteSet);
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
    const candidateStyleBaseId = normalizeIngredientId(record?.styleIngredientId);
    const allowBrandedCandidate = allowBrand || candidateBaseId == null;
    const allowStyledCandidate = allowStyle || candidateBaseId == null;

    if (allowStyledCandidate) {
      if (candidateStyleBaseId != null) {
        addCandidate(candidateStyleBaseId);
        lookup.stylesByBaseId.get(candidateStyleBaseId)?.forEach((id) => {
          if (id !== candidateId) {
            addCandidate(id);
          }
        });
      } else {
        collectStylesAndBrandsForBase(candidateId, lookup, allowBrandedCandidate, declaredSubstituteIds, candidateId);
      }
    }

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

    if (allowStyle) {
      collectStylesAndBrandsForBase(candidateBaseId, lookup, allowBrandedCandidate, declaredSubstituteIds, candidateId);
    }
  };

  (ingredient.substitutes ?? []).forEach((substitute) => {
    const substituteId = typeof substitute.ingredientId === 'number' ? substitute.ingredientId : undefined;

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
  let resolvedFromType: IngredientResolution['resolvedFromType'];
  let isAvailable = false;
  let resolvedIngredient: Ingredient | undefined;

  const requestedCandidateName = resolveNameFromId(requestedId, requestedName);

  if (requestedId != null && availableIngredientIds.has(requestedId)) {
    resolvedId = requestedId;
    resolvedName = requestedCandidateName;
    resolvedIngredient = requestedIngredient;
    resolvedFromType = 'requested';
    isAvailable = true;
  } else {
    const substitutionOrder = [
      ...baseSubstituteIds.map((id) => ({ id, type: 'base' as const })),
      ...brandedSubstituteIds.map((id) => ({ id, type: 'brand' as const })),
      ...styledSubstituteIds.map((id) => ({ id, type: 'style' as const })),
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
      resolvedFromType = candidate.type;
      isAvailable = true;
      break;
    }
  }

  const isConsideredAvailable = isAvailable || (ignoreGarnish && Boolean(ingredient.garnish));

  const missingName = isConsideredAvailable ? undefined : requestedCandidateName || undefined;

  const baseSubstitutes = baseSubstituteIds.map((id) => resolveSubstituteOption(id, requestedCandidateName));
  const brandedSubstitutes = brandedSubstituteIds.map((id) => resolveSubstituteOption(id));
  const styledSubstitutes = styledSubstituteIds.map((id) => resolveSubstituteOption(id));
  const declaredSubstitutes = (ingredient.substitutes ?? []).map((substitute) =>
    resolveSubstituteOption(
      typeof substitute.ingredientId === 'number' ? substitute.ingredientId : undefined,
      substitute.name ?? requestedCandidateName,
    ),
  );

  let substitutes: IngredientSubstituteLists = {
    base: baseSubstitutes,
    branded: brandedSubstitutes,
    styled: styledSubstitutes,
    declared: declaredSubstitutes,
  };

  if (resolvedId != null && substituteFor == null) {
    substitutes = { base: [], branded: [], styled: [], declared: [] };
  } else if (resolvedId != null) {
    substitutes = {
      base: baseSubstitutes.filter((option) => option.id !== resolvedId),
      branded: brandedSubstitutes.filter((option) => option.id !== resolvedId),
      styled: styledSubstitutes.filter((option) => option.id !== resolvedId),
      declared: declaredSubstitutes.filter((option) => option.id !== resolvedId),
    };
  }

  return {
    resolvedId,
    resolvedName,
    resolvedIngredient,
    substituteFor,
    resolvedFromType,
    isAvailable,
    isConsideredAvailable,
    missingName,
    substitutes,
  } satisfies IngredientResolution;
}
