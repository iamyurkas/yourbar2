import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type UnsavedChangesContextValue = {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  registerSaveHandler: (handler: (() => void) | null) => void;
  saveHandler: (() => void) | null;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

type UnsavedChangesProviderProps = {
  children: React.ReactNode;
};

export function UnsavedChangesProvider({ children }: UnsavedChangesProviderProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveHandler, setSaveHandler] = useState<(() => void) | null>(null);

  const updateHasUnsavedChanges = useCallback((value: boolean) => {
    setHasUnsavedChanges(value);
  }, []);

  const registerSaveHandler = useCallback((handler: (() => void) | null) => {
    setSaveHandler(() => handler);
  }, []);

  const value = useMemo(
    () => ({
      hasUnsavedChanges,
      setHasUnsavedChanges: updateHasUnsavedChanges,
      registerSaveHandler,
      saveHandler,
    }),
    [hasUnsavedChanges, registerSaveHandler, saveHandler, updateHasUnsavedChanges],
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
