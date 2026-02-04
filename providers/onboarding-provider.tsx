import { useRouter } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { type LayoutRectangle } from 'react-native';

import { useInventory } from '@/providers/inventory-provider';

export type StepDef = {
  id: string;
  title: string;
  content: string;
  anchorId?: string;
  buttonLabel?: string;
  onNext?: () => void;
  onEnter?: () => void;
  highlightPadding?: number;
};

type OnboardingContextValue = {
  isActive: boolean;
  currentStep: StepDef | null;
  registerAnchor: (id: string, layout: LayoutRectangle) => void;
  unregisterAnchor: (id: string) => void;
  getAnchorLayout: (id: string) => LayoutRectangle | null;
  nextStep: () => void;
  prevStep: () => void;
  complete: () => void;
  requestTabChange: (tab: string) => void;
  requestShakerChange: (inStock: boolean, expandedKeys?: string[]) => void;
  onTabChangeRequest: (callback: (tab: string) => void) => () => void;
  onShakerChangeRequest: (callback: (inStock: boolean, expandedKeys?: string[]) => void) => () => void;
  stepIndex: number;
  totalSteps: number;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const {
    onboardingState,
    setOnboardingState,
    availableIngredientIds,
    setIngredientAvailability,
  } = useInventory();
  const [anchors, setAnchors] = useState<Record<string, LayoutRectangle>>({});
  const [tabChangeListeners] = useState(new Set<(tab: string) => void>());
  const [shakerChangeListeners] = useState(new Set<(inStock: boolean, expandedKeys?: string[]) => void>());

  const steps = useMemo<StepDef[]>(() => [
    {
      id: 'welcome_ingredients',
      title: 'Ingredients',
      content: 'Welcome! Here you can manage your bar ingredients.',
      buttonLabel: 'Start',
      onEnter: () => {
        router.push('/ingredients');
      },
    },
    {
      id: 'ingredients_all_tab',
      title: 'All Ingredients',
      content: 'In the "All" tab, you can find and add ingredients to your bar.',
      anchorId: 'ingredients_tab_all',
      onEnter: () => {
        tabChangeListeners.forEach(cb => cb('all'));
      },
    },
    {
      id: 'ingredients_add_cola',
      title: 'Add Cola',
      content: 'Find and add Cola to your bar.',
      anchorId: 'ingredient_210',
      onNext: () => setIngredientAvailability(210, true),
    },
    {
      id: 'ingredients_add_ice',
      title: 'Add Ice',
      content: 'Find and add Ice to your bar.',
      anchorId: 'ingredient_295',
      onNext: () => setIngredientAvailability(295, true),
    },
    {
      id: 'ingredients_add_rum',
      title: 'Add Spiced Rum',
      content: 'Finally, add Spiced Rum.',
      anchorId: 'ingredient_418',
      onNext: () => setIngredientAvailability(418, true),
    },
    {
      id: 'ingredients_my_tab',
      title: 'My Ingredients',
      content: 'Now switch to the "My" tab to see what you have in stock.',
      anchorId: 'ingredients_tab_my',
      onNext: () => {
        tabChangeListeners.forEach(cb => cb('my'));
      },
    },
    {
      id: 'cocktails_tab',
      title: 'My Cocktails',
      content: 'Now let\'s see what cocktails you can make!',
      anchorId: 'tab_cocktails',
      onNext: () => {
        router.push('/cocktails');
      },
    },
    {
      id: 'cocktails_my_tab',
      title: 'My Cocktails',
      content: 'In the "My" tab, you will see cocktails available with your current ingredients.',
      anchorId: 'cocktails_tab_my',
      onEnter: () => {
        tabChangeListeners.forEach(cb => cb('my'));
      },
    },
    {
      id: 'cocktails_missing_one',
      title: 'Missing One',
      content: 'Below you can find cocktails where only one ingredient is missing.',
      anchorId: 'cocktails_missing_separator',
    },
    {
      id: 'shaker_tab',
      title: 'Shaker',
      content: 'Check out the Shaker to find recipes by specific ingredients!',
      anchorId: 'tab_shaker',
      onNext: () => {
        router.push('/shaker');
      },
    },
    {
      id: 'shaker_logic_or',
      title: 'Shaker: OR Logic',
      content: 'Ingredients within the same category are interchangeable (OR). For example: Gin OR Whiskey.',
      anchorId: 'shaker_group_spirit',
    },
    {
      id: 'shaker_logic_and',
      title: 'Shaker: AND Logic',
      content: 'Ingredients from different categories are combined (AND). Example: (Gin OR Whiskey) AND (Cola OR Tonic).',
      anchorId: 'shaker_list',
    },
    {
      id: 'shaker_filter',
      title: 'Shaker: Availability',
      content: 'Use this toggle to filter ingredients by what you currently have in stock.',
      anchorId: 'shaker_in_stock_toggle',
      onEnter: () => {
        shakerChangeListeners.forEach(cb => cb(true, ['0']));
      },
    },
    {
      id: 'complete',
      title: 'All set!',
      content: 'You are ready to mix some drinks. Cheers!',
      buttonLabel: 'Finish',
    },
  ], [router]);

  const stepIndex = onboardingState.stepIndex;
  const isActive = !onboardingState.completed && stepIndex < steps.length;
  const currentStep = isActive ? steps[stepIndex] : null;

  useEffect(() => {
    if (currentStep?.onEnter) {
      currentStep.onEnter();
    }
  }, [currentStep]);

  const registerAnchor = useCallback((id: string, layout: LayoutRectangle) => {
    setAnchors((prev) => ({ ...prev, [id]: layout }));
  }, []);

  const unregisterAnchor = useCallback((id: string) => {
    setAnchors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const getAnchorLayout = useCallback((id: string) => anchors[id] || null, [anchors]);

  const nextStep = useCallback(() => {
    if (currentStep?.onNext) {
      currentStep.onNext();
    }
    const nextIndex = stepIndex + 1;
    if (nextIndex >= steps.length) {
      setOnboardingState({ completed: true });
    } else {
      setOnboardingState({ stepIndex: nextIndex });
    }
  }, [currentStep, stepIndex, steps.length, setOnboardingState]);

  const prevStep = useCallback(() => {
    if (stepIndex > 0) {
      setOnboardingState({ stepIndex: stepIndex - 1 });
    }
  }, [stepIndex, setOnboardingState]);

  const complete = useCallback(() => {
    setOnboardingState({ completed: true });
  }, [setOnboardingState]);

  const requestTabChange = useCallback((tab: string) => {
    tabChangeListeners.forEach((cb) => cb(tab));
  }, [tabChangeListeners]);

  const requestShakerChange = useCallback((inStock: boolean, expandedKeys?: string[]) => {
    shakerChangeListeners.forEach((cb) => cb(inStock, expandedKeys));
  }, [shakerChangeListeners]);

  const onTabChangeRequest = useCallback((callback: (tab: string) => void) => {
    tabChangeListeners.add(callback);
    return () => tabChangeListeners.delete(callback);
  }, [tabChangeListeners]);

  const onShakerChangeRequest = useCallback((callback: (inStock: boolean, expandedKeys?: string[]) => void) => {
    shakerChangeListeners.add(callback);
    return () => shakerChangeListeners.delete(callback);
  }, [shakerChangeListeners]);

  const visibleSteps = useMemo(() => steps.filter(s => !!s.buttonLabel), [steps]);
  const visibleTotal = visibleSteps.length;
  const visibleStepIndex = visibleSteps.findIndex(s => s.id === currentStep?.id);

  const value = useMemo(() => ({
    isActive,
    currentStep,
    registerAnchor,
    unregisterAnchor,
    getAnchorLayout,
    nextStep,
    prevStep,
    complete,
    requestTabChange,
    requestShakerChange,
    onTabChangeRequest,
    onShakerChangeRequest,
    stepIndex,
    visibleStepIndex,
    totalSteps: visibleTotal,
  }), [
    isActive,
    currentStep,
    registerAnchor,
    unregisterAnchor,
    getAnchorLayout,
    nextStep,
    prevStep,
    complete,
    requestTabChange,
    requestShakerChange,
    onTabChangeRequest,
    onShakerChangeRequest,
    stepIndex,
    steps,
  ]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
