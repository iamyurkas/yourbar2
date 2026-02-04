import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useInventory } from '@/providers/inventory-provider';

export type OnboardingStep = 'ingredients' | 'cocktails' | 'shaker';

type OnboardingContextValue = {
  activeStep: OnboardingStep | null;
  isActive: boolean;
  startOnboarding: () => void;
  goToStep: (step: OnboardingStep) => void;
  completeOnboarding: () => void;
  restartOnboarding: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

type OnboardingProviderProps = {
  children: React.ReactNode;
};

const STEP_ORDER: OnboardingStep[] = ['ingredients', 'cocktails', 'shaker'];

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const { onboardingCompleted, setOnboardingCompleted } = useInventory();
  const [activeStep, setActiveStep] = useState<OnboardingStep | null>(
    () => (onboardingCompleted ? null : STEP_ORDER[0]),
  );
  const [isActive, setIsActive] = useState<boolean>(() => !onboardingCompleted);

  useEffect(() => {
    if (onboardingCompleted) {
      setActiveStep(null);
      setIsActive(false);
      return;
    }

    setActiveStep((previous) => previous ?? STEP_ORDER[0]);
    setIsActive(true);
  }, [onboardingCompleted]);

  const startOnboarding = useCallback(() => {
    setOnboardingCompleted(false);
    setActiveStep(STEP_ORDER[0]);
    setIsActive(true);
  }, [setOnboardingCompleted]);

  const restartOnboarding = useCallback(() => {
    startOnboarding();
  }, [startOnboarding]);

  const goToStep = useCallback((step: OnboardingStep) => {
    setActiveStep(step);
    setIsActive(true);
  }, []);

  const completeOnboarding = useCallback(() => {
    setActiveStep(null);
    setIsActive(false);
    setOnboardingCompleted(true);
  }, [setOnboardingCompleted]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      activeStep,
      isActive,
      startOnboarding,
      goToStep,
      completeOnboarding,
      restartOnboarding,
    }),
    [activeStep, isActive, startOnboarding, goToStep, completeOnboarding, restartOnboarding],
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
