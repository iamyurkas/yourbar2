import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_START_SCREEN,
  getCocktailTabFromStartScreen,
  getIngredientTabFromStartScreen,
  type StartScreenKey,
} from '@/libs/start-screen';
import { loadStartScreenPreference, persistStartScreenPreference } from '@/libs/start-screen-storage';
import { setLastCocktailTab, setLastIngredientTab } from '@/libs/collection-tabs';

type StartScreenContextValue = {
  startScreen: StartScreenKey;
  setStartScreen: (key: StartScreenKey) => void;
  loading: boolean;
};

const StartScreenContext = createContext<StartScreenContextValue | null>(null);

type StartScreenProviderProps = {
  children: React.ReactNode;
};

function applyTabPreference(key: StartScreenKey) {
  const cocktailTab = getCocktailTabFromStartScreen(key);
  if (cocktailTab) {
    setLastCocktailTab(cocktailTab);
  }

  const ingredientTab = getIngredientTabFromStartScreen(key);
  if (ingredientTab) {
    setLastIngredientTab(ingredientTab);
  }
}

export function StartScreenProvider({ children }: StartScreenProviderProps) {
  const [startScreen, setStartScreenValue] = useState<StartScreenKey>(DEFAULT_START_SCREEN);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    loadStartScreenPreference()
      .then((stored) => {
        if (stored && isMounted) {
          setStartScreenValue(stored);
          applyTabPreference(stored);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const updateStartScreen = useCallback((key: StartScreenKey) => {
    setStartScreenValue(key);
    applyTabPreference(key);
    void persistStartScreenPreference(key);
  }, []);

  const value = useMemo(
    () => ({
      startScreen,
      setStartScreen: updateStartScreen,
      loading,
    }),
    [loading, startScreen, updateStartScreen],
  );

  return <StartScreenContext.Provider value={value}>{children}</StartScreenContext.Provider>;
}

export function useStartScreenPreference() {
  const context = useContext(StartScreenContext);
  if (!context) {
    throw new Error('useStartScreenPreference must be used within StartScreenProvider');
  }

  return context;
}
