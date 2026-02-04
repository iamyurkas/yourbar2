import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DEFAULT_ONBOARDING_STEP, type OnboardingStep } from '@/libs/onboarding';
import { useInventory } from '@/providers/inventory-provider';

type OnboardingContextValue = {
  step: OnboardingStep | null;
  setStep: (step: OnboardingStep | null) => void;
  restartOnboarding: () => void;
  completeOnboarding: () => void;
  isActive: boolean;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

type OnboardingProviderProps = {
  children: React.ReactNode;
};

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const { onboardingCompleted, setOnboardingCompleted } = useInventory();
  const [step, setStep] = useState<OnboardingStep | null>(() =>
    onboardingCompleted ? null : DEFAULT_ONBOARDING_STEP,
  );

  useEffect(() => {
    if (onboardingCompleted && step !== null) {
      setStep(null);
    } else if (!onboardingCompleted && step === null) {
      setStep(DEFAULT_ONBOARDING_STEP);
    }
  }, [onboardingCompleted, step]);

  const restartOnboarding = useCallback(() => {
    setOnboardingCompleted(false);
    setStep(DEFAULT_ONBOARDING_STEP);
  }, [setOnboardingCompleted]);

  const completeOnboarding = useCallback(() => {
    setOnboardingCompleted(true);
    setStep(null);
  }, [setOnboardingCompleted]);

  const value = useMemo(
    () => ({
      step,
      setStep,
      restartOnboarding,
      completeOnboarding,
      isActive: step != null,
    }),
    [completeOnboarding, restartOnboarding, step],
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
