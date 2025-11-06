import React from 'react';
import { PlatformPressable } from '@react-navigation/elements';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type TagChipProps = {
  label: string;
  color: string;
  selected?: boolean;
  onPress?: () => void;
};

export function TagChip({ label, color, selected = false, onPress }: TagChipProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const outline = colors.outline;

  const backgroundColor = selected ? color : colors.surface;
  const borderColor = selected ? color : outline;
  const textColor = selected ? '#FFFFFF' : colors.mutedText;

  return (
    <PlatformPressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: pressed && !selected ? colors.surfaceVariant : backgroundColor,
          borderColor,
        },
      ]}
      android_ripple={{ color }}>
      <View style={styles.labelWrap}>
        <ThemedText style={[styles.label, { color: textColor }]}>{label}</ThemedText>
      </View>
    </PlatformPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
  },
  labelWrap: {
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

