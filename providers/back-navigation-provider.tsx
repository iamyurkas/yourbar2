import { useNavigation } from '@react-navigation/native';
import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { isCocktailReady } from '@/libs/cocktail-availability';
import { createIngredientLookup } from '@/libs/ingredient-availability';
import { normalizeSearchText } from '@/libs/search-normalization';
import { useInventory, type Cocktail, type Ingredient } from '@/providers/inventory-provider';

type NavigationParams = Record<string, string> | undefined;

type BackNavigationEntry = {
  pathname: string;
  params?: NavigationParams;
  timestamp: number;
  skipOnBack?: boolean;
};

type BackNavigationFallback = {
  pathname: string;
  params?: NavigationParams;
};

type BackNavigationContextValue = {
  history: BackNavigationEntry[];
  goBack: (fallback?: BackNavigationFallback) => void;
  markCurrentEntryAsSkip: () => void;
  markNextEntryAsSkip: () => void;
};

const BackNavigationContext = createContext<BackNavigationContextValue | null>(null);

const normalizeParams = (
  params: Record<string, string | string[] | undefined> | null,
): NavigationParams => {
  if (!params) {
    return undefined;
  }

  const entries = Object.entries(params)
    .map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
    .filter(([, value]) => typeof value === 'string' && value.length > 0) as Array<[string, string]>;

  return entries.length ? Object.fromEntries(entries) : undefined;
};

const areParamsEqual = (left?: NavigationParams, right?: NavigationParams): boolean => {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => rightKeys.includes(key) && left[key] === right[key]);
};

const areEntriesEqual = (left?: BackNavigationEntry, right?: BackNavigationEntry): boolean => {
  if (!left || !right) {
    return false;
  }

  if (left.pathname !== right.pathname) {
    return false;
  }

  return areParamsEqual(left.params, right.params);
};

const isIngredientDetailsPath = (pathname: string) =>
  /^\/ingredients\/.+/.test(pathname) && pathname !== '/ingredients/create';

const isCocktailDetailsPath = (pathname: string) =>
  /^\/cocktails\/.+/.test(pathname) && pathname !== '/cocktails/create';

const isEditScreenEntry = (entry: BackNavigationEntry): boolean => {
  if (entry.pathname === '/cocktails/create') {
    return entry.params?.mode === 'edit';
  }
  if (entry.pathname === '/ingredients/create') {
    return entry.params?.mode === 'edit';
  }
  return false;
};

const resolveEntryId = (entry: BackNavigationEntry, key: string): string | undefined => {
  const paramValue = entry.params?.[key];
  if (paramValue) {
    return paramValue;
  }

  const segments = entry.pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  return last && last !== key ? last : undefined;
};

const resolveCocktail = (
  entry: BackNavigationEntry,
  cocktails: Cocktail[],
): Cocktail | undefined => {
  const value = resolveEntryId(entry, 'cocktailId');
  if (!value) {
    return undefined;
  }

  const numericId = Number(value);
  if (!Number.isNaN(numericId)) {
    const byId = cocktails.find((item) => Number(item.id ?? -1) === numericId);
    if (byId) {
      return byId;
    }
  }

  const normalized = normalizeSearchText(value);
  return cocktails.find((item) => normalizeSearchText(item.name ?? '') === normalized);
};

const resolveIngredient = (
  entry: BackNavigationEntry,
  ingredients: Ingredient[],
): Ingredient | undefined => {
  const value = resolveEntryId(entry, 'ingredientId');
  if (!value) {
    return undefined;
  }

  const numericId = Number(value);
  if (!Number.isNaN(numericId)) {
    const byId = ingredients.find((item) => Number(item.id ?? -1) === numericId);
    if (byId) {
      return byId;
    }
  }

  const normalized = normalizeSearchText(value);
  return ingredients.find((item) => normalizeSearchText(item.name ?? '') === normalized);
};

