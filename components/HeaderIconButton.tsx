import React from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

type HeaderIconButtonProps = {
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
};

export function HeaderIconButton({ onPress, accessibilityLabel, children }: HeaderIconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.button,
        Platform.OS === 'ios' ? styles.buttonIos : styles.buttonAndroid,
        Platform.OS !== 'ios' && pressed && styles.pressed,
      ]}
      hitSlop={8}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  buttonAndroid: {
    paddingHorizontal: 4,
    height: 40,
    borderRadius: 20,
  },
  buttonIos: {
    height: 32,
    minWidth: 32,
    paddingHorizontal: 2,
  },
  pressed: {
    opacity: 0.55,
  },
});
