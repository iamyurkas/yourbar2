import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { palette } from '@/theme/theme';
import { ThemedText } from '@/components/themed-text';

type TabItem = {
  key: string;
  label: string;
};

type MD3TopTabsProps = {
  tabs: TabItem[];
  activeKey: string;
  onTabChange: (key: string) => void;
};

export function MD3TopTabs({ tabs, activeKey, onTabChange }: MD3TopTabsProps) {
  const paletteColors = Colors;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: paletteColors.surfaceVariant,
          borderColor: paletteColors.outline,
          shadowColor: palette.shadow,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 16,
          shadowOpacity: 0.05,
        },
      ]}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={({ pressed }) => [
              styles.tab,
              {
                backgroundColor: isActive ? paletteColors.tint : palette.surfaceBright,
                borderColor: isActive ? 'transparent' : paletteColors.outlineVariant,
                opacity: pressed ? 0.9 : 1,
                shadowColor: isActive ? palette.primary : 'transparent',
                shadowOffset: { width: 0, height: isActive ? 8 : 0 },
                shadowRadius: isActive ? 16 : 0,
                shadowOpacity: isActive ? 0.24 : 0,
              },
            ]}
            onPress={() => onTabChange(tab.key)}>
            <ThemedText
              type="defaultSemiBold"
              style={[
                styles.label,
                {
                  color: isActive ? palette.onPrimary : palette.onSurfaceMuted,
                },
              ]}>
              {tab.label}
            </ThemedText>
            {isActive ? (
              <View style={[styles.activeDot, { backgroundColor: palette.overlayOnPrimary }]} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  tab: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  label: {
    letterSpacing: 0.3,
    fontSize: 14,
  },
  activeDot: {
    position: 'absolute',
    bottom: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export type { TabItem };
