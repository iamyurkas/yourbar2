import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { loadInventorySnapshot, persistInventorySnapshot } from '@/libs/inventory-storage';

type InventoryData = typeof import('@/assets/data/data.json');

let cachedInventoryData: InventoryData | undefined;

function loadInventoryData(): InventoryData {
  if (!cachedInventoryData) {
    cachedInventoryData = require('@/assets/data/data.json');
  }

  return cachedInventoryData!;
}

type CocktailRecord = InventoryData['cocktails'][number];
type IngredientRecord = InventoryData['ingredients'][number];
type CocktailIngredientRecord = NonNullable<
  NonNullable<CocktailRecord['ingredients']>[number]
> & { allowSubstitutes?: boolean };
type CocktailSubstituteRecord = NonNullable<CocktailIngredientRecord['substitutes']>[number];

type NormalizedSearchFields = {
  searchNameNormalized: string;
  searchTokensNormalized: string[];
};

type Cocktail = CocktailRecord & NormalizedSearchFields & { userRating?: number };
type Ingredient = IngredientRecord & NormalizedSearchFields;

type InventoryContextValue = {
  cocktails: Cocktail[];
  ingredients: Ingredient[];
  loading: boolean;
  availableIngredientIds: Set<number>;
  shoppingIngredientIds: Set<number>;
  setIngredientAvailability: (id: number, available: boolean) => void;
  toggleIngredientAvailability: (id: number) => void;
  toggleIngredientShopping: (id: number) => void;
  clearBaseIngredient: (id: number) => void;
  createCocktail: (input: CreateCocktailInput) => Cocktail | undefined;
  createIngredient: (input: CreateIngredientInput) => Ingredient | undefined;
  updateIngredient: (id: number, input: CreateIngredientInput) => Ingredient | undefined;
  deleteIngredient: (id: number) => boolean;
  cocktailRatings: Record<string, number>;
  setCocktailRating: (cocktail: Cocktail, rating: number) => void;
  getCocktailRating: (cocktail: Cocktail) => number;
};

type InventoryState = {
  cocktails: Cocktail[];
  ingredients: Ingredient[];
  imported: boolean;
};

type IngredientTag = NonNullable<IngredientRecord['tags']>[number];
type CocktailTag = NonNullable<CocktailRecord['tags']>[number];

type CreateCocktailIngredientInput = {
  name: string;
  ingredientId?: number | null;
  amount?: string | null;
  unitId?: number | null;
  garnish?: boolean | null;
  optional?: boolean | null;
  allowSubstitutes?: boolean | null;
  substitutes?: { id?: number | null; name: string }[] | null;
};

type CreateCocktailInput = {
  name: string;
  glassId?: string | null;
  description?: string | null;
  instructions?: string | null;
  photoUri?: string | null;
  tags?: CocktailTag[] | null;
  ingredients: CreateCocktailIngredientInput[];
};

type CreateIngredientInput = {
  name: string;
  description?: string | null;
  photoUri?: string | null;
  baseIngredientId?: number | null;
  tags?: IngredientTag[] | null;
};

type InventorySnapshot = {
  version: number;
  cocktails: Cocktail[];
  ingredients: Ingredient[];
  imported?: boolean;
  availableIngredientIds?: number[];
  shoppingIngredientIds?: number[];
  cocktailRatings?: Record<string, number>;
};

const INVENTORY_SNAPSHOT_VERSION = 1;

declare global {
  // eslint-disable-next-line no-var
  var __yourbarInventory: InventoryState | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryAvailableIngredientIds: Set<number> | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryShoppingIngredientIds: Set<number> | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryCocktailRatings: Record<string, number> | undefined;
}

function normalizeSearchFields<T extends { name?: string | null; searchName?: string | null; searchTokens?: string[] | null }>(
  items: readonly T[] = [],
): (T & NormalizedSearchFields)[] {
  return items.map((item) => {
    const baseName = item.searchName ?? item.name ?? '';
    const searchNameNormalized = baseName.toLowerCase();
    const searchTokensNormalized = (item.searchTokens && item.searchTokens.length > 0
      ? item.searchTokens
      : searchNameNormalized.split(/\s+/)
    )
      .map((token) => token.toLowerCase())
      .filter(Boolean);

    return {
      ...item,
      searchNameNormalized,
      searchTokensNormalized,
    };
  });
}

