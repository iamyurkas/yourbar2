import React, { createContext, useContext, useCallback, useState } from 'react';
import { type LayoutRectangle } from 'react-native';

export type AnchorInfo = {
  name: string;
  layout: LayoutRectangle;
};

type OnboardingContextValue = {
  anchors: Record<string, LayoutRectangle>;
  registerAnchor: (name: string, layout: LayoutRectangle) => void;
  unregisterAnchor: (name: string) => void;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [anchors, setAnchors] = useState<Record<string, LayoutRectangle>>({});

  const registerAnchor = useCallback((name: string, layout: LayoutRectangle) => {
    setAnchors((prev) => ({ ...prev, [name]: layout }));
  }, []);

  const unregisterAnchor = useCallback((name: string) => {
    setAnchors((prev) => {
      if (!(name in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  return (
    <OnboardingContext.Provider value={{ anchors, registerAnchor, unregisterAnchor }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboardingAnchors() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboardingAnchors must be used within an OnboardingProvider');
  }
  return context;
}
