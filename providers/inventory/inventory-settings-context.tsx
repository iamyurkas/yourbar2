import { createContext, useContext } from 'react';

import type { AmazonStorePreference, AppTheme, StartScreen } from '@/providers/inventory-types';

export type InventorySettingsContextValue = {
  ignoreGarnish: boolean;
  allowAllSubstitutes: boolean;
  useImperialUnits: boolean;
  keepScreenAwake: boolean;
  shakerSmartFilteringEnabled: boolean;
  ratingFilterThreshold: number;
  startScreen: StartScreen;
  appTheme: AppTheme;
  onboardingStep: number;
  onboardingCompleted: boolean;
  amazonStorePreference: AmazonStorePreference;
};

export const InventorySettingsContext = createContext<InventorySettingsContextValue | undefined>(undefined);

export function useInventorySettings() {
  const context = useContext(InventorySettingsContext);

  if (!context) {
    throw new Error('useInventorySettings must be used within an InventoryProvider');
  }

  return context;
}
