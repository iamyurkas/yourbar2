import { useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { createOnboardingSteps } from '@/src/onboarding/onboarding-steps';
import type { OnboardingContext, OnboardingStep } from '@/src/onboarding/onboarding-types';
import { loadHasSeenOnboarding, persistHasSeenOnboarding } from '@/src/onboarding/onboarding-storage';
import { useInventory } from '@/providers/inventory-provider';
import type { InventoryData } from '@/libs/inventory-data';

type OnboardingContextValue = {
  isActive: boolean;
  currentStepIndex: number;
  steps: OnboardingStep[];
  start: (force?: boolean) => Promise<void>;
  stop: (options?: { completed?: boolean }) => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

type OnboardingProviderProps = {
  children: ReactNode;
};

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const router = useRouter();
  const inventory = useInventory();
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const snapshotRef = useRef<InventoryData | null>(null);

  const steps = useMemo(() => createOnboardingSteps(), []);

  const onboardingContext = useMemo<OnboardingContext>(
    () => ({
      router,
      inventory,
    }),
    [inventory, router],
  );

  const activateStep = useCallback(
    async (index: number) => {
      setCurrentStepIndex(index);
      const step = steps[index];
      if (step?.onEnter) {
        await step.onEnter(onboardingContext);
      }
    },
    [onboardingContext, steps],
  );

  const start = useCallback(
    async (force = false) => {
      if (!force && hasSeenOnboarding) {
        return;
      }

      if (steps.length === 0) {
        return;
      }

      snapshotRef.current = inventory.exportInventoryData();
      setIsActive(true);
      await activateStep(0);
    },
    [activateStep, hasSeenOnboarding, inventory, steps.length],
  );

  const stop = useCallback(
    async (options?: { completed?: boolean }) => {
      setIsActive(false);
      setCurrentStepIndex(-1);

      if (snapshotRef.current) {
        inventory.importInventoryData(snapshotRef.current);
        snapshotRef.current = null;
      }

      if (options?.completed) {
        await persistHasSeenOnboarding(true);
        setHasSeenOnboarding(true);
      }
    },
    [inventory],
  );

  const next = useCallback(async () => {
    if (!isActive) {
      return;
    }

    const step = steps[currentStepIndex];
    if (!step) {
      return;
    }

    if (step.onNext) {
      await step.onNext(onboardingContext);
    }

    const nextIndex = currentStepIndex + 1;

    if (nextIndex >= steps.length) {
      await stop({ completed: true });
      return;
    }

    await activateStep(nextIndex);
  }, [activateStep, currentStepIndex, isActive, onboardingContext, steps, stop]);

  const prev = useCallback(async () => {
    if (!isActive) {
      return;
    }

    const prevIndex = currentStepIndex - 1;
    if (prevIndex < 0) {
      return;
    }

    await activateStep(prevIndex);
  }, [activateStep, currentStepIndex, isActive]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const hasSeen = await loadHasSeenOnboarding();

      if (!isMounted) {
        return;
      }

      setHasSeenOnboarding(hasSeen);

      if (!hasSeen) {
        await start(true);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [start]);

  const value = useMemo(
    () => ({
      isActive,
      currentStepIndex,
      steps,
      start,
      stop,
      next,
      prev,
    }),
    [currentStepIndex, isActive, next, prev, start, steps, stop],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
