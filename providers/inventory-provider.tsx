import React, { createContext, useContext, useMemo } from 'react';

import data from '@/assets/data/data.json';

type Cocktail = (typeof data)['cocktails'][number];
type Ingredient = (typeof data)['ingredients'][number];

type InventoryContextValue = {
  cocktails: Cocktail[];
  ingredients: Ingredient[];
  loading: boolean;
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

  const value = useMemo<InventoryContextValue>(() => {
    return {
      cocktails: inventory.cocktails,
      ingredients: inventory.ingredients,
      loading: false,
    };
  }, [inventory]);

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
