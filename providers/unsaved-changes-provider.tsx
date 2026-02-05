import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type SaveCallback = () => Promise<boolean | void> | boolean | void;

type UnsavedChangesContextValue = {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  onSave?: SaveCallback;
  setOnSave: (callback?: SaveCallback) => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

type UnsavedChangesProviderProps = {
  children: React.ReactNode;
};

export function UnsavedChangesProvider({ children }: UnsavedChangesProviderProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [onSave, setOnSave] = useState<SaveCallback | undefined>();

  const updateHasUnsavedChanges = useCallback((value: boolean) => {
    setHasUnsavedChanges(value);
  }, []);

  const updateOnSave = useCallback((callback?: SaveCallback) => {
    setOnSave(() => callback);
  }, []);

  const value = useMemo(
    () => ({
      hasUnsavedChanges,
      setHasUnsavedChanges: updateHasUnsavedChanges,
      onSave,
      setOnSave: updateOnSave,
    }),
    [hasUnsavedChanges, onSave, updateHasUnsavedChanges, updateOnSave],
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
