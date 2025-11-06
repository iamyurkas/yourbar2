import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

type IconButtonProps = {
  icon: FeatherName;
  accessibilityLabel: string;
  onPress?: () => void;
  variant?: 'filled' | 'outlined' | 'ghost';
  active?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'ghost',
  active = false,
  size = 44,
  style,
}: IconButtonProps) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];

  const backgroundColor = (() => {
    if (active || variant === 'filled') {
      return theme.primaryContainer;
    }
    if (variant === 'outlined') {
      return theme.surface;
    }
    return theme.surfaceVariant;
  })();

  const borderColor = variant === 'outlined' ? theme.outline : 'transparent';
  const iconColor = active || variant === 'filled' ? theme.primary : theme.icon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          borderColor,
        },
        pressed && styles.pressed,
        style,
      ]}
      android_ripple={{ color: theme.ripple, radius: size / 2 }}>
      <Feather name={icon} size={20} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
});
