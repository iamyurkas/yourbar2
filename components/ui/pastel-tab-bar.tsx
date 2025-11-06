import React from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type TabIconRenderer = BottomTabBarProps['descriptors'][string]['options']['tabBarIcon'];

export function PastelTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 12),
          backgroundColor: colors.surface,
          shadowColor: '#00000022',
        },
      ]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
              ? options.title
              : route.name;
        const isFocused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate({ name: route.name, params: route.params, merge: true });
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        const renderIcon: TabIconRenderer | undefined = options.tabBarIcon;

        return (
          <PlatformPressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            android_ripple={{ color: colors.tertiary }}
            onPressIn={() => {
              if (process.env.EXPO_OS === 'ios') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
            style={({ pressed }) => [
              styles.tab,
              {
                opacity: pressed ? 0.65 : 1,
              },
            ]}>
            <View style={styles.tabContent}>
              {renderIcon?.({ focused: isFocused, color: isFocused ? colors.primary : colors.tabIconDefault, size: 24 })}
              <ThemedText
                style={[
                  styles.label,
                  { color: isFocused ? colors.primary : colors.tabIconDefault },
                ]}>
                {label as string}
              </ThemedText>
              <View
                style={[
                  styles.indicator,
                  {
                    backgroundColor: colors.primary,
                    opacity: isFocused ? 1 : 0,
                  },
                ]}
              />
            </View>
          </PlatformPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
    elevation: 6,
  },
  tab: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 8,
  },
  tabContent: {
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  indicator: {
    width: 30,
    height: 4,
    borderRadius: 2,
  },
});

