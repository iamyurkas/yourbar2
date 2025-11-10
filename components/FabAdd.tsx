import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { palette } from '@/theme/theme';

type FabAddProps = {
  label?: string;
  onPress?: () => void;
};

export function FabAdd({ label = 'Add', onPress }: FabAddProps) {
  const insets = useSafeAreaInsets();
  const paletteColors = Colors;
  const rippleColor = `${palette.tertiary}59`;

  return (
    <View style={[styles.container, { bottom: insets.bottom + 24 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={[styles.fab, { backgroundColor: palette.primaryContainer }]}
        android_ripple={{ color: rippleColor, borderless: true }}>
        <MaterialCommunityIcons name="plus" size={26} color={palette.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 24,
    zIndex: 10,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: palette.shadow,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.outline}66`,
  },
});
