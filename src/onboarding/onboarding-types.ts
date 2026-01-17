import type { InventoryData } from '@/libs/inventory-data';

export type SpotlightTarget = {
  testId: string;
  layout: { x: number; y: number; width: number; height: number };
};

export type OnboardingStep = {
  id: string;
  title?: string;
  text: string;
  targetId?: string;
  routeTo?: () => void;
  onEnter?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
};

export type OnboardingSnapshot = {
  inventoryData: InventoryData | null;
  availableIngredientIds: number[];
  shoppingIngredientIds: number[];
  cocktailRatings: Record<string, number>;
  ignoreGarnish: boolean;
  allowAllSubstitutes: boolean;
  useImperialUnits: boolean;
  keepScreenAwake: boolean;
  ratingFilterThreshold: number;
  startScreen: string;
  createdIngredientIds: number[];
};
