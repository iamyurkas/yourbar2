import { createContext, useContext } from 'react';

import type { AmazonStoreKey, AmazonStoreOverride } from '@/libs/amazon-stores';
import type { AppTheme, StartScreen } from '@/providers/inventory-types';

export type InventorySettingsContextValue = {
  ignoreGarnish: boolean;
  allowAllSubstitutes: boolean;
  useImperialUnits: boolean;
  keepScreenAwake: boolean;
  shakerSmartFilteringEnabled: boolean;
  ratingFilterThreshold: number;
  startScreen: StartScreen;
  appTheme: AppTheme;
  amazonStoreOverride: AmazonStoreOverride | null;
  detectedAmazonStore: AmazonStoreKey | null;
  effectiveAmazonStore: AmazonStoreKey | null;
  onboardingStep: number;
  onboardingCompleted: boolean;
  googleDriveSyncEnabled: boolean;
};

export const InventorySettingsContext = createContext<InventorySettingsContextValue | undefined>(undefined);

export function useInventorySettings() {
  const context = useContext(InventorySettingsContext);

  if (!context) {
    throw new Error('useInventorySettings must be used within an InventoryProvider');
  }

  return context;
}
