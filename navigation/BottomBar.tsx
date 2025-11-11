import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ComponentType } from 'react';
import type { SvgProps } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import CocktailsIcon from '@/assets/images/cocktails.svg';
import ShakerIcon from '@/assets/images/shaker.svg';
import LemonIcon from '@/assets/images/lemon.svg';

type RouteKey = 'cocktails' | 'shaker' | 'ingredients';

const ICON_SIZE = 28;

const ICONS: Record<RouteKey, ComponentType<SvgProps>> = {
  cocktails: CocktailsIcon,
  shaker: ShakerIcon,
  ingredients: LemonIcon,
};

export function BottomBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const palette = Colors;

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: palette.surface,
            borderColor: palette.outline,
            shadowOpacity: 0.12,
            shadowColor: palette.tint,
          },
        ]}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name;
          const color = focused ? palette.onPrimary : palette.tabIconDefault;
          const labelColor = focused ? palette.onSecondaryContainer : palette.icon;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const Icon = ICONS[route.name as RouteKey];

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [
                styles.item,
                {
                  backgroundColor: focused ? palette.secondaryContainer : palette.surface,
                  borderColor: focused ? palette.tint : palette.outline,
                },
                pressed && styles.itemPressed,
              ]}>
              <View
                style={[
                  styles.iconBadge,
                  {
                    backgroundColor: focused ? palette.tint : palette.surface,
                    borderColor: focused ? palette.tint : palette.outlineVariant,
                    shadowColor: palette.tint,
                    shadowOpacity: focused ? 0.24 : 0,
                    elevation: focused ? 6 : 0,
                  },
                ]}>
                <Icon
                  width={ICON_SIZE}
                  height={ICON_SIZE}
                  fill={color}
                  accessibilityRole="image"
                  accessibilityLabel={typeof label === 'string' ? label : undefined}
                />
              </View>
              <Text style={[styles.label, { color: labelColor, fontWeight: focused ? '600' : '500' }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
  },
  bar: {
    flexDirection: 'row',
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 6,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  itemPressed: {
    opacity: 0.9,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
  label: {
    fontSize: 12,
  },
});
