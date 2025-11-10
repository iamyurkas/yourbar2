import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ComponentType } from 'react';
import type { SvgProps } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import CocktailsIcon from '@/assets/images/cocktails.svg';
import ShakerIcon from '@/assets/images/shaker.svg';
import IngredientsIcon from '@/assets/images/ingredients.svg';

type RouteKey = 'cocktails' | 'shaker' | 'ingredients';

const ICON_SIZE = 28;

const ICONS: Record<RouteKey, ComponentType<SvgProps>> = {
  cocktails: CocktailsIcon,
  shaker: ShakerIcon,
  ingredients: IngredientsIcon,
};

export function BottomBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const palette = Colors;

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingBottom: Math.max(insets.bottom, 12),
          backgroundColor: palette.background,
          borderTopColor: `${palette.outline}AA`,
        },
      ]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name;
          const color = focused ? palette.tint : palette.tabIconDefault;
          const labelColor = focused ? palette.tint : palette.icon;

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
              android_ripple={{ color: `${palette.tertiary}59`, foreground: true }}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}>
              <View style={styles.iconWrapper}>
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
              <View
                style={[
                  styles.indicator,
                  {
                    backgroundColor: focused ? palette.primary : 'transparent',
                  },
                ]}
              />
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
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    position: 'relative',
  },
  itemPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  iconWrapper: {
    height: ICON_SIZE + 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    width: 36,
    borderRadius: 999,
  },
});
