import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

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
      style={styles.button}
      hitSlop={8}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 4,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
});
