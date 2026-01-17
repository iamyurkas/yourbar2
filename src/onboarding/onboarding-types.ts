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
  toggleIngredientShopping: (id: number) => void;
  setCocktailRating: (cocktailId: string, rating: number) => void;
  setStartScreen: (value: StartScreen) => void;
  getInventorySnapshot: () => InventorySnapshot | null;
  restoreInventorySnapshot: (snapshot: InventorySnapshot) => void;
};

export type OnboardingStepContext = {
  router: Router;
  inventory: OnboardingInventoryActions;
};

export type OnboardingStep = {
  id: string;
  title: string;
  body: string;
  targetId?: SpotlightTargetId;
  onEnter?: (context: OnboardingStepContext) => void | Promise<void>;
  onNext?: (context: OnboardingStepContext) => void | Promise<void>;
};

