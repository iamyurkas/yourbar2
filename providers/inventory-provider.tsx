import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import data from '@/assets/data/data.json';

type Cocktail = (typeof data)['cocktails'][number];
type Ingredient = (typeof data)['ingredients'][number];

type InventoryContextValue = {
  cocktails: Cocktail[];
  ingredients: Ingredient[];
  loading: boolean;
  availableIngredientIds: Set<number>;
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

function ensureInventoryState(): InventoryState {
  if (!globalThis.__yourbarInventory) {
    globalThis.__yourbarInventory = {
      cocktails: data.cocktails ?? [],
      ingredients: data.ingredients ?? [],
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
  const [version, setVersion] = useState(0);

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
        setVersion((current) => current + 1);
      }
    },
    [setVersion],
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
      setIngredientAvailability,
      toggleIngredientAvailability,
    };
  }, [inventory, setIngredientAvailability, toggleIngredientAvailability, version]);

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
