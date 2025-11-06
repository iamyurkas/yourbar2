import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type FloatingActionButtonProps = {
  icon?: React.ComponentProps<typeof Feather>['name'];
  accessibilityLabel: string;
  onPress?: () => void;
};

export function FloatingActionButton({
  icon = 'plus',
  accessibilityLabel,
  onPress,
}: FloatingActionButtonProps) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: theme.primaryContainer,
          shadowColor: theme.primary,
        },
        pressed && styles.pressed,
      ]}
      android_ripple={{ color: theme.ripple, radius: 40 }}>
      <Feather name={icon} size={26} color={theme.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 24,
    bottom: 32,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
});
