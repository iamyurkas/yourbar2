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
  requestTabChange: (screen: 'ingredients' | 'cocktails', tab: string) => void;
  onTabChangeRequest: (callback: (screen: 'ingredients' | 'cocktails', tab: string) => void) => () => void;
  requestShakerChange: (action: 'set-in-stock' | 'expand-all', value: boolean) => void;
  onShakerChangeRequest: (callback: (action: 'set-in-stock' | 'expand-all', value: boolean) => void) => () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [anchors, setAnchors] = useState<Record<string, LayoutRectangle>>({});
  const [listeners] = useState<Set<(screen: 'ingredients' | 'cocktails', tab: string) => void>>(new Set());
  const [shakerListeners] = useState<Set<(action: 'set-in-stock' | 'expand-all', value: boolean) => void>>(new Set());

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

  const requestTabChange = useCallback((screen: 'ingredients' | 'cocktails', tab: string) => {
    listeners.forEach(l => l(screen, tab));
  }, [listeners]);

  const onTabChangeRequest = useCallback((callback: (screen: 'ingredients' | 'cocktails', tab: string) => void) => {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  }, [listeners]);

  const requestShakerChange = useCallback((action: 'set-in-stock' | 'expand-all', value: boolean) => {
    shakerListeners.forEach(l => l(action, value));
  }, [shakerListeners]);

  const onShakerChangeRequest = useCallback((callback: (action: 'set-in-stock' | 'expand-all', value: boolean) => void) => {
    shakerListeners.add(callback);
    return () => {
      shakerListeners.delete(callback);
    };
  }, [shakerListeners]);

  return (
    <OnboardingContext.Provider value={{
      anchors,
      registerAnchor,
      unregisterAnchor,
      requestTabChange,
      onTabChangeRequest,
      requestShakerChange,
      onShakerChangeRequest
    }}>
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
