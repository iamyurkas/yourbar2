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
  cocktailRatings: Record<string, number>;
  setCocktailRating: (cocktail: Cocktail, rating: number) => void;
  getCocktailRating: (cocktail: Cocktail) => number;
};

type InventoryState = {
  cocktails: Cocktail[];
  ingredients: Ingredient[];
  imported: boolean;
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

export type { Cocktail, Ingredient };
