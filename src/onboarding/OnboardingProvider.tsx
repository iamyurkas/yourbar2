import { useRouter } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ONBOARDING_STEPS } from './onboarding-steps';
import { loadOnboardingFlag, persistOnboardingFlag } from './onboarding-storage';
import type { OnboardingContextValue, OnboardingStepContext } from './onboarding-types';
import { useInventory, type OnboardingInventorySnapshot } from '@/providers/inventory-provider';
import { normalizeSearchText } from '@/libs/search-normalization';

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

type OnboardingProviderProps = {
  children: React.ReactNode;
};

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [lastNextStepId, setLastNextStepId] = useState<string | null>(null);
  const lastStepId = useRef<string | null>(null);
  const snapshotRef = useRef<OnboardingInventorySnapshot | null>(null);
  const router = useRouter();
  const {
    cocktails,
    ingredients,
    setIngredientAvailability,
    toggleIngredientShopping,
    setCocktailRating,
    createIngredient,
    deleteIngredient,
    shoppingIngredientIds,
    getOnboardingSnapshot,
    restoreOnboardingSnapshot,
  } = useInventory();
  const createdIngredientIds = useRef<number[]>([]);

  const markCompleted = useCallback(async () => {
    await persistOnboardingFlag(true);
  }, []);

  const resetSandbox = useCallback(() => {
    if (snapshotRef.current) {
      restoreOnboardingSnapshot(snapshotRef.current);
    }
    if (createdIngredientIds.current.length > 0) {
      createdIngredientIds.current.forEach((id) => {
        deleteIngredient(id);
      });
      createdIngredientIds.current = [];
    }
  }, [deleteIngredient, restoreOnboardingSnapshot]);

  const start = useCallback((force?: boolean) => {
    if (isActive) {
      if (!force) {
        return;
      }
      resetSandbox();
    }

    snapshotRef.current = getOnboardingSnapshot();
    lastStepId.current = null;
    setLastNextStepId(null);
    setCurrentStepIndex(0);
    setIsActive(true);
  }, [getOnboardingSnapshot, isActive, resetSandbox]);

  const stop = useCallback(() => {
    setIsActive(false);
    resetSandbox();
    snapshotRef.current = null;
    lastStepId.current = null;
    setLastNextStepId(null);
  }, [resetSandbox]);

  const stepContext = useMemo<OnboardingStepContext>(() => {
    const getCocktailIdByName = (name: string) => {
      const normalized = normalizeSearchText(name);
      const match = cocktails.find(
        (cocktail) => normalizeSearchText(cocktail.name ?? '') === normalized,
      );
      const id = match?.id ?? match?.name;
      return id ? String(id) : null;
    };

    const getIngredientIdByName = (name: string) => {
      const normalized = normalizeSearchText(name);
      const match = ingredients.find(
        (ingredient) => normalizeSearchText(ingredient.name ?? '') === normalized,
      );
      const id = Number(match?.id ?? -1);
      return Number.isFinite(id) && id >= 0 ? id : null;
    };

    const ensureIngredientIdByName = (name: string) => {
      const existing = getIngredientIdByName(name);
      if (existing != null) {
        return existing;
      }

      const created = createIngredient({ name });
      const createdId = Number(created?.id ?? -1);
      if (!Number.isFinite(createdId) || createdId < 0) {
        return null;
      }

      createdIngredientIds.current = [...createdIngredientIds.current, createdId];
      return createdId;
    };

    const setCocktailRatingById = (cocktailId: string, rating: number) => {
      const matched = cocktails.find((cocktail) => String(cocktail.id ?? '') === cocktailId);
      if (matched) {
        setCocktailRating(matched, rating);
      }
    };

    return {
      router: { navigate: router.navigate },
      inventory: {
        getCocktailIdByName,
        getIngredientIdByName,
        ensureIngredientIdByName,
        isIngredientOnShoppingList: (id: number) => shoppingIngredientIds.has(id),
        setIngredientAvailability,
        toggleIngredientShopping,
        setCocktailRating: setCocktailRatingById,
      },
    };
  }, [
    cocktails,
    createIngredient,
    ingredients,
    router.navigate,
    setCocktailRating,
    setIngredientAvailability,
    shoppingIngredientIds,
    toggleIngredientShopping,
  ]);

  const complete = useCallback(async () => {
    await markCompleted();
    stop();
  }, [markCompleted, stop]);

  const next = useCallback(() => {
    const step = ONBOARDING_STEPS[currentStepIndex];
    const isLastStep = currentStepIndex >= ONBOARDING_STEPS.length - 1;

    const runNext = async () => {
      if (step?.onNext) {
        await step.onNext(stepContext);
      }

      if (step?.id) {
        setLastNextStepId(step.id);
      }

      if (isLastStep) {
        await complete();
        return;
      }

      setCurrentStepIndex((prev) => Math.min(prev + 1, ONBOARDING_STEPS.length - 1));
    };

    void runNext();
  }, [complete, currentStepIndex, stepContext]);

  const prev = useCallback(() => {
    setCurrentStepIndex((prevValue) => Math.max(0, prevValue - 1));
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        const stored = await loadOnboardingFlag();
        if (!stored) {
          start();
        }
      } catch (error) {
        console.warn('Unable to read onboarding state', error);
        start();
      }
    };

    void initialize();
  }, [start]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const step = ONBOARDING_STEPS[currentStepIndex];
    if (!step) {
      return;
    }

    if (lastStepId.current === step.id) {
      return;
    }

    lastStepId.current = step.id;
    step.routeTo(stepContext.router);
    step.onEnter?.(stepContext);
  }, [currentStepIndex, isActive, stepContext]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      isActive,
      currentStepIndex,
      lastNextStepId,
      start,
      stop,
      next: () => {
        next();
      },
      prev,
    }),
    [currentStepIndex, isActive, lastNextStepId, next, prev, start, stop],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }

  return context;
}
