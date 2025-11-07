import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

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

type PersistedInventoryState = {
  availableIngredientIds?: number[];
  shoppingIngredientIds?: number[];
  cocktailRatings?: Record<string, number>;
};

const STORAGE_FILE_NAME = 'yourbar-inventory.json';

type WebStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function getWebStorage(): WebStorage | undefined {
  if (Platform.OS !== 'web') {
    return undefined;
  }

  const candidate = (globalThis as { localStorage?: unknown }).localStorage;
  if (
    candidate &&
    typeof candidate === 'object' &&
    'getItem' in candidate &&
    typeof (candidate as { getItem?: unknown }).getItem === 'function' &&
    'setItem' in candidate &&
    typeof (candidate as { setItem?: unknown }).setItem === 'function'
  ) {
    return candidate as WebStorage;
  }

  return undefined;
}

const STORAGE_FILE_URI = (() => {
  const directory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!directory) {
    return undefined;
  }

  return `${directory}${STORAGE_FILE_NAME}`;
})();

async function readPersistedInventoryState() {
  const webStorage = getWebStorage();
  if (webStorage) {
    try {
      const value = webStorage.getItem(STORAGE_FILE_NAME);
      if (!value) {
        return undefined;
      }

      return JSON.parse(value) as PersistedInventoryState;
    } catch (error) {
      console.warn('Failed to read inventory state from web storage', error);
      return undefined;
    }
  }

  if (!STORAGE_FILE_URI) {
    return undefined;
  }

  try {
    const info = await FileSystem.getInfoAsync(STORAGE_FILE_URI);
    if (!info.exists) {
      return undefined;
    }

    const contents = await FileSystem.readAsStringAsync(STORAGE_FILE_URI);
    if (!contents) {
      return undefined;
    }

    return JSON.parse(contents) as PersistedInventoryState;
  } catch (error) {
    console.warn('Failed to read inventory state from file', error);
    return undefined;
  }
}

async function writePersistedInventoryState(state: PersistedInventoryState) {
  const payload = JSON.stringify(state);

  const webStorage = getWebStorage();
  if (webStorage) {
    try {
      webStorage.setItem(STORAGE_FILE_NAME, payload);
    } catch (error) {
      console.warn('Failed to persist inventory state to web storage', error);
    }
    return;
  }

  if (!STORAGE_FILE_URI) {
    return;
  }

  try {
    await FileSystem.writeAsStringAsync(STORAGE_FILE_URI, payload);
  } catch (error) {
    console.warn('Failed to persist inventory state to file', error);
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
  const [ingredientsState, setIngredientsState] = useState<Ingredient[]>(() => inventory.ingredients);
  const [availableIngredientIds, setAvailableIngredientIds] = useState<Set<number>>(() => new Set());
  const [shoppingIngredientIds, setShoppingIngredientIds] = useState<Set<number>>(() => new Set());
  const [cocktailRatings, setCocktailRatings] = useState<Record<string, number>>({});
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      try {
        const persisted = await readPersistedInventoryState();

        if (!isMounted) {
          return;
        }

        if (persisted) {
          const normalizeIdList = (value: unknown): number[] => {
            if (!Array.isArray(value)) {
              return [];
            }

            return value
              .map((item) => Number(item))
              .filter((item) => Number.isFinite(item));
          };

          if (persisted.availableIngredientIds) {
            setAvailableIngredientIds(new Set(normalizeIdList(persisted.availableIngredientIds)));
          }

          if (persisted.shoppingIngredientIds) {
            setShoppingIngredientIds(new Set(normalizeIdList(persisted.shoppingIngredientIds)));
          }

          if (persisted.cocktailRatings) {
            const source = persisted.cocktailRatings;
            if (source && typeof source === 'object') {
              const nextRatings: Record<string, number> = {};
              for (const [key, value] of Object.entries(source)) {
                const normalized = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
                if (normalized > 0) {
                  nextRatings[key] = normalized;
                }
              }
              setCocktailRatings(nextRatings);
            }
          }
        }
      } catch (error) {
        console.warn('Failed to hydrate inventory state', error);
      } finally {
        if (isMounted) {
          setHydrated(true);
          setLoading(false);
        }
      }
    }

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void writePersistedInventoryState({
      availableIngredientIds: Array.from(availableIngredientIds),
      shoppingIngredientIds: Array.from(shoppingIngredientIds),
      cocktailRatings,
    });
  }, [availableIngredientIds, shoppingIngredientIds, cocktailRatings, hydrated]);

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
