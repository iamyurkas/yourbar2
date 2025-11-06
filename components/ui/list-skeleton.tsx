import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ListSkeletonProps = {
  rows?: number;
};

export function ListSkeleton({ rows = 4 }: ListSkeletonProps) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];

  return (
    <View style={styles.wrapper}>
      {Array.from({ length: rows }).map((_, index) => (
        <View
          key={`skeleton-${index}`}
          style={[
            styles.row,
            { backgroundColor: theme.surfaceVariant, borderColor: theme.outline },
          ]}>
          <View style={[styles.media, { backgroundColor: theme.outlineVariant }]} />
          <View style={styles.textBlock}>
            <View style={[styles.line, { backgroundColor: theme.outlineVariant, width: '60%' }]} />
            <View style={[styles.line, { backgroundColor: theme.outlineVariant, width: '40%' }]} />
            <View style={[styles.line, { backgroundColor: theme.outlineVariant, width: '80%' }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  media: {
    width: 50,
    height: 50,
    borderRadius: 18,
  },
  textBlock: {
    flex: 1,
    gap: 8,
  },
  line: {
    height: 12,
    borderRadius: 6,
  },
});
