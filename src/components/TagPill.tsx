import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { palette } from '@theme/colors';
import { spacing } from '@theme/spacing';

interface TagPillProps {
  label: string;
  color?: string;
  selected?: boolean;
  style?: ViewStyle;
  onPress?: () => void;
}

export const TagPill: React.FC<TagPillProps> = ({ label, color = palette.surface, selected, style, onPress }) => {
  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: selected ? color : palette.surface, borderColor: selected ? color : palette.border },
        style,
      ]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <Text style={[styles.text, { color: selected ? palette.background : palette.text }]}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
  },
});
