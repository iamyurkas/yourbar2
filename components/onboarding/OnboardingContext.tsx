import React, { createContext, useContext, useCallback, useRef, useState } from 'react';
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
  registerAction: (name: string, action: () => void) => () => void;
  triggerAction: (name: string) => void;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [anchors, setAnchors] = useState<Record<string, LayoutRectangle>>({});
  const [listeners] = useState<Set<(screen: 'ingredients' | 'cocktails', tab: string) => void>>(new Set());
  const actionsRef = useRef<Map<string, () => void>>(new Map());

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

  const registerAction = useCallback((name: string, action: () => void) => {
    actionsRef.current.set(name, action);
    return () => {
      actionsRef.current.delete(name);
    };
  }, []);

  const triggerAction = useCallback((name: string) => {
    actionsRef.current.get(name)?.();
  }, []);

  return (
    <OnboardingContext.Provider value={{ anchors, registerAnchor, unregisterAnchor, requestTabChange, onTabChangeRequest, registerAction, triggerAction }}>
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
