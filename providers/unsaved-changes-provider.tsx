import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type UnsavedChangesContextValue = {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  registerSaveHandler: (handler?: () => void) => void;
  requestSave: () => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

type UnsavedChangesProviderProps = {
  children: React.ReactNode;
};

export function UnsavedChangesProvider({ children }: UnsavedChangesProviderProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const saveHandlerRef = useRef<(() => void) | null>(null);

  const updateHasUnsavedChanges = useCallback((value: boolean) => {
    setHasUnsavedChanges(value);
  }, []);

  const updateIsEditing = useCallback((value: boolean) => {
    setIsEditing(value);
  }, []);

  const registerSaveHandler = useCallback((handler?: () => void) => {
    saveHandlerRef.current = handler ?? null;
  }, []);

  const requestSave = useCallback(() => {
    saveHandlerRef.current?.();
  }, []);

  const value = useMemo(
    () => ({
      hasUnsavedChanges,
      setHasUnsavedChanges: updateHasUnsavedChanges,
      isEditing,
      setIsEditing: updateIsEditing,
      registerSaveHandler,
      requestSave,
    }),
    [hasUnsavedChanges, isEditing, registerSaveHandler, requestSave, updateHasUnsavedChanges, updateIsEditing],
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