function createInventoryStateFromData(data: InventoryData, imported: boolean): InventoryState {
  return {
    cocktails: normalizeSearchFields(data.cocktails) as Cocktail[],
    ingredients: normalizeSearchFields(data.ingredients) as Ingredient[],
    imported,
  } satisfies InventoryState;
}

function createInventoryStateFromSnapshot(snapshot: InventorySnapshot): InventoryState {
  return {
    cocktails: normalizeSearchFields(snapshot.cocktails) as Cocktail[],
    ingredients: normalizeSearchFields(snapshot.ingredients) as Ingredient[],
    imported: Boolean(snapshot.imported),
  } satisfies InventoryState;
}

function toSortedArray(values: Iterable<number>): number[] {
  const sanitized = Array.from(values)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.trunc(value));

  return Array.from(new Set(sanitized)).sort((a, b) => a - b);
}

function sanitizeCocktailRatings(
  ratings?: Record<string, number> | null | undefined,
): Record<string, number> {
  if (!ratings) {
    return {};
  }

  const sanitized: Record<string, number> = {};
  Object.entries(ratings).forEach(([key, value]) => {
    const normalized = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    if (normalized > 0) {
      sanitized[key] = normalized;
    }
  });
  return sanitized;
}

function createIngredientIdSet(values?: readonly number[] | null): Set<number> {
  if (!values || values.length === 0) {
    return new Set<number>();
  }

  const sanitized = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.trunc(value));

  return new Set(sanitized);
}

function createSnapshotFromInventory(
  state: InventoryState,
  options: {
    availableIngredientIds: Set<number>;
    shoppingIngredientIds: Set<number>;
    cocktailRatings: Record<string, number>;
  },
): InventorySnapshot {
  const sanitizedRatings = sanitizeCocktailRatings(options.cocktailRatings);

  return {
    version: INVENTORY_SNAPSHOT_VERSION,
    cocktails: state.cocktails,
    ingredients: state.ingredients,
    imported: state.imported,
    availableIngredientIds:
      options.availableIngredientIds.size > 0
        ? toSortedArray(options.availableIngredientIds)
        : undefined,
    shoppingIngredientIds:
      options.shoppingIngredientIds.size > 0
        ? toSortedArray(options.shoppingIngredientIds)
        : undefined,
    cocktailRatings: Object.keys(sanitizedRatings).length > 0 ? sanitizedRatings : undefined,
  } satisfies InventorySnapshot;
}

const InventoryContext = createContext<InventoryContextValue | undefined>(undefined);

type InventoryProviderProps = {
  children: React.ReactNode;
};

