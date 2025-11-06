import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import data from '@/assets/data/data.json';

type CocktailRecord = (typeof data)['cocktails'][number];
type IngredientRecord = (typeof data)['ingredients'][number];

type NormalizedSearchFields = {
  searchNameNormalized: string;
  searchTokensNormalized: string[];
};

type Cocktail = CocktailRecord & NormalizedSearchFields;
type IngredientTag = NonNullable<IngredientRecord['tags']>[number];

type Ingredient = (IngredientRecord &
  NormalizedSearchFields & {
    shoppingList?: boolean;
  });

type IngredientDraft = {
  id: number;
  name: string;
  description?: string | null;
  baseIngredientId?: number | null;
  photoUri?: string | null;
  tags?: IngredientTag[] | null;
  searchName?: string | null;
  searchTokens?: string[] | null;
  usageCount?: number;
};

type InventoryContextValue = {
  cocktails: Cocktail[];
  ingredients: Ingredient[];
  loading: boolean;
  availableIngredientIds: Set<number>;
  setIngredientAvailability: (id: number, available: boolean) => void;
  toggleIngredientAvailability: (id: number) => void;
  shoppingListIds: Set<number>;
  toggleShoppingList: (id: number) => void;
  upsertIngredient: (ingredient: IngredientDraft) => Ingredient | undefined;
  removeIngredient: (id: number) => void;
  findIngredientById: (id: number) => Ingredient | undefined;
  tags: IngredientTag[];
  upsertTag: (tag: IngredientTag) => IngredientTag;
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
  const [ingredientsState, setIngredientsState] = useState<Ingredient[]>(() =>
    normalizeSearchFields(inventory.ingredients) as Ingredient[],
  );
  const [availableIngredientIds, setAvailableIngredientIds] = useState<Set<number>>(() => new Set());
  const [shoppingListIds, setShoppingListIds] = useState<Set<number>>(() => new Set());
  const [tags, setTags] = useState<IngredientTag[]>(() => {
    const tagMap = new Map<number, IngredientTag>();
    for (const ingredient of inventory.ingredients) {
      for (const tag of ingredient.tags ?? []) {
        tagMap.set(tag.id, tag);
      }
    }
    return Array.from(tagMap.values());
  });

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

  const toggleShoppingList = useCallback((id: number) => {
    setShoppingListIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setIngredientsState((prev) =>
      prev.map((ingredient) =>
        ingredient.id === id ? { ...ingredient, shoppingList: !ingredient.shoppingList } : ingredient,
      ),
    );
  }, []);

  const findIngredientById = useCallback(
    (id: number) => ingredientsState.find((ingredient) => ingredient.id === id),
    [ingredientsState],
  );

  const upsertIngredient = useCallback(
    (draft: IngredientDraft) => {
      const normalized = normalizeSearchFields([draft])[0] as Ingredient;
      normalized.shoppingList = draft.id ? shoppingListIds.has(draft.id) : false;

      setIngredientsState((prev) => {
        const next = prev.filter((ingredient) => ingredient.id !== draft.id);
        next.push(normalized);
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
      });

      return normalized;
    },
    [shoppingListIds],
  );

  const removeIngredient = useCallback((id: number) => {
    setIngredientsState((prev) => prev.filter((ingredient) => ingredient.id !== id));
    setAvailableIngredientIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setShoppingListIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const upsertTag = useCallback((tag: IngredientTag) => {
    setTags((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === tag.id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = tag;
        return next;
      }
      return [...prev, tag];
    });
    return tag;
  }, []);

  const value = useMemo<InventoryContextValue>(() => {
    return {
      cocktails: inventory.cocktails,
      ingredients: ingredientsState,
      loading: false,
      availableIngredientIds,
      setIngredientAvailability,
      toggleIngredientAvailability,
      shoppingListIds,
      toggleShoppingList,
      upsertIngredient,
      removeIngredient,
      findIngredientById,
      tags,
      upsertTag,
    };
  }, [
    inventory.cocktails,
    ingredientsState,
    availableIngredientIds,
    setIngredientAvailability,
    toggleIngredientAvailability,
    shoppingListIds,
    toggleShoppingList,
    upsertIngredient,
    removeIngredient,
    findIngredientById,
    tags,
    upsertTag,
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

export type { Cocktail, Ingredient, IngredientDraft, IngredientTag };
