import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import data from '@/assets/data/data.json';

type CocktailRecord = (typeof data)['cocktails'][number];
type IngredientRecord = (typeof data)['ingredients'][number];

type NormalizedSearchFields = {
  searchNameNormalized: string;
  searchTokensNormalized: string[];
};

type Cocktail = CocktailRecord & NormalizedSearchFields;
type Ingredient = IngredientRecord & NormalizedSearchFields;

type InventoryContextValue = {
  cocktails: Cocktail[];
  ingredients: Ingredient[];
  loading: boolean;
  availableIngredientIds: Set<number>;
  setIngredientAvailability: (id: number, available: boolean) => void;
  toggleIngredientAvailability: (id: number) => void;
  clearBaseIngredient: (id: number) => void;
};

type InventoryState = {
  cocktails: Cocktail[];
  ingredients: Ingredient[];
  imported: boolean;
};

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
      cocktails: inventory.cocktails,
      ingredients: ingredientsState,
      loading: false,
      availableIngredientIds,
      setIngredientAvailability,
      toggleIngredientAvailability,
      clearBaseIngredient,
    };
  }, [
    inventory.cocktails,
    ingredientsState,
    availableIngredientIds,
    setIngredientAvailability,
    toggleIngredientAvailability,
    clearBaseIngredient,
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
