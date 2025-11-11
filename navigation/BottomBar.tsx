import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { Colors } from '@/constants/theme';

type RouteKey = 'cocktails' | 'shaker' | 'ingredients';

type MaterialCommunityIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const ICON_SIZE = 28;

const ICONS: Record<RouteKey, MaterialCommunityIconName> = {
  cocktails: 'glass-cocktail',
  shaker: 'bottle-tonic-outline',
  ingredients: 'silverware-fork-knife',
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

          const iconName = ICONS[route.name as RouteKey];

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.item}>
              <MaterialCommunityIcons
                name={iconName}
                size={ICON_SIZE}
                color={color}
                accessibilityRole="image"
                accessibilityLabel={typeof label === 'string' ? label : undefined}
              />
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
    paddingVertical: 8,
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
    paddingVertical: 8,
  },
  label: {
    fontSize: 12,
  },
});
