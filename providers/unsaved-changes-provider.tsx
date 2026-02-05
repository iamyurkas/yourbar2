import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type UnsavedChangesContextValue = {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  registerSaveAction: (action: (() => Promise<boolean>) | null) => void;
  requestSave: () => Promise<boolean>;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

type UnsavedChangesProviderProps = {
  children: React.ReactNode;
};

export function UnsavedChangesProvider({ children }: UnsavedChangesProviderProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const saveActionRef = React.useRef<(() => Promise<boolean>) | null>(null);

  const updateHasUnsavedChanges = useCallback((value: boolean) => {
    setHasUnsavedChanges(value);
  }, []);

  const registerSaveAction = useCallback((action: (() => Promise<boolean>) | null) => {
    saveActionRef.current = action;
  }, []);

  const requestSave = useCallback(async () => {
    if (saveActionRef.current) {
      return await saveActionRef.current();
    }
    return true;
  }, []);

  const value = useMemo(
    () => ({
      hasUnsavedChanges,
      setHasUnsavedChanges: updateHasUnsavedChanges,
      registerSaveAction,
      requestSave,
    }),
    [hasUnsavedChanges, updateHasUnsavedChanges, registerSaveAction, requestSave],
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
