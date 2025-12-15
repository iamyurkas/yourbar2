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

type BaseCocktailRecord = InventoryData['cocktails'][number];
type CocktailIngredientRecord = NonNullable<BaseCocktailRecord['ingredients']>[number];
type CocktailSubstituteRecord = NonNullable<CocktailIngredientRecord['substitutes']>[number];
type CocktailTag = NonNullable<BaseCocktailRecord['tags']>[number];
type CocktailSubstitute = CocktailSubstituteRecord & { brand?: boolean };
type CocktailIngredient = Omit<CocktailIngredientRecord, 'substitutes'> & {
  allowBaseSubstitution?: boolean;
  allowBrandSubstitution?: boolean;
  substitutes?: CocktailSubstitute[];
};
type CocktailRecord = Omit<BaseCocktailRecord, 'ingredients' | 'searchName' | 'searchTokens'> & {
  ingredients?: CocktailIngredient[];
  searchName?: string | null;
  searchTokens?: string[] | null;
};
type IngredientRecord = InventoryData['ingredients'][number];

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
  ignoreGarnish: boolean;
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
  setIgnoreGarnish: (value: boolean) => void;
};

type InventoryState = {
  cocktails: Cocktail[];
  ingredients: Ingredient[];
  imported: boolean;
};

type IngredientTag = NonNullable<IngredientRecord['tags']>[number];

type CreateCocktailSubstituteInput = {
  id?: number | string | null;
  ingredientId?: number | string | null;
  name?: string | null;
  brand?: boolean | null;
};

type CreateCocktailIngredientInput = {
  ingredientId?: number | string | null;
  name?: string | null;
  amount?: string | null;
  unitId?: number | string | null;
  optional?: boolean | null;
  garnish?: boolean | null;
  allowBaseSubstitution?: boolean | null;
  allowBrandSubstitution?: boolean | null;
  substitutes?: CreateCocktailSubstituteInput[] | null;
  order?: number | null;
};

