import type { LayoutRectangle } from 'react-native';
import type { Router } from 'expo-router';

import type { InventorySnapshot, StartScreen } from '@/providers/inventory-provider';

export type SpotlightTargetId = string;

export type SpotlightTarget = {
  id: SpotlightTargetId;
  layout: LayoutRectangle;
  testID: string;
};

export type OnboardingInventoryActions = {
  toggleIngredientAvailability: (id: number) => void;
  setIngredientAvailabilityByName: (name: string, available: boolean) => void;
  toggleIngredientShopping: (id: number) => void;
  setCocktailRating: (cocktailId: string, rating: number) => void;
  setStartScreen: (value: StartScreen) => void;
  getInventorySnapshot: () => InventorySnapshot | null;
  restoreInventorySnapshot: (snapshot: InventorySnapshot) => void;
};

export type OnboardingStepContext = {
  router: Router;
  inventory: OnboardingInventoryActions;
  emitUiAction: (action: OnboardingUiAction) => void;
};

export type OnboardingStep = {
  id: string;
  title?: string;
  body: string;
  targetId?: SpotlightTargetId;
  spotlightOffsetY?: number;
  onEnter?: (context: OnboardingStepContext) => void | Promise<void>;
  onNext?: (context: OnboardingStepContext) => void | Promise<void>;
};

export type OnboardingUiAction =
  | {
      type: 'ingredients_search';
      value: string;
      stepId: string;
    };
