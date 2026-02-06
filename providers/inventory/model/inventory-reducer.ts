import {
  type AppTheme,
  type CocktailTag,
  type IngredientTag,
  type StartScreen
} from '@/providers/inventory-types';
import { type InventoryState } from '../persistence/snapshot-logic';

export type FullInventoryState = {
  inventoryState: InventoryState | undefined;
  loading: boolean;
  availableIngredientIds: Set<number>;
  shoppingIngredientIds: Set<number>;
  cocktailRatings: Record<string, number>;
  ignoreGarnish: boolean;
  allowAllSubstitutes: boolean;
  useImperialUnits: boolean;
  keepScreenAwake: boolean;
  ratingFilterThreshold: number;
  startScreen: StartScreen;
  appTheme: AppTheme;
  customCocktailTags: CocktailTag[];
  customIngredientTags: IngredientTag[];
  onboardingStep: number;
  onboardingCompleted: boolean;
};

export type InventoryAction =
  | { type: 'INIT'; payload: FullInventoryState }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_INVENTORY_STATE'; payload: InventoryState | undefined }
  | { type: 'SET_AVAILABLE_INGREDIENTS'; payload: Set<number> }
  | { type: 'SET_SHOPPING_INGREDIENTS'; payload: Set<number> }
  | { type: 'SET_COCKTAIL_RATINGS'; payload: Record<string, number> }
  | { type: 'SET_IGNORE_GARNISH'; payload: boolean }
  | { type: 'SET_ALLOW_ALL_SUBSTITUTES'; payload: boolean }
  | { type: 'SET_USE_IMPERIAL_UNITS'; payload: boolean }
  | { type: 'SET_KEEP_SCREEN_AWAKE'; payload: boolean }
  | { type: 'SET_RATING_FILTER_THRESHOLD'; payload: number }
  | { type: 'SET_START_SCREEN'; payload: StartScreen }
  | { type: 'SET_APP_THEME'; payload: AppTheme }
  | { type: 'SET_CUSTOM_COCKTAIL_TAGS'; payload: CocktailTag[] }
  | { type: 'SET_CUSTOM_INGREDIENT_TAGS'; payload: IngredientTag[] }
  | { type: 'SET_ONBOARDING_STEP'; payload: number }
  | { type: 'SET_ONBOARDING_COMPLETED'; payload: boolean };

export function inventoryReducer(state: FullInventoryState, action: InventoryAction): FullInventoryState {
  switch (action.type) {
    case 'INIT':
      return action.payload;
    case 'SET_LOADING':
      if (state.loading === action.payload) return state;
      return { ...state, loading: action.payload };
    case 'SET_INVENTORY_STATE':
      if (state.inventoryState === action.payload) return state;
      return { ...state, inventoryState: action.payload };
    case 'SET_AVAILABLE_INGREDIENTS':
      return { ...state, availableIngredientIds: action.payload };
    case 'SET_SHOPPING_INGREDIENTS':
      return { ...state, shoppingIngredientIds: action.payload };
    case 'SET_COCKTAIL_RATINGS':
      return { ...state, cocktailRatings: action.payload };
    case 'SET_IGNORE_GARNISH':
      if (state.ignoreGarnish === action.payload) return state;
      return { ...state, ignoreGarnish: action.payload };
    case 'SET_ALLOW_ALL_SUBSTITUTES':
      if (state.allowAllSubstitutes === action.payload) return state;
      return { ...state, allowAllSubstitutes: action.payload };
    case 'SET_USE_IMPERIAL_UNITS':
      if (state.useImperialUnits === action.payload) return state;
      return { ...state, useImperialUnits: action.payload };
    case 'SET_KEEP_SCREEN_AWAKE':
      if (state.keepScreenAwake === action.payload) return state;
      return { ...state, keepScreenAwake: action.payload };
    case 'SET_RATING_FILTER_THRESHOLD':
      if (state.ratingFilterThreshold === action.payload) return state;
      return { ...state, ratingFilterThreshold: action.payload };
    case 'SET_START_SCREEN':
      if (state.startScreen === action.payload) return state;
      return { ...state, startScreen: action.payload };
    case 'SET_APP_THEME':
      if (state.appTheme === action.payload) return state;
      return { ...state, appTheme: action.payload };
    case 'SET_CUSTOM_COCKTAIL_TAGS':
      return { ...state, customCocktailTags: action.payload };
    case 'SET_CUSTOM_INGREDIENT_TAGS':
      return { ...state, customIngredientTags: action.payload };
    case 'SET_ONBOARDING_STEP':
      if (state.onboardingStep === action.payload) return state;
      return { ...state, onboardingStep: action.payload };
    case 'SET_ONBOARDING_COMPLETED':
      if (state.onboardingCompleted === action.payload) return state;
      return { ...state, onboardingCompleted: action.payload };
    default:
      return state;
  }
}
