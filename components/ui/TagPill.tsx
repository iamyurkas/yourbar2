import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Colors } from '@/constants/theme';

export type TagPillProps = {
  label: string;
  color?: string | null;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function TagPill({ label, color, selected = false, onPress, style }: TagPillProps) {
  const palette = Colors;
  const backgroundColor = selected ? color ?? palette.tint : `${palette.outline}1A`;
  const textColor = selected ? palette.surface : palette.onSurface;

  return (
    <Pressable
      style={[styles.pill, { backgroundColor, borderColor: color ?? palette.outline }, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      android_ripple={{ color: `${palette.onSurface}22`, borderless: false }}>
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
  },
});
