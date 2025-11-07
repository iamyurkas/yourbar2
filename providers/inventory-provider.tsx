import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  loadPersistedInventoryState,
  savePersistedInventoryState,
  type PersistedInventoryState,
} from '@/libs/inventory-persistence';

type InventoryData = typeof import('@/assets/data/data.json');

let cachedInventoryData: InventoryData | undefined;

function loadInventoryData(): InventoryData {
  if (!cachedInventoryData) {
    cachedInventoryData = require('@/assets/data/data.json');
  }

  return cachedInventoryData;
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

function toPersistableIdArray(ids: Iterable<number>): number[] {
  const unique = new Set<number>();

  for (const value of ids) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0) {
      unique.add(Math.trunc(numeric));
    }
  }

  return Array.from(unique).sort((a, b) => a - b);
}

function toPersistableRatings(ratings: Record<string, number>): Record<string, number> {
  const sanitized: Record<string, number> = {};

  Object.entries(ratings).forEach(([key, value]) => {
    if (!key) {
      return;
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return;
    }

    const normalized = Math.max(0, Math.min(5, Math.round(numeric)));
    if (normalized > 0) {
      sanitized[key] = normalized;
    }
  });

  return sanitized;
}

declare global {
  // eslint-disable-next-line no-var
  var __yourbarInventory: InventoryState | undefined;
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

function ensureInventoryState(): InventoryState {
  if (!globalThis.__yourbarInventory) {
    const data = loadInventoryData();
    globalThis.__yourbarInventory = {
      cocktails: normalizeSearchFields(data.cocktails),
      ingredients: normalizeSearchFields(data.ingredients),
      imported: true,
    } satisfies InventoryState;
  }

  return globalThis.__yourbarInventory;
}

const InventoryContext = createContext<InventoryContextValue | undefined>(undefined);

type InventoryProviderProps = {
  children: React.ReactNode;
};

export function InventoryProvider({ children }: InventoryProviderProps) {
  const inventory = ensureInventoryState();
  const [ingredientsState, setIngredientsState] = useState<Ingredient[]>(() => inventory.ingredients);
  const [availableIngredientIds, setAvailableIngredientIds] = useState<Set<number>>(() => new Set());
  const [shoppingIngredientIds, setShoppingIngredientIds] = useState<Set<number>>(() => new Set());
  const [cocktailRatings, setCocktailRatings] = useState<Record<string, number>>({});
  const persistedStateRef = useRef<PersistedInventoryState>({
    availableIngredientIds: [],
    shoppingIngredientIds: [],
    cocktailRatings: {},
  });

  useEffect(() => {
    let isMounted = true;

    const restorePersistedState = async () => {
      const persisted = await loadPersistedInventoryState();

      if (!isMounted) {
        return;
      }

      persistedStateRef.current = {
        availableIngredientIds: [...persisted.availableIngredientIds],
        shoppingIngredientIds: [...persisted.shoppingIngredientIds],
        cocktailRatings: { ...persisted.cocktailRatings },
      } satisfies PersistedInventoryState;

      setAvailableIngredientIds(new Set(persisted.availableIngredientIds));
      setShoppingIngredientIds(new Set(persisted.shoppingIngredientIds));
      setCocktailRatings({ ...persisted.cocktailRatings });
    };

    void restorePersistedState();

    return () => {
      isMounted = false;
    };
  }, []);

  const updatePersistedState = useCallback((partial: Partial<PersistedInventoryState>) => {
    const nextState: PersistedInventoryState = {
      availableIngredientIds:
        partial.availableIngredientIds ?? persistedStateRef.current.availableIngredientIds,
      shoppingIngredientIds:
        partial.shoppingIngredientIds ?? persistedStateRef.current.shoppingIngredientIds,
      cocktailRatings: partial.cocktailRatings ?? persistedStateRef.current.cocktailRatings,
    };

    persistedStateRef.current = {
      availableIngredientIds: [...nextState.availableIngredientIds],
      shoppingIngredientIds: [...nextState.shoppingIngredientIds],
      cocktailRatings: { ...nextState.cocktailRatings },
    } satisfies PersistedInventoryState;

    void savePersistedInventoryState(persistedStateRef.current);
  }, []);

  const persistAvailableIds = useCallback(
    (ids: Set<number>) => {
      updatePersistedState({ availableIngredientIds: toPersistableIdArray(ids) });
    },
    [updatePersistedState],
  );

  const persistShoppingIds = useCallback(
    (ids: Set<number>) => {
      updatePersistedState({ shoppingIngredientIds: toPersistableIdArray(ids) });
    },
    [updatePersistedState],
  );

  const persistRatings = useCallback(
    (ratings: Record<string, number>) => {
      updatePersistedState({ cocktailRatings: toPersistableRatings(ratings) });
    },
    [updatePersistedState],
  );

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
          persistRatings(next);
          return next;
        }

        if (prev[key] === normalizedRating) {
          return prev;
        }

        const next = { ...prev, [key]: normalizedRating };
        persistRatings(next);
        return next;
      });
    },
    [persistRatings, resolveCocktailKey],
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
    return inventory.cocktails.map((cocktail) => {
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
  }, [cocktailRatings, inventory.cocktails, resolveCocktailKey]);

  const setIngredientAvailability = useCallback(
    (id: number, available: boolean) => {
      if (!Number.isFinite(id) || id < 0) {
        return;
      }

      setAvailableIngredientIds((prev) => {
        const hasId = prev.has(id);
        if ((available && hasId) || (!available && !hasId)) {
          return prev;
        }

        const next = new Set(prev);
        if (available) {
          next.add(id);
        } else {
          next.delete(id);
        }

        persistAvailableIds(next);
        return next;
      });
    },
    [persistAvailableIds],
  );

  const toggleIngredientAvailability = useCallback(
    (id: number) => {
      if (!Number.isFinite(id) || id < 0) {
        return;
      }

      setAvailableIngredientIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }

        persistAvailableIds(next);
        return next;
      });
    },
    [persistAvailableIds],
  );

  const toggleIngredientShopping = useCallback(
    (id: number) => {
      if (!Number.isFinite(id) || id < 0) {
        return;
      }

      setShoppingIngredientIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }

        persistShoppingIds(next);
        return next;
      });
    },
    [persistShoppingIds],
  );

  const clearBaseIngredient = useCallback(
    (id: number) => {
      setIngredientsState((prev) => {
        let didChange = false;
        const next = prev.map((ingredient) => {
          if (Number(ingredient.id ?? -1) === id && ingredient.baseIngredientId != null) {
            didChange = true;
            return { ...ingredient, baseIngredientId: undefined };
          }
          return ingredient;
        });

        if (didChange) {
          inventory.ingredients = next;
        }

        return didChange ? next : prev;
      });
    },
    [inventory],
  );

  const value = useMemo<InventoryContextValue>(() => {
    return {
      cocktails: cocktailsWithRatings,
      ingredients: ingredientsState,
      loading: false,
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
    ingredientsState,
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
