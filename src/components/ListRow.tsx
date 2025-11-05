import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { palette, statusDots } from '@theme/colors';
import { spacing } from '@theme/spacing';

export type AvailabilityStatus = keyof typeof statusDots;

interface ListRowProps {
  title: string;
  subtitle?: string;
  detail?: string;
  thumbnail?: ImageSourcePropType;
  status?: AvailabilityStatus;
  isSelected?: boolean;
}

export const ListRow: React.FC<ListRowProps> = ({ title, subtitle, detail, thumbnail, status, isSelected }) => {
  return (
    <View style={[styles.container, isSelected && styles.selected]}> 
      {thumbnail ? <Image source={thumbnail} style={styles.thumbnail} /> : <View style={[styles.thumbnail, styles.placeholder]} />}
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {status ? <View style={[styles.statusDot, { backgroundColor: statusDots[status] }]} /> : null}
      {isSelected ? <View style={styles.checkmark} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
    backgroundColor: palette.background,
  },
  selected: {
    backgroundColor: '#E8F3FF',
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: spacing.md,
    backgroundColor: palette.surface,
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.text,
  },
  subtitle: {
    fontSize: 14,
    color: palette.muted,
  },
  detail: {
    fontSize: 12,
    color: palette.muted,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: spacing.sm,
  },
  checkmark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: palette.primary,
    marginLeft: spacing.sm,
  },
});
