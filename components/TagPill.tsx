import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useAppColors } from '@/constants/theme';

export type TagPillProps = {
  label: string;
  color: string;
  selected?: boolean;
  icon?: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  androidRippleColor?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  accessibilityLabel?: string;
  testID?: string;
} & Pick<PressableProps, 'hitSlop'>;

export function TagPill({
  label,
  color,
  selected = false,
  icon,
  onPress,
  disabled = false,
  style,
  textStyle,
  androidRippleColor,
  accessibilityRole,
  accessibilityState,
  accessibilityLabel,
  hitSlop,
  testID,
}: TagPillProps) {
  const colors = useAppColors();

  const content = (
    <View style={styles.contentRow}>
      {icon}
      <Text
        style={[
          styles.label,
          { color: selected ? colors.surface : color },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );

  const baseStyle = [
    styles.pill,
    {
      borderColor: color,
      backgroundColor: selected ? color : colors.surface,
      opacity: disabled ? 0.5 : 1,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole={accessibilityRole}
        accessibilityState={accessibilityState}
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [baseStyle, pressed ? styles.pressed : null]}
        android_ripple={androidRippleColor ? { color: androidRippleColor } : undefined}
        hitSlop={hitSlop}
        testID={testID}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={baseStyle} testID={testID} accessibilityLabel={accessibilityLabel}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pressed: {
    opacity: 0.85,
  },
});
