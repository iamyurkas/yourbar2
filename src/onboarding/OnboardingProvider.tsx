import { useRouter } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ONBOARDING_STEPS } from '@/src/onboarding/onboarding-steps';
import type {
  OnboardingInventoryActions,
  OnboardingStep,
  OnboardingStepContext,
  OnboardingUiAction,
} from '@/src/onboarding/onboarding-types';
import { loadOnboardingState, persistOnboardingState } from '@/src/onboarding/onboarding-storage';
import { normalizeSearchText } from '@/libs/search-normalization';
import { useInventory, type Cocktail } from '@/providers/inventory-provider';

type OnboardingContextValue = {
  isActive: boolean;
  currentStepIndex: number;
  steps: OnboardingStep[];
  hasSeenOnboarding: boolean;
  start: (force?: boolean) => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  uiAction: OnboardingUiAction | null;
  emitUiAction: (action: OnboardingUiAction) => void;
  clearUiAction: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const inventory = useInventory();
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [uiAction, setUiAction] = useState<OnboardingUiAction | null>(null);
  const snapshotRef = useRef(inventory.getInventorySnapshot());

  const steps = ONBOARDING_STEPS;

  const inventoryActions = useMemo<OnboardingInventoryActions>(
    () => ({
      toggleIngredientAvailability: inventory.toggleIngredientAvailability,
      setIngredientAvailabilityByName: (name: string, available: boolean) => {
        const normalizedName = normalizeSearchText(name);
        const targetIngredient = inventory.ingredients.find((candidate) => {
          const candidateName = normalizeSearchText(candidate.name ?? '');
          return candidateName === normalizedName || candidateName.includes(normalizedName);
        });
        const ingredientId = Number(targetIngredient?.id ?? -1);
        if (ingredientId >= 0) {
          inventory.setIngredientAvailability(ingredientId, available);
        }
      },
      toggleIngredientShopping: inventory.toggleIngredientShopping,
      setCocktailRating: (cocktailId: string, rating: number) => {
        const targetCocktail = inventory.cocktails.find(
          (candidate) => String(candidate.id ?? candidate.name ?? '') === cocktailId,
        );
        if (targetCocktail) {
          inventory.setCocktailRating(targetCocktail as Cocktail, rating);
        }
      },
      setStartScreen: inventory.setStartScreen,
      getInventorySnapshot: inventory.getInventorySnapshot,
      restoreInventorySnapshot: inventory.restoreInventorySnapshot,
    }),
    [inventory],
  );

  const createStepContext = useCallback((): OnboardingStepContext => {
    return {
      router,
      inventory: inventoryActions,
      emitUiAction: (action: OnboardingUiAction) => {
        setUiAction(action);
      },
    };
  }, [inventoryActions, router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadOnboardingState();
      if (cancelled) {
        return;
      }

      const hasSeen = stored?.hasSeenOnboarding ?? false;
      setHasSeenOnboarding(hasSeen);
      setIsReady(true);

      if (!hasSeen) {
        start(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [start]);

  useEffect(() => {
    if (!isReady || !isActive) {
      return;
    }

    if (!steps.length) {
      return;
    }

    const step = steps[currentStepIndex];
    if (!step) {
      return;
    }

    void step.onEnter?.(createStepContext());
  }, [createStepContext, currentStepIndex, isActive, isReady, steps]);

  const start = useCallback(
    (force = false) => {
      if (!steps.length) {
        return;
      }

      if (!force && hasSeenOnboarding) {
        return;
      }

      snapshotRef.current = inventory.getInventorySnapshot();
      setUiAction(null);
      setIsActive(true);
      setCurrentStepIndex(0);
    },
    [hasSeenOnboarding, inventory, steps.length],
  );

  const stop = useCallback(() => {
    const snapshot = snapshotRef.current;
    if (snapshot) {
      inventory.restoreInventorySnapshot(snapshot);
    }

    snapshotRef.current = null;
    setUiAction(null);
    setIsActive(false);
    setCurrentStepIndex(0);
  }, [inventory]);

  const finish = useCallback(async () => {
    setHasSeenOnboarding(true);
    await persistOnboardingState({ hasSeenOnboarding: true });
    stop();
  }, [stop]);

  const next = useCallback(() => {
    if (!steps.length || !isActive) {
      return;
    }

    const step = steps[currentStepIndex];
    if (!step) {
      return;
    }

    void (async () => {
      await step.onNext?.(createStepContext());
      const isLastStep = currentStepIndex >= steps.length - 1;
      if (isLastStep) {
        await finish();
      } else {
        setCurrentStepIndex((prev) => prev + 1);
      }
    })();
  }, [createStepContext, currentStepIndex, finish, isActive, steps]);

  const prev = useCallback(() => {
    if (!isActive) {
      return;
    }

    setCurrentStepIndex((prevIndex) => Math.max(0, prevIndex - 1));
  }, [isActive]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      isActive,
      currentStepIndex,
      steps,
      hasSeenOnboarding,
      start,
      stop,
      next,
      prev,
      uiAction,
      emitUiAction: setUiAction,
      clearUiAction: () => setUiAction(null),
    }),
    [
      currentStepIndex,
      hasSeenOnboarding,
      isActive,
      next,
      prev,
      uiAction,
      start,
      steps,
      stop,
    ],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);

  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }

  return context;
}
