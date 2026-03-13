import { createContext, useContext } from 'react';

import type { AmazonStoreKey, AmazonStoreOverride } from '@/libs/amazon-stores';
import type { AppLocale, AppTheme, Bar, StartScreen } from '@/providers/inventory-types';

export type InventorySettingsContextValue = {
  ignoreGarnish: boolean;
  allowAllSubstitutes: boolean;
  useImperialUnits: boolean;
  keepScreenAwake: boolean;
  shakerSmartFilteringEnabled: boolean;
  showTabCounters: boolean;
  ratingFilterThreshold: number;
  startScreen: StartScreen;
  appTheme: AppTheme;
  appLocale: AppLocale;
  amazonStoreOverride: AmazonStoreOverride | null;
  detectedAmazonStore: AmazonStoreKey | null;
  effectiveAmazonStore: AmazonStoreKey | null;
  bars: Bar[];
  activeBarId: string;
};

export const InventorySettingsContext = createContext<InventorySettingsContextValue | undefined>(undefined);

export function useInventorySettings() {
  const context = useContext(InventorySettingsContext);

  if (!context) {
    throw new Error('useInventorySettings must be used within an InventoryProvider');
  }

  return context;
}
