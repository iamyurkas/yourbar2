import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type UnsavedChangesContextValue = {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  saveHandler: (() => void) | null;
  setSaveHandler: (handler: (() => void) | null) => void;
  requireLeaveConfirmation: boolean;
  setRequireLeaveConfirmation: (value: boolean) => void;
  markSkipNextLeaveConfirmation: () => void;
  consumeSkipNextLeaveConfirmation: () => boolean;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

type UnsavedChangesProviderProps = {
  children: React.ReactNode;
};

export function UnsavedChangesProvider({ children }: UnsavedChangesProviderProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveHandler, setSaveHandler] = useState<(() => void) | null>(null);
  const [requireLeaveConfirmation, setRequireLeaveConfirmation] = useState(false);
  const skipNextLeaveConfirmationRef = React.useRef(false);

  const updateHasUnsavedChanges = useCallback((value: boolean) => {
    setHasUnsavedChanges(value);
  }, []);

  const markSkipNextLeaveConfirmation = useCallback(() => {
    skipNextLeaveConfirmationRef.current = true;
  }, []);

  const consumeSkipNextLeaveConfirmation = useCallback(() => {
    if (!skipNextLeaveConfirmationRef.current) {
      return false;
    }

    skipNextLeaveConfirmationRef.current = false;
    return true;
  }, []);

  const value = useMemo(
    () => ({
      hasUnsavedChanges,
      setHasUnsavedChanges: updateHasUnsavedChanges,
      saveHandler,
      setSaveHandler,
      requireLeaveConfirmation,
      setRequireLeaveConfirmation,
      markSkipNextLeaveConfirmation,
      consumeSkipNextLeaveConfirmation,
    }),
    [
      hasUnsavedChanges,
      requireLeaveConfirmation,
      saveHandler,
      updateHasUnsavedChanges,
      markSkipNextLeaveConfirmation,
      consumeSkipNextLeaveConfirmation,
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
