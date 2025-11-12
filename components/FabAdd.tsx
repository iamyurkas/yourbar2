import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { radius, spacing } from '@/theme/design-system';
import { palette } from '@/theme/theme';

const FAB_SIZE = spacing.xxl + spacing.xl;

type FabAddProps = {
  label?: string;
  onPress?: () => void;
};

export function FabAdd({ label = 'Add', onPress }: FabAddProps) {
  const insets = useSafeAreaInsets();
  const paletteColors = Colors;

  return (
    <View style={[styles.container, { bottom: insets.bottom + spacing.lg }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={[styles.fab, { backgroundColor: paletteColors.tint }]}
        android_ripple={{ color: `${paletteColors.surface}33`, borderless: true }}>
        <MaterialCommunityIcons name="plus" size={26} color={paletteColors.surface} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: spacing.xl,
    zIndex: 10,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: palette.shadow,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
});