export function InventoryProvider({ children }: InventoryProviderProps) {
  const [inventoryState, setInventoryState] = useState<InventoryState | undefined>(
    () => globalThis.__yourbarInventory,
  );
  const [loading, setLoading] = useState<boolean>(() => !globalThis.__yourbarInventory);
  const [availableIngredientIds, setAvailableIngredientIds] = useState<Set<number>>(() =>
    globalThis.__yourbarInventoryAvailableIngredientIds
      ? new Set(globalThis.__yourbarInventoryAvailableIngredientIds)
      : new Set(),
  );
  const [shoppingIngredientIds, setShoppingIngredientIds] = useState<Set<number>>(() =>
    globalThis.__yourbarInventoryShoppingIngredientIds
      ? new Set(globalThis.__yourbarInventoryShoppingIngredientIds)
      : new Set(),
  );
  const [cocktailRatings, setCocktailRatings] = useState<Record<string, number>>(() =>
    sanitizeCocktailRatings(globalThis.__yourbarInventoryCocktailRatings),
  );
  const lastPersistedSnapshot = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (inventoryState) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const stored = await loadInventorySnapshot<Cocktail, Ingredient>();
        if (stored && stored.version === INVENTORY_SNAPSHOT_VERSION && !cancelled) {
          const nextInventoryState = createInventoryStateFromSnapshot(stored);
          const nextAvailableIds = createIngredientIdSet(stored.availableIngredientIds);
          const nextShoppingIds = createIngredientIdSet(stored.shoppingIngredientIds);
          const nextRatings = sanitizeCocktailRatings(stored.cocktailRatings);

          setInventoryState(nextInventoryState);
          setAvailableIngredientIds(nextAvailableIds);
          setShoppingIngredientIds(nextShoppingIds);
          setCocktailRatings(nextRatings);
          return;
        }
      } catch (error) {
        console.error('Failed to load inventory snapshot', error);
      }

      try {
        const data = loadInventoryData();
        if (!cancelled) {
          setInventoryState(createInventoryStateFromData(data, true));
          setAvailableIngredientIds(new Set());
          setShoppingIngredientIds(new Set());
          setCocktailRatings({});
        }
      } catch (error) {
        console.error('Failed to import bundled inventory', error);
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inventoryState]);

  useEffect(() => {
    if (!inventoryState) {
      return;
    }

    setLoading(false);
    globalThis.__yourbarInventory = inventoryState;
    globalThis.__yourbarInventoryAvailableIngredientIds = availableIngredientIds;
    globalThis.__yourbarInventoryShoppingIngredientIds = shoppingIngredientIds;
    globalThis.__yourbarInventoryCocktailRatings = cocktailRatings;

    const snapshot = createSnapshotFromInventory(inventoryState, {
      availableIngredientIds,
      shoppingIngredientIds,
      cocktailRatings,
    });
    const serialized = JSON.stringify(snapshot);

    if (lastPersistedSnapshot.current === serialized) {
      return;
    }

    lastPersistedSnapshot.current = serialized;

    void persistInventorySnapshot(snapshot).catch((error) => {
      console.error('Failed to persist inventory snapshot', error);
    });
  }, [inventoryState, availableIngredientIds, shoppingIngredientIds, cocktailRatings]);

  const cocktails = inventoryState?.cocktails ?? [];
  const ingredients = inventoryState?.ingredients ?? [];

  const resolveCocktailKey = useCallback((cocktail: Cocktail) => {
    const id = cocktail.id;
    if (id != null) {
      return String(id);
    }

    if (cocktail.name) {
      return cocktail.name.trim().toLowerCase();
    }

    return undefined;
  }, []);

  const setCocktailRating = useCallback(
    (cocktail: Cocktail, rating: number) => {
      const key = resolveCocktailKey(cocktail);
      if (!key) {
        return;
      }

      setCocktailRatings((prev) => {
        const normalizedRating = Math.max(0, Math.min(5, Math.round(rating)));

        if (normalizedRating <= 0) {
          if (!(key in prev)) {
            return prev;
          }

          const next = { ...prev };
          delete next[key];
          return next;
        }

        if (prev[key] === normalizedRating) {
          return prev;
        }

        return { ...prev, [key]: normalizedRating };
      });
    },
    [resolveCocktailKey],
  );

  const getCocktailRating = useCallback(
    (cocktail: Cocktail) => {
      const key = resolveCocktailKey(cocktail);
      if (!key) {
        return 0;
      }

      const rating = cocktailRatings[key];
      if (rating == null) {
        return 0;
      }

      return Math.max(0, Math.min(5, Number(rating) || 0));
    },
    [cocktailRatings, resolveCocktailKey],
  );

  const cocktailsWithRatings = useMemo(() => {
    return cocktails.map((cocktail) => {
      const key = resolveCocktailKey(cocktail);
      if (!key) {
        return cocktail;
      }

      const rating = cocktailRatings[key];
      if (rating == null) {
        return cocktail;
      }

      return {
        ...cocktail,
        userRating: rating,
      } satisfies Cocktail;
    });
  }, [cocktailRatings, cocktails, resolveCocktailKey]);

  const setIngredientAvailability = useCallback((id: number, available: boolean) => {
    setAvailableIngredientIds((prev) => {
      const next = new Set(prev);
      if (available) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const createCocktail = useCallback(
    (input: CreateCocktailInput) => {
      let created: Cocktail | undefined;

      setInventoryState((prev) => {
        if (!prev) {
          return prev;
        }

        const trimmedName = input.name?.trim();
        if (!trimmedName) {
          return prev;
        }

        const ingredientById = new Map<number, Ingredient>();
        const ingredientByName = new Map<string, Ingredient>();
        prev.ingredients.forEach((item) => {
          const idValue = Number(item.id ?? -1);
          if (Number.isFinite(idValue) && idValue >= 0) {
            ingredientById.set(idValue, item);
          }

          if (item.name) {
            ingredientByName.set(item.name.toLowerCase(), item);
          }
        });

        const sanitizedIngredients: CocktailIngredientRecord[] = [];

        (input.ingredients ?? []).forEach((ingredientInput) => {
          const rawName = ingredientInput.name ?? '';
          const trimmedIngredientName = rawName.trim();
          if (!trimmedIngredientName) {
            return;
          }

          const normalizedIngredientName = trimmedIngredientName.toLowerCase();

          let resolvedIngredient: Ingredient | undefined;
          if (ingredientInput.ingredientId != null) {
            const candidateId = Number(ingredientInput.ingredientId);
            if (Number.isFinite(candidateId) && candidateId >= 0) {
              resolvedIngredient = ingredientById.get(candidateId);
            }
          }

          if (!resolvedIngredient) {
            resolvedIngredient = ingredientByName.get(normalizedIngredientName);
          }

          const resolvedIngredientId = resolvedIngredient?.id;
          const ingredientId =
            resolvedIngredientId != null && Number.isFinite(Number(resolvedIngredientId))
              ? Math.trunc(Number(resolvedIngredientId))
              : undefined;

          const ingredientName = resolvedIngredient?.name ?? trimmedIngredientName;

          const amountValue = ingredientInput.amount != null ? String(ingredientInput.amount) : '';
          const trimmedAmount = amountValue.trim();

          const normalizedUnit = ingredientInput.unitId != null ? Number(ingredientInput.unitId) : undefined;
          const unitId =
            normalizedUnit != null && Number.isFinite(normalizedUnit) && normalizedUnit >= 0
              ? Math.trunc(normalizedUnit)
              : undefined;

          const substituteIdSet = new Set<number>();
          const substituteNameSet = new Set<string>();
          const substitutes: CocktailSubstituteRecord[] = [];

          (ingredientInput.substitutes ?? []).forEach((substitute) => {
            const substituteName = substitute?.name?.trim();
            if (!substituteName) {
              return;
            }

            const normalizedSubstituteName = substituteName.toLowerCase();

            let resolvedSubstitute: Ingredient | undefined;
            if (substitute?.id != null) {
              const candidateId = Number(substitute.id);
              if (Number.isFinite(candidateId) && candidateId >= 0) {
                resolvedSubstitute = ingredientById.get(candidateId);
              }
            }

            if (!resolvedSubstitute) {
              resolvedSubstitute = ingredientByName.get(normalizedSubstituteName);
            }

            const substituteId = resolvedSubstitute?.id;
            if (substituteId != null && Number.isFinite(Number(substituteId))) {
              const normalizedId = Math.trunc(Number(substituteId));
              if (substituteIdSet.has(normalizedId)) {
                return;
              }

              substituteIdSet.add(normalizedId);
              substitutes.push({
                id: normalizedId,
                name: resolvedSubstitute?.name ?? substituteName,
              });
              return;
            }

            if (substituteNameSet.has(normalizedSubstituteName)) {
              return;
            }

            substituteNameSet.add(normalizedSubstituteName);
            substitutes.push({ name: substituteName } as CocktailSubstituteRecord);
          });

          const normalizedIngredient: CocktailIngredientRecord = {
            order: sanitizedIngredients.length + 1,
            ingredientId,
            name: ingredientName,
            amount: trimmedAmount || undefined,
            unitId,
            garnish: ingredientInput.garnish ? true : undefined,
            optional: ingredientInput.optional ? true : undefined,
            allowSubstitutes: ingredientInput.allowSubstitutes ? true : undefined,
            substitutes: substitutes.length > 0 ? substitutes : undefined,
          } satisfies CocktailIngredientRecord;

          sanitizedIngredients.push(normalizedIngredient);
        });

        if (sanitizedIngredients.length === 0) {
          return prev;
        }

        const timestamp = Date.now();
        const normalizedName = trimmedName.toLowerCase();
        const searchTokens = normalizedName.split(/\s+/).filter(Boolean);
        const description = input.description?.trim() || undefined;
        const instructions = input.instructions?.trim() || undefined;
        const glassId = input.glassId?.trim() || undefined;
        const photoUri = input.photoUri?.trim() || undefined;

        const tagMap = new Map<number, CocktailTag>();
        (input.tags ?? []).forEach((tag) => {
          const tagId = Number(tag?.id ?? -1);
          if (!Number.isFinite(tagId) || tagId < 0) {
            return;
          }

          if (!tagMap.has(tagId)) {
            tagMap.set(tagId, {
              id: tagId,
              name: tag.name,
              color: tag.color,
            });
          }
        });
        const tags = tagMap.size > 0 ? Array.from(tagMap.values()) : undefined;

        const candidateRecord: CocktailRecord = {
          id: timestamp,
          name: trimmedName,
          glassId,
          tags,
          description,
          instructions,
          ingredients: sanitizedIngredients,
          createdAt: timestamp,
          updatedAt: timestamp,
          searchName: normalizedName,
          searchTokens,
          photoUri,
        } satisfies CocktailRecord;

        const [normalizedCocktail] = normalizeSearchFields([candidateRecord]);
        if (!normalizedCocktail) {
          return prev;
        }

        const usageAdjustments = new Map<number, number>();
        sanitizedIngredients.forEach((item) => {
          const ingredientIdValue = Number(item.ingredientId ?? -1);
          if (Number.isFinite(ingredientIdValue) && ingredientIdValue >= 0) {
            usageAdjustments.set(
              ingredientIdValue,
              (usageAdjustments.get(ingredientIdValue) ?? 0) + 1,
            );
          }
        });

        const nextIngredients =
          usageAdjustments.size > 0
            ? prev.ingredients.map((item) => {
                const idValue = Number(item.id ?? -1);
                const increment = usageAdjustments.get(idValue);
                if (!increment) {
                  return item;
                }

                const currentUsage = Number(item.usageCount ?? 0);
                const normalizedUsage = Number.isFinite(currentUsage) ? currentUsage : 0;
                return {
                  ...item,
                  usageCount: normalizedUsage + increment,
                } satisfies Ingredient;
              })
            : prev.ingredients;

        const nextCocktails = [...prev.cocktails, normalizedCocktail].sort((a, b) =>
          a.searchNameNormalized.localeCompare(b.searchNameNormalized),
        );

        created = normalizedCocktail;

        return {
          ...prev,
          cocktails: nextCocktails,
          ingredients: nextIngredients,
        } satisfies InventoryState;
      });

      return created;
    },
    [],
  );

  const createIngredient = useCallback(
    (input: CreateIngredientInput) => {
      let created: Ingredient | undefined;

      setInventoryState((prev) => {
        if (!prev) {
          return prev;
        }

        const trimmedName = input.name?.trim();
        if (!trimmedName) {
          return prev;
        }

        const nextId =
          prev.ingredients.reduce((maxId, ingredient) => {
            const id = Number(ingredient.id ?? -1);
            if (!Number.isFinite(id) || id < 0) {
              return maxId;
            }

            return Math.max(maxId, id);
          }, 0) + 1;

        const normalizedBaseId =
          input.baseIngredientId != null ? Number(input.baseIngredientId) : undefined;
        const baseIngredientId =
          normalizedBaseId != null && Number.isFinite(normalizedBaseId) && normalizedBaseId >= 0
            ? Math.trunc(normalizedBaseId)
            : undefined;

        const description = input.description?.trim() || undefined;
        const photoUri = input.photoUri?.trim() || undefined;

        const tagMap = new Map<number, IngredientTag>();
        (input.tags ?? []).forEach((tag) => {
          const id = Number(tag.id ?? -1);
          if (!Number.isFinite(id) || id < 0) {
            return;
          }

          if (!tagMap.has(id)) {
            tagMap.set(id, {
              id,
              name: tag.name,
              color: tag.color,
            });
          }
        });
        const tags = tagMap.size > 0 ? Array.from(tagMap.values()) : undefined;

        const normalizedName = trimmedName.toLowerCase();
        const searchTokens = normalizedName.split(/\s+/).filter(Boolean);

        const candidateRecord: IngredientRecord = {
          id: nextId,
          name: trimmedName,
          description,
          tags,
          baseIngredientId,
          usageCount: 0,
          searchName: normalizedName,
          searchTokens,
          photoUri,
        };

        const [normalized] = normalizeSearchFields([candidateRecord]);
        if (!normalized) {
          return prev;
        }

        const nextIngredients = [...prev.ingredients, normalized].sort((a, b) =>
          a.searchNameNormalized.localeCompare(b.searchNameNormalized),
        );

        created = normalized;

        return {
          ...prev,
          ingredients: nextIngredients,
        } satisfies InventoryState;
      });

      if (created?.id != null) {
        const id = Number(created.id);
        if (Number.isFinite(id) && id >= 0) {
          setAvailableIngredientIds((prev) => {
            if (prev.has(id)) {
              return prev;
            }

            const next = new Set(prev);
            next.add(id);
            return next;
          });

          setShoppingIngredientIds((prev) => {
            if (!prev.has(id)) {
              return prev;
            }

            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      }

      return created;
    },
    [],
  );

  const updateIngredient = useCallback(
    (id: number, input: CreateIngredientInput) => {
      let updated: Ingredient | undefined;

      setInventoryState((prev) => {
        if (!prev) {
          return prev;
        }

        const normalizedId = Number(id);
        if (!Number.isFinite(normalizedId) || normalizedId < 0) {
          return prev;
        }

        const ingredientIndex = prev.ingredients.findIndex(
          (item) => Number(item.id ?? -1) === normalizedId,
        );

        if (ingredientIndex === -1) {
          return prev;
        }

        const trimmedName = input.name?.trim();
        if (!trimmedName) {
          return prev;
        }

        const normalizedBaseId =
          input.baseIngredientId != null ? Number(input.baseIngredientId) : undefined;
        const baseIngredientId =
          normalizedBaseId != null && Number.isFinite(normalizedBaseId) && normalizedBaseId >= 0
            ? Math.trunc(normalizedBaseId)
            : undefined;

        const description = input.description?.trim() || undefined;
        const photoUri = input.photoUri?.trim() || undefined;

        const tagMap = new Map<number, IngredientTag>();
        (input.tags ?? []).forEach((tag) => {
          const tagId = Number(tag.id ?? -1);
          if (!Number.isFinite(tagId) || tagId < 0) {
            return;
          }

          if (!tagMap.has(tagId)) {
            tagMap.set(tagId, {
              id: tagId,
              name: tag.name,
              color: tag.color,
            });
          }
        });
        const tags = tagMap.size > 0 ? Array.from(tagMap.values()) : undefined;

        const normalizedName = trimmedName.toLowerCase();
        const searchTokens = normalizedName.split(/\s+/).filter(Boolean);

        const previous = prev.ingredients[ingredientIndex];
        const candidateRecord: IngredientRecord = {
          ...previous,
          id: previous.id,
          name: trimmedName,
          description,
          tags,
          baseIngredientId,
          usageCount: previous.usageCount,
          searchName: normalizedName,
          searchTokens,
          photoUri,
        };

        const [normalized] = normalizeSearchFields([candidateRecord]);
        if (!normalized) {
          return prev;
        }

        const nextIngredients = [...prev.ingredients];
        nextIngredients[ingredientIndex] = normalized;
        nextIngredients.sort((a, b) =>
          a.searchNameNormalized.localeCompare(b.searchNameNormalized),
        );

        updated = normalized;

        return {
          ...prev,
          ingredients: nextIngredients,
        } satisfies InventoryState;
      });

      return updated;
    },
    [],
  );

  const deleteIngredient = useCallback((id: number) => {
    const normalizedId = Number(id);
    if (!Number.isFinite(normalizedId) || normalizedId < 0) {
      return false;
    }

    let wasRemoved = false;

    setInventoryState((prev) => {
      if (!prev) {
        return prev;
      }

      let didUpdateDependents = false;

      const nextIngredients = prev.ingredients.reduce<Ingredient[]>((acc, ingredient) => {
        const ingredientId = Number(ingredient.id ?? -1);
        if (ingredientId === normalizedId) {
          wasRemoved = true;
          return acc;
        }

        if (
          ingredient.baseIngredientId != null &&
          Number(ingredient.baseIngredientId) === normalizedId
        ) {
          didUpdateDependents = true;
          acc.push({ ...ingredient, baseIngredientId: undefined } satisfies Ingredient);
          return acc;
        }

        acc.push(ingredient);
        return acc;
      }, []);

      if (!wasRemoved) {
        return prev;
      }

      if (didUpdateDependents) {
        nextIngredients.sort((a, b) =>
          a.searchNameNormalized.localeCompare(b.searchNameNormalized),
        );
      }

      return {
        ...prev,
        ingredients: nextIngredients,
      } satisfies InventoryState;
    });

    if (!wasRemoved) {
      return false;
    }

    setAvailableIngredientIds((prev) => {
      if (!prev.has(normalizedId)) {
        return prev;
      }

      const next = new Set(prev);
      next.delete(normalizedId);
      return next;
    });

    setShoppingIngredientIds((prev) => {
      if (!prev.has(normalizedId)) {
        return prev;
      }

      const next = new Set(prev);
      next.delete(normalizedId);
      return next;
    });

    return true;
  }, []);

  const toggleIngredientAvailability = useCallback((id: number) => {
    setAvailableIngredientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleIngredientShopping = useCallback((id: number) => {
    setShoppingIngredientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearBaseIngredient = useCallback((id: number) => {
    setInventoryState((prev) => {
      if (!prev) {
        return prev;
      }

      let didChange = false;
      const nextIngredients = prev.ingredients.map((ingredient) => {
        if (Number(ingredient.id ?? -1) === id && ingredient.baseIngredientId != null) {
          didChange = true;
          return { ...ingredient, baseIngredientId: undefined } satisfies Ingredient;
        }
        return ingredient;
      });

      if (!didChange) {
        return prev;
      }

      return {
        ...prev,
        ingredients: nextIngredients,
      } satisfies InventoryState;
    });
  }, []);

  const value = useMemo<InventoryContextValue>(() => {
    return {
      cocktails: cocktailsWithRatings,
      ingredients,
      loading,
      availableIngredientIds,
      shoppingIngredientIds,
      setIngredientAvailability,
      toggleIngredientAvailability,
      toggleIngredientShopping,
      clearBaseIngredient,
      createCocktail,
      createIngredient,
      updateIngredient,
      deleteIngredient,
      cocktailRatings,
      setCocktailRating,
      getCocktailRating,
    };
  }, [
    cocktailsWithRatings,
    ingredients,
    loading,
    availableIngredientIds,
    shoppingIngredientIds,
    setIngredientAvailability,
    toggleIngredientAvailability,
    toggleIngredientShopping,
    clearBaseIngredient,
    createCocktail,
    createIngredient,
    updateIngredient,
    deleteIngredient,
    cocktailRatings,
    setCocktailRating,
    getCocktailRating,
  ]);

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const context = useContext(InventoryContext);

  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }

  return context;
}

export type {
  Cocktail,
  Ingredient,
  CreateIngredientInput,
  CreateCocktailInput,
  CreateCocktailIngredientInput,
  CocktailIngredientRecord,
  CocktailSubstituteRecord,
  CocktailTag,
};
