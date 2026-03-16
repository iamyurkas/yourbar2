import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type UnsavedChangesContextValue = {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean, owner?: UnsavedChangesOwner) => void;
  saveHandler: (() => void) | null;
  setSaveHandler: (handler: (() => void) | null) => void;
  requireLeaveConfirmation: boolean;
  setRequireLeaveConfirmation: (value: boolean, owner?: UnsavedChangesOwner) => void;
  shouldBlockTabSwitch: (activeTab: AppTabName | null) => boolean;
  resetUnsavedChanges: () => void;
};

export type AppTabName = 'cocktails' | 'ingredients' | 'shaker';

export type UnsavedChangesOwner = {
  tab: AppTabName;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

type UnsavedChangesProviderProps = {
  children: React.ReactNode;
};

export function UnsavedChangesProvider({ children }: UnsavedChangesProviderProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveHandler, setSaveHandler] = useState<(() => void) | null>(null);
  const [requireLeaveConfirmation, setRequireLeaveConfirmation] = useState(false);
  const [ownerTab, setOwnerTab] = useState<AppTabName | null>(null);

  const updateHasUnsavedChanges = useCallback((value: boolean, owner?: UnsavedChangesOwner) => {
    setHasUnsavedChanges(value);
    if (value && owner?.tab) {
      setOwnerTab(owner.tab);
    }
    if (!value && !requireLeaveConfirmation) {
      setOwnerTab(null);
    }
  }, [requireLeaveConfirmation]);

  const updateRequireLeaveConfirmation = useCallback((value: boolean, owner?: UnsavedChangesOwner) => {
    setRequireLeaveConfirmation(value);
    if (value && owner?.tab) {
      setOwnerTab(owner.tab);
    }
    if (!value && !hasUnsavedChanges) {
      setOwnerTab(null);
    }
  }, [hasUnsavedChanges]);

  const shouldBlockTabSwitch = useCallback((activeTab: AppTabName | null) => {
    if (!activeTab) {
      return false;
    }

    return (hasUnsavedChanges || requireLeaveConfirmation) && ownerTab === activeTab;
  }, [hasUnsavedChanges, ownerTab, requireLeaveConfirmation]);

  const resetUnsavedChanges = useCallback(() => {
    setHasUnsavedChanges(false);
    setRequireLeaveConfirmation(false);
    setOwnerTab(null);
  }, []);

  const value = useMemo(
    () => ({
      hasUnsavedChanges,
      setHasUnsavedChanges: updateHasUnsavedChanges,
      saveHandler,
      setSaveHandler,
      requireLeaveConfirmation,
      setRequireLeaveConfirmation: updateRequireLeaveConfirmation,
      shouldBlockTabSwitch,
      resetUnsavedChanges,
    }),
    [
      hasUnsavedChanges,
      resetUnsavedChanges,
      requireLeaveConfirmation,
      saveHandler,
      shouldBlockTabSwitch,
      updateHasUnsavedChanges,
      updateRequireLeaveConfirmation,
    ],
  );

  return <UnsavedChangesContext.Provider value={value}>{children}</UnsavedChangesContext.Provider>;
}

export function useUnsavedChanges() {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error('useUnsavedChanges must be used within UnsavedChangesProvider');
  }
  return context;
}
