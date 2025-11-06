import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

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
  availableIngredientVersion: number;
  setIngredientAvailability: (id: number, available: boolean) => void;
  toggleIngredientAvailability: (id: number) => void;
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
  const availableIngredientIdsRef = useRef<Set<number>>(new Set());
  const [availableIngredientVersion, setAvailableIngredientVersion] = useState(0);

  const setIngredientAvailability = useCallback(
    (id: number, available: boolean) => {
      const availableIngredientIds = availableIngredientIdsRef.current;
      let hasChanged = false;

      if (available) {
        if (!availableIngredientIds.has(id)) {
          availableIngredientIds.add(id);
          hasChanged = true;
        }
      } else if (availableIngredientIds.delete(id)) {
        hasChanged = true;
      }

      if (hasChanged) {
        setAvailableIngredientVersion((current) => current + 1);
      }
    },
    [setAvailableIngredientVersion],
  );

  const toggleIngredientAvailability = useCallback(
    (id: number) => {
      const availableIngredientIds = availableIngredientIdsRef.current;
      const shouldBeAvailable = !availableIngredientIds.has(id);
      setIngredientAvailability(id, shouldBeAvailable);
    },
    [setIngredientAvailability],
  );

  const value = useMemo<InventoryContextValue>(() => {
    return {
      cocktails: inventory.cocktails,
      ingredients: inventory.ingredients,
      loading: false,
      availableIngredientIds: availableIngredientIdsRef.current,
      availableIngredientVersion,
      setIngredientAvailability,
      toggleIngredientAvailability,
    };
  }, [
    inventory,
    availableIngredientVersion,
    setIngredientAvailability,
    toggleIngredientAvailability,
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
