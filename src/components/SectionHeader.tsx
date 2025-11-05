import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '@theme/colors';
import { spacing } from '@theme/spacing';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onPressAction?: () => void;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, actionLabel, onPressAction }) => (
  <View style={styles.container}>
    <Text style={styles.title}>{title}</Text>
    {actionLabel ? (
      <Text style={styles.action} onPress={onPressAction}>
        {actionLabel}
      </Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.text,
  },
  action: {
    fontSize: 14,
    color: palette.primary,
  },
});
