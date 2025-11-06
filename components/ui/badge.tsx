import React from 'react';
import { PlatformPressable } from '@react-navigation/elements';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type BadgeProps = {
  label: string;
  tone?: 'success' | 'warning' | 'info' | 'error' | 'neutral';
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
};

const TONES = {
  success: { background: '#D3F9D8', color: '#2B8A3E' },
  warning: { background: '#FFE6A7', color: '#AD6800' },
  info: { background: '#E7F5FF', color: '#1C7ED6' },
  error: { background: '#FFE3E3', color: '#C92A2A' },
  neutral: { background: '#F1F3F5', color: '#495057' },
};

export function Badge({ label, tone = 'neutral', style, onPress }: BadgeProps) {
  const palette = TONES[tone];
  const content = (
    <View style={[styles.badge, { backgroundColor: palette.background }, style]}>
      <ThemedText style={[styles.label, { color: palette.color }]}>{label}</ThemedText>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <PlatformPressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {content}
    </PlatformPressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  pressed: {
    opacity: 0.85,
  },
});

