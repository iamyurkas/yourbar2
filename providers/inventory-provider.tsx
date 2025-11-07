import * as FileSystem from 'expo-file-system';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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

type PersistedState = {
  cocktails?: Cocktail[];
  ingredients?: Ingredient[];
  availableIngredientIds?: number[];
  shoppingIngredientIds?: number[];
  cocktailRatings?: Record<string, number>;
};

const STORAGE_DIRECTORY = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
const STORAGE_FILE_URI = STORAGE_DIRECTORY ? `${STORAGE_DIRECTORY}inventory-state.json` : '';

async function readPersistedState(): Promise<PersistedState | undefined> {
  if (!STORAGE_FILE_URI) {
    return undefined;
  }

  try {
    const fileInfo = await FileSystem.getInfoAsync(STORAGE_FILE_URI);
    if (!fileInfo.exists) {
      return undefined;
    }

    const content = await FileSystem.readAsStringAsync(STORAGE_FILE_URI);
    if (!content) {
      return undefined;
    }

    return JSON.parse(content) as PersistedState;
  } catch (error) {
    console.error('Failed to read inventory state from storage', error);
    return undefined;
  }
}

async function writePersistedState(state: PersistedState) {
  if (!STORAGE_FILE_URI) {
    return;
  }

  try {
    await FileSystem.writeAsStringAsync(STORAGE_FILE_URI, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to write inventory state to storage', error);
  }
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
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cocktailsState, setCocktailsState] = useState<Cocktail[]>(() => inventory.cocktails);
  const [ingredientsState, setIngredientsState] = useState<Ingredient[]>(() => inventory.ingredients);
  const [availableIngredientIds, setAvailableIngredientIds] = useState<Set<number>>(() => new Set());
  const [shoppingIngredientIds, setShoppingIngredientIds] = useState<Set<number>>(() => new Set());
  const [cocktailRatings, setCocktailRatings] = useState<Record<string, number>>({});

  useEffect(() => {
    inventory.cocktails = cocktailsState;
  }, [cocktailsState, inventory]);

  useEffect(() => {
    inventory.ingredients = ingredientsState;
  }, [ingredientsState, inventory]);

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      try {
        const persisted = await readPersistedState();
        if (!isMounted || !persisted) {
          return;
        }

        if (Array.isArray(persisted.cocktails)) {
          const normalizedCocktails = normalizeSearchFields(persisted.cocktails) as Cocktail[];
          inventory.cocktails = normalizedCocktails;
          setCocktailsState(normalizedCocktails);
        }

        if (Array.isArray(persisted.ingredients)) {
          const normalizedIngredients = normalizeSearchFields(persisted.ingredients) as Ingredient[];
          inventory.ingredients = normalizedIngredients;
          setIngredientsState(normalizedIngredients);
        }

        if (Array.isArray(persisted.availableIngredientIds)) {
          setAvailableIngredientIds(new Set(persisted.availableIngredientIds));
        }

        if (Array.isArray(persisted.shoppingIngredientIds)) {
          setShoppingIngredientIds(new Set(persisted.shoppingIngredientIds));
        }

        if (persisted.cocktailRatings && typeof persisted.cocktailRatings === 'object') {
          setCocktailRatings(persisted.cocktailRatings);
        }
      } finally {
        if (isMounted) {
          setHydrated(true);
          setLoading(false);
        }
      }
    };

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, [inventory]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const payload: PersistedState = {
      cocktails: cocktailsState,
      ingredients: ingredientsState,
      availableIngredientIds: Array.from(availableIngredientIds),
      shoppingIngredientIds: Array.from(shoppingIngredientIds),
      cocktailRatings,
    };

    void writePersistedState(payload);
  }, [
    hydrated,
    cocktailsState,
    ingredientsState,
    availableIngredientIds,
    shoppingIngredientIds,
    cocktailRatings,
  ]);

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
    return cocktailsState.map((cocktail) => {
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
  }, [cocktailRatings, cocktailsState, resolveCocktailKey]);

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
    ingredientsState,
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
