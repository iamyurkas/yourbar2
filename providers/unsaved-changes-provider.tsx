import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type UnsavedChangesContextValue = {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  registerSaveHandler: (handler: (() => void) | null) => void;
  requestSave: () => void;
  isEditingScreen: boolean;
  setIsEditingScreen: (value: boolean) => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

type UnsavedChangesProviderProps = {
  children: React.ReactNode;
};

export function UnsavedChangesProvider({ children }: UnsavedChangesProviderProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isEditingScreen, setIsEditingScreen] = useState(false);
  const saveHandlerRef = useRef<(() => void) | null>(null);

  const updateHasUnsavedChanges = useCallback((value: boolean) => {
    setHasUnsavedChanges(value);
  }, []);

  const registerSaveHandler = useCallback((handler: (() => void) | null) => {
    saveHandlerRef.current = handler;
  }, []);

  const requestSave = useCallback(() => {
    saveHandlerRef.current?.();
  }, []);

  const value = useMemo(
    () => ({
      hasUnsavedChanges,
      setHasUnsavedChanges: updateHasUnsavedChanges,
      registerSaveHandler,
      requestSave,
      isEditingScreen,
      setIsEditingScreen,
    }),
    [
      hasUnsavedChanges,
      isEditingScreen,
      registerSaveHandler,
      requestSave,
      updateHasUnsavedChanges,
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
