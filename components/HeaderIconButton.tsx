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
      style={[styles.button, Platform.OS === 'ios' ? styles.buttonIos : styles.buttonDefault]}
      hitSlop={8}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 44,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  buttonDefault: {
    paddingHorizontal: 4,
  },
  buttonIos: {
    paddingHorizontal: 6,
  },
});
