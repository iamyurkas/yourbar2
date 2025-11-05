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
  const containerBorder = colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,28,0.1)';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colorScheme === 'dark' ? '#201F24' : '#FFFBFE',
          borderColor: containerBorder,
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
                backgroundColor: isActive
                  ? theme.tint
                  : 'transparent',
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            onPress={() => onTabChange(tab.key)}>
            <ThemedText
              type="defaultSemiBold"
              style={[
                styles.label,
                {
                  color: isActive
                    ? '#FFFFFF'
                    : colorScheme === 'dark'
                      ? 'rgba(236,237,238,0.75)'
                      : 'rgba(17,24,28,0.75)',
                },
              ]}>
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
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
  },
  tab: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    letterSpacing: 0.3,
  },
});

export type { TabItem };
