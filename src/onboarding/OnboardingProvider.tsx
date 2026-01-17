import { useRouter } from 'expo-router';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { LayoutRectangle } from 'react-native';

import { ONBOARDING_STEPS } from '@/src/onboarding/onboarding-steps';
import type {
  OnboardingInventoryActions,
  OnboardingStep,
  OnboardingStepContext,
  SpotlightTargetId,
} from '@/src/onboarding/onboarding-types';
import { loadOnboardingState, persistOnboardingState } from '@/src/onboarding/onboarding-storage';
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
  registerTarget: (id: SpotlightTargetId, layout: LayoutRectangle, testID: string) => void;
  targetLayouts: Record<SpotlightTargetId, { layout: LayoutRectangle; testID: string }>;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const inventory = useInventory();
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [targetLayouts, setTargetLayouts] = useState<
    Record<SpotlightTargetId, { layout: LayoutRectangle; testID: string }>
  >({});
  const snapshotRef = useRef(inventory.getInventorySnapshot());

  const steps = ONBOARDING_STEPS;

  const inventoryActions = useMemo<OnboardingInventoryActions>(
    () => ({
      toggleIngredientAvailability: inventory.toggleIngredientAvailability,
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

  const registerTarget = useCallback(
    (id: SpotlightTargetId, layout: LayoutRectangle, testID: string) => {
      setTargetLayouts((prev) => ({
        ...prev,
        [id]: {
          layout,
          testID,
        },
      }));
    },
    [],
  );

  const start = useCallback(
    (force = false) => {
      if (!steps.length) {
        return;
      }

      if (!force && hasSeenOnboarding) {
        return;
      }

      snapshotRef.current = inventory.getInventorySnapshot();
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
      registerTarget,
      targetLayouts,
    }),
    [
      currentStepIndex,
      hasSeenOnboarding,
      isActive,
      next,
      prev,
      registerTarget,
      start,
      steps,
      stop,
      targetLayouts,
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

export function useSpotlightTarget(id: SpotlightTargetId) {
  const { registerTarget } = useOnboarding();

  const testID = `onboarding-target-${id}`;
  const handleLayout = useCallback(
    (event: { nativeEvent: { layout: LayoutRectangle } }) => {
      registerTarget(id, event.nativeEvent.layout, testID);
    },
    [id, registerTarget, testID],
  );

  return {
    testID,
    onLayout: handleLayout,
  };
}
