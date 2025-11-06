import React, { useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { PlatformPressable } from '@react-navigation/elements';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type UnderlineTab = {
  key: string;
  label: string;
};

type UnderlineTabsProps = {
  tabs: UnderlineTab[];
  activeKey: string;
  onChange: (key: string) => void;
};

export function UnderlineTabs({ tabs, activeKey, onChange }: UnderlineTabsProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.key === activeKey));
  const indicator = useRef(new Animated.Value(activeIndex));

  React.useEffect(() => {
    Animated.timing(indicator.current, {
      toValue: activeIndex,
      duration: 180,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [activeIndex]);

  const tabCount = Math.max(1, tabs.length);

  return (
    <View style={[styles.container, { borderColor: colors.outlineVariant }]}> 
      {tabs.map((tab, index) => {
        const focused = tab.key === activeKey;
        return (
          <PlatformPressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [
              styles.tab,
              {
                opacity: pressed ? 0.6 : 1,
              },
            ]}
            android_ripple={{ color: colors.tertiary }}>
            <ThemedText
              type="defaultSemiBold"
              style={{
                color: focused ? colors.primary : colors.mutedText,
              }}>
              {tab.label}
            </ThemedText>
          </PlatformPressable>
        );
      })}
      <Animated.View
        style={[
          styles.indicator,
          {
            backgroundColor: colors.primary,
            width: `${100 / tabCount}%`,
            left: indicator.current.interpolate({
              inputRange: tabs.map((_, idx) => idx),
              outputRange: tabs.map((_, idx) => `${idx * (100 / tabCount)}%`),
            }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    borderBottomWidth: 1,
    marginTop: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  indicator: {
    position: 'absolute',
    height: 3,
    borderRadius: 3,
    bottom: -1.5,
    left: 0,
  },
});

