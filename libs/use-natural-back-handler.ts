import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';

import { performNaturalBack } from '@/libs/navigation';
import { useInventory } from '@/providers/inventory-provider';

export function useNaturalBackHandler(options?: { disabled?: boolean }) {
  const navigation = useNavigation();
  const { cocktails, ingredients } = useInventory();
  const isHandlingBackRef = useRef(false);

  useEffect(() => {
    if (options?.disabled) {
      return;
    }

    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (isHandlingBackRef.current) {
        return;
      }

      if (event.data.action.type !== 'GO_BACK') {
        return;
      }

      event.preventDefault();

      isHandlingBackRef.current = true;
      performNaturalBack(navigation, cocktails, ingredients);

      // Reset the flag after a short delay to allow subsequent back actions
      setTimeout(() => {
        isHandlingBackRef.current = false;
      }, 300);
    });

    return unsubscribe;
  }, [navigation, cocktails, ingredients, options?.disabled]);

  return {
    handleBack: () => {
      isHandlingBackRef.current = true;
      performNaturalBack(navigation, cocktails, ingredients);
      setTimeout(() => {
        isHandlingBackRef.current = false;
      }, 300);
    },
  };
}
