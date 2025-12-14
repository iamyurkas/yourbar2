import React from 'react';
import { StyleSheet, View } from 'react-native';

import { palette } from '@/theme/theme';

type HairlineSeparatorProps = {
  color?: string;
};

export function HairlineSeparator({ color = palette.outlineVariant }: HairlineSeparatorProps) {
  return <View style={[styles.separator, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  separator: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
});
