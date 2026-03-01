import { StyleSheet, View } from 'react-native';

import { useAppColors } from '@/constants/theme';

type CollectionListSkeletonProps = {
  rows?: number;
};

export function CollectionListSkeleton({ rows = 8 }: CollectionListSkeletonProps) {
  const Colors = useAppColors();

  return (
    <View style={styles.container}>
      {Array.from({ length: rows }).map((_, index) => (
        <View
          key={`skeleton-row-${index}`}
          style={[
            styles.row,
            {
              borderBottomColor: Colors.outlineVariant,
            },
          ]}>
          <View style={[styles.thumb, { backgroundColor: Colors.surfaceVariant }]} />
          <View style={styles.content}>
            <View style={[styles.title, { backgroundColor: Colors.surfaceVariant }]} />
            <View style={[styles.subtitle, { backgroundColor: Colors.surfaceVariant }]} />
          </View>
          <View style={[styles.meta, { backgroundColor: Colors.surfaceVariant }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 80,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  content: {
    flex: 1,
    gap: 8,
  },
  title: {
    height: 12,
    borderRadius: 6,
    width: '66%',
  },
  subtitle: {
    height: 10,
    borderRadius: 5,
    width: '44%',
  },
  meta: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});
