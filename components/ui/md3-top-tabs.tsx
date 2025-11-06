import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
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
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderColor: theme.outline,
        },
      ]}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onTabChange(tab.key)}
            style={({ pressed }) => [
              styles.tab,
              {
                backgroundColor: isActive ? theme.primaryContainer : theme.surface,
                borderColor: isActive ? theme.primary : theme.outline,
              },
              pressed && styles.pressed,
            ]}
            android_ripple={{ color: theme.ripple, radius: 120 }}>
            <ThemedText
              type="defaultSemiBold"
              style={{ color: isActive ? theme.primary : theme.textMuted }}>
              {tab.label}
            </ThemedText>
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
    borderRadius: 28,
    borderWidth: 1,
    gap: 8,
  },
  tab: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 40,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});

export type { TabItem };
