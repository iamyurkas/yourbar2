import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';
import { useInventory } from '@/providers/inventory-provider';
import { useUnsavedChanges } from '@/providers/unsaved-changes-provider';
import { performNaturalBack, returnToSourceOrBack, type ReturnToParams } from './navigation';

type UseNaturalBackHandlerOptions = {
  onSave?: () => void;
  returnToPath?: string;
  returnToParams?: ReturnToParams;
  onConfirmLeave?: (onProceed: () => void) => void;
};

export function useNaturalBackHandler(options: UseNaturalBackHandlerOptions = {}) {
  const { onSave, returnToPath, returnToParams, onConfirmLeave } = options;
  const navigation = useNavigation();
  const inventory = useInventory();
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const isHandlingBackRef = useRef(false);

  const handleReturn = useCallback(() => {
    if (returnToPath) {
      returnToSourceOrBack(navigation, { returnToPath, returnToParams });
      return;
    }

    performNaturalBack(navigation, inventory);
  }, [navigation, inventory, returnToPath, returnToParams]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (isHandlingBackRef.current) {
        return;
      }

      // Check for unsaved changes first
      if (hasUnsavedChanges && onConfirmLeave) {
        event.preventDefault();
        onConfirmLeave(() => {
          isHandlingBackRef.current = true;
          if (event.data.action.type === 'GO_BACK') {
            handleReturn();
          } else {
            navigation.dispatch(event.data.action);
          }
          setTimeout(() => {
            isHandlingBackRef.current = false;
          }, 0);
        });
        return;
      }

      // If it's a standard back action, use our natural back logic
      if (event.data.action.type === 'GO_BACK') {
        event.preventDefault();
        isHandlingBackRef.current = true;
        handleReturn();
        setTimeout(() => {
          isHandlingBackRef.current = false;
        }, 0);
      }
    });

    return unsubscribe;
  }, [hasUnsavedChanges, onConfirmLeave, navigation, handleReturn]);

  return {
    handleBack: handleReturn,
  };
}