type CreateCocktailInput = {
  name: string;
  description?: string | null;
  instructions?: string | null;
  photoUri?: string | null;
  glassId?: string | null;
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
  ignoreGarnish?: boolean;
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
  // eslint-disable-next-line no-var
  var __yourbarInventoryIgnoreGarnish: boolean | undefined;
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
    ignoreGarnish: boolean;
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
    ignoreGarnish: options.ignoreGarnish,
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
  const [ignoreGarnish, setIgnoreGarnish] = useState<boolean>(
    () => globalThis.__yourbarInventoryIgnoreGarnish ?? true,
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
          const nextIgnoreGarnish = stored.ignoreGarnish ?? true;

          setInventoryState(nextInventoryState);
          setAvailableIngredientIds(nextAvailableIds);
          setShoppingIngredientIds(nextShoppingIds);
          setCocktailRatings(nextRatings);
          setIgnoreGarnish(nextIgnoreGarnish);
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
          setIgnoreGarnish(true);
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
    globalThis.__yourbarInventoryIgnoreGarnish = ignoreGarnish;

    const snapshot = createSnapshotFromInventory(inventoryState, {
      availableIngredientIds,
      shoppingIngredientIds,
      cocktailRatings,
      ignoreGarnish,
    });
    const serialized = JSON.stringify(snapshot);

    if (lastPersistedSnapshot.current === serialized) {
      return;
    }

    lastPersistedSnapshot.current = serialized;

    void persistInventorySnapshot(snapshot).catch((error) => {
      console.error('Failed to persist inventory snapshot', error);
    });
  }, [inventoryState, availableIngredientIds, shoppingIngredientIds, cocktailRatings, ignoreGarnish]);

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

        const sanitizedIngredients = (input.ingredients ?? [])
          .map((ingredient, index) => {
            const trimmedIngredientName = ingredient.name?.trim();
            if (!trimmedIngredientName) {
              return undefined;
            }

            const normalizedIngredientId =
              ingredient.ingredientId != null ? Number(ingredient.ingredientId) : undefined;
            const ingredientId =
              normalizedIngredientId != null &&
              Number.isFinite(normalizedIngredientId) &&
              normalizedIngredientId >= 0
                ? Math.trunc(normalizedIngredientId)
                : undefined;

            const normalizedUnitId = ingredient.unitId != null ? Number(ingredient.unitId) : undefined;
            const unitId =
              normalizedUnitId != null && Number.isFinite(normalizedUnitId) && normalizedUnitId >= 0
                ? Math.trunc(normalizedUnitId)
                : undefined;

            const amount = ingredient.amount?.trim() || undefined;
            const optional = ingredient.optional ? true : undefined;
            const garnish = ingredient.garnish ? true : undefined;
            const allowBase = ingredient.allowBaseSubstitution ? true : undefined;
            const allowBrand = ingredient.allowBrandSubstitution ? true : undefined;

            const substituteInputs = ingredient.substitutes ?? [];
            const substitutes: CocktailSubstitute[] = [];
            const seenKeys = new Set<string>();

            substituteInputs.forEach((candidate) => {
              const substituteName = candidate?.name?.trim();
              if (!substituteName) {
                return;
              }

              const rawId = candidate.id != null ? Number(candidate.id) : undefined;
              const substituteId =
                rawId != null && Number.isFinite(rawId) && rawId >= 0 ? Math.trunc(rawId) : undefined;

              const rawIngredientLink =
                candidate.ingredientId != null ? Number(candidate.ingredientId) : undefined;
              const substituteIngredientId =
                rawIngredientLink != null && Number.isFinite(rawIngredientLink) && rawIngredientLink >= 0
                  ? Math.trunc(rawIngredientLink)
                  : substituteId;

              const key = substituteId != null ? `id:${substituteId}` : `name:${substituteName.toLowerCase()}`;
              if (seenKeys.has(key)) {
                return;
              }
              seenKeys.add(key);

              const brand = candidate.brand ? true : undefined;

              substitutes.push({
                id: substituteId ?? substituteIngredientId,
                ingredientId: substituteIngredientId,
                name: substituteName,
                brand,
              });
            });

            return {
              order: index + 1,
              ingredientId,
              name: trimmedIngredientName,
              amount,
              unitId,
              optional,
              garnish,
              allowBaseSubstitution: allowBase,
              allowBrandSubstitution: allowBrand,
              substitutes: substitutes.length > 0 ? substitutes : undefined,
            } satisfies CocktailIngredient;
          })
          .filter((value): value is CocktailIngredient => Boolean(value));

        if (sanitizedIngredients.length === 0) {
          return prev;
        }

        const nextId =
          prev.cocktails.reduce((maxId, cocktail) => {
            const id = Number(cocktail.id ?? -1);
            if (!Number.isFinite(id) || id < 0) {
              return maxId;
            }

            return Math.max(maxId, id);
          }, 0) + 1;

        const description = input.description?.trim() || undefined;
        const instructions = input.instructions?.trim() || undefined;
        const photoUri = input.photoUri?.trim() || undefined;
        const glassId = input.glassId?.trim() || undefined;

        const tagMap = new Map<number, CocktailTag>();
        (input.tags ?? []).forEach((tag) => {
          const id = Number(tag.id ?? -1);
          if (!Number.isFinite(id) || id < 0) {
            return;
          }

          if (!tagMap.has(id)) {
            tagMap.set(id, { id, name: tag.name, color: tag.color });
          }
        });
        const tags = tagMap.size > 0 ? Array.from(tagMap.values()) : undefined;

        const normalizedName = trimmedName.toLowerCase();
        const searchTokens = normalizedName.split(/\s+/).filter(Boolean);

        const candidateRecord: CocktailRecord = {
          id: nextId,
          name: trimmedName,
          description,
          instructions,
          photoUri,
          glassId,
          tags,
          ingredients: sanitizedIngredients.map((ingredient, index) => ({
            ...ingredient,
            order: index + 1,
          })),
          searchName: normalizedName,
          searchTokens,
        } satisfies CocktailRecord;

        const [normalized] = normalizeSearchFields([candidateRecord]);
        if (!normalized) {
          return prev;
        }

        created = normalized;

        const nextCocktails = [...prev.cocktails, normalized].sort((a, b) =>
          a.searchNameNormalized.localeCompare(b.searchNameNormalized),
        );

        return {
          ...prev,
          cocktails: nextCocktails,
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

  const handleSetIgnoreGarnish = useCallback((value: boolean) => {
    setIgnoreGarnish(Boolean(value));
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
      ignoreGarnish,
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
      setIgnoreGarnish: handleSetIgnoreGarnish,
    };
  }, [
    cocktailsWithRatings,
    ingredients,
    loading,
    availableIngredientIds,
    shoppingIngredientIds,
    ignoreGarnish,
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
    handleSetIgnoreGarnish,
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

export type { Cocktail, Ingredient, CreateIngredientInput, CreateCocktailInput };
