import { createContext, useContext } from 'react';
import { type StartScreen, type AppTheme } from '../inventory-types';

export type InventorySettingsContextValue = {
  keepScreenAwake: boolean;
  startScreen: StartScreen;
  appTheme: AppTheme;
  onboardingStep: number;
  onboardingCompleted: boolean;
};

export const InventorySettingsContext = createContext<InventorySettingsContextValue | undefined>(undefined);

export function useInventorySettings() {
  const context = useContext(InventorySettingsContext);
  if (!context) {
    throw new Error('useInventorySettings must be used within an InventoryProvider');
  }
  return context;
}
