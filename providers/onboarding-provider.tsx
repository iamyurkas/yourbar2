import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type OnboardingContextValue = {
  onboardingSessionId: number;
  isOnboardingActive: boolean;
  startOnboarding: () => void;
  finishOnboarding: () => void;
  restartOnboarding: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [onboardingSessionId, setOnboardingSessionId] = useState(0);
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);

  const startOnboarding = useCallback(() => {
    setIsOnboardingActive(true);
  }, []);

  const finishOnboarding = useCallback(() => {
    setIsOnboardingActive(false);
  }, []);

  const restartOnboarding = useCallback(() => {
    setOnboardingSessionId((current) => current + 1);
    setIsOnboardingActive(true);
  }, []);

  const value = useMemo(
    () => ({
      onboardingSessionId,
      isOnboardingActive,
      startOnboarding,
      finishOnboarding,
      restartOnboarding,
    }),
    [finishOnboarding, isOnboardingActive, onboardingSessionId, restartOnboarding, startOnboarding],
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
