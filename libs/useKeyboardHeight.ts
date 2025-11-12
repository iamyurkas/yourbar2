import { useEffect, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';

export function useKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const handleShow = (event: KeyboardEvent) => {
      const height = event?.endCoordinates?.height ?? 0;
      setKeyboardHeight(height);
    };

    const handleHide = () => {
      setKeyboardHeight(0);
    };

    const showEvent = Platform.select({ ios: 'keyboardWillShow', default: 'keyboardDidShow' });
    const hideEvent = Platform.select({ ios: 'keyboardWillHide', default: 'keyboardDidHide' });

    const showSubscription = showEvent ? Keyboard.addListener(showEvent, handleShow) : undefined;
    const hideSubscription = hideEvent ? Keyboard.addListener(hideEvent, handleHide) : undefined;

    return () => {
      showSubscription?.remove();
      hideSubscription?.remove();
    };
  }, []);

  return keyboardHeight;
}