export function BackNavigationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams();
  const {
    ingredients,
    cocktails,
    availableIngredientIds,
    ignoreGarnish,
    allowAllSubstitutes,
  } = useInventory();
  const [history, setHistory] = useState<BackNavigationEntry[]>([]);
  const historyRef = useRef(history);
  const pendingSkipNextRef = useRef<Partial<BackNavigationEntry> | null>(null);
  const ignoreNextEntryRef = useRef<BackNavigationEntry | null>(null);
  const navigation = useNavigation();

  const normalizedParams = useMemo(
    () => normalizeParams(searchParams ?? null),
    [searchParams],
  );
  const paramsKey = useMemo(() => JSON.stringify(normalizedParams ?? {}), [normalizedParams]);

  const setHistoryState = useCallback((updater: BackNavigationEntry[] | ((prev: BackNavigationEntry[]) => BackNavigationEntry[])) => {
    setHistory((prev) => {
      const next = typeof updater === 'function'
        ? (updater as (prev: BackNavigationEntry[]) => BackNavigationEntry[])(prev)
        : updater;
      historyRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!pathname) {
      return;
    }

    const entry: BackNavigationEntry = {
      pathname,
      params: normalizedParams,
      timestamp: Date.now(),
      ...(pendingSkipNextRef.current ?? {}),
    };

    pendingSkipNextRef.current = null;

    if (ignoreNextEntryRef.current && areEntriesEqual(ignoreNextEntryRef.current, entry)) {
      ignoreNextEntryRef.current = null;
      return;
    }

    setHistoryState((prev) => {
      if (prev.length > 0 && areEntriesEqual(prev[prev.length - 1], entry)) {
        return prev;
      }
      return [...prev, entry];
    });
  }, [normalizedParams, paramsKey, pathname, setHistoryState]);

  const ingredientLookup = useMemo(
    () => createIngredientLookup(ingredients),
    [ingredients],
  );

  const isEntryAvailable = useCallback(
    (entry: BackNavigationEntry): boolean => {
      if (isIngredientDetailsPath(entry.pathname)) {
        const ingredient = resolveIngredient(entry, ingredients);
        if (!ingredient?.id) {
          return false;
        }
        const numericId = Number(ingredient.id);
        if (Number.isNaN(numericId)) {
          return false;
        }
        return availableIngredientIds.has(numericId);
      }

      if (isCocktailDetailsPath(entry.pathname)) {
        const cocktail = resolveCocktail(entry, cocktails);
        if (!cocktail) {
          return false;
        }
        return isCocktailReady(
          cocktail,
          availableIngredientIds,
          ingredientLookup,
          ingredients,
          { ignoreGarnish, allowAllSubstitutes },
        );
      }

      return true;
    },
    [allowAllSubstitutes, availableIngredientIds, cocktails, ingredients, ignoreGarnish, ingredientLookup],
  );

  const findBackTarget = useCallback(
    (entries: BackNavigationEntry[]): BackNavigationEntry | undefined => {
      if (entries.length < 2) {
        return undefined;
      }

      const current = entries[entries.length - 1];

      for (let index = entries.length - 2; index >= 0; index -= 1) {
        const candidate = entries[index];

        if (candidate.skipOnBack) {
          continue;
        }

        if (areEntriesEqual(candidate, current)) {
          continue;
        }

        if (isEditScreenEntry(candidate)) {
          continue;
        }

        if (!isEntryAvailable(candidate)) {
          continue;
        }

        return candidate;
      }

      return undefined;
    },
    [isEntryAvailable],
  );

  const goBack = useCallback(
    (fallback?: BackNavigationFallback) => {
      const entries = historyRef.current;
      const target = findBackTarget(entries);

      if (!target) {
        if (fallback) {
          router.navigate({ pathname: fallback.pathname, params: fallback.params });
          return;
        }
        if (navigation.canGoBack()) {
          navigation.goBack();
          return;
        }
        router.replace('/');
        return;
      }

      const targetIndex = entries.findIndex((entry) => areEntriesEqual(entry, target));
      if (targetIndex >= 0) {
        ignoreNextEntryRef.current = target;
        setHistoryState(entries.slice(0, targetIndex + 1));
      }

      router.navigate({ pathname: target.pathname, params: target.params });
    },
    [findBackTarget, navigation, setHistoryState],
  );

  const markCurrentEntryAsSkip = useCallback(() => {
    setHistoryState((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], skipOnBack: true };
      return next;
    });
  }, [setHistoryState]);

  const markNextEntryAsSkip = useCallback(() => {
    pendingSkipNextRef.current = { skipOnBack: true };
  }, []);

  const value = useMemo<BackNavigationContextValue>(
    () => ({
      history,
      goBack,
      markCurrentEntryAsSkip,
      markNextEntryAsSkip,
    }),
    [goBack, history, markCurrentEntryAsSkip, markNextEntryAsSkip],
  );

  return <BackNavigationContext.Provider value={value}>{children}</BackNavigationContext.Provider>;
}

export const useBackNavigation = (): BackNavigationContextValue => {
  const context = useContext(BackNavigationContext);
  if (!context) {
    throw new Error('useBackNavigation must be used within BackNavigationProvider');
  }
  return context;
};
