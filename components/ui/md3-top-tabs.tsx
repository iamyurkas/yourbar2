import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useThemedStyles } from '@/libs/use-themed-styles';

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
  const styles = useThemedStyles(createStyles);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: Colors.surfaceVariant,
          borderColor: Colors.outline,
          shadowColor: Colors.shadow,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 12,
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
                backgroundColor: isActive ? Colors.tint : Colors.surfaceBright,
                borderColor: isActive ? 'transparent' : Colors.outlineVariant,
                opacity: pressed ? 0.9 : 1,
                shadowColor: isActive ? Colors.primary : 'transparent',
                shadowOffset: { width: 0, height: isActive ? 8 : 0 },
                shadowRadius: isActive ? 12 : 0,
                shadowOpacity: isActive ? 0.24 : 0,
              },
            ]}
            onPress={() => onTabChange(tab.key)}>
            <ThemedText
              type="defaultSemiBold"
              style={[
                styles.label,
                {
                  color: isActive ? Colors.onPrimary : Colors.onSurfaceMuted,
                },
              ]}>
              {tab.label}
            </ThemedText>
            {isActive ? (
              <View style={[styles.activeDot, { backgroundColor: Colors.overlayOnPrimary }]} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  tab: {
    flex: 1,
    borderRadius: 12,
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
