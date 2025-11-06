import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import type { ComponentType } from 'react';
import type { SvgProps } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import CocktailsIcon from '@/assets/images/cocktails.svg';
import ShakerIcon from '@/assets/images/shaker.svg';
import IngredientsIcon from '@/assets/images/ingredients.svg';

type TabKey = 'cocktails' | 'shaker' | 'ingredients';

type TabItem = {
  key: TabKey;
  label: string;
  href: string;
  Icon: ComponentType<SvgProps>;
};

const ICON_SIZE = 28;

const TABS: TabItem[] = [
  { key: 'cocktails', label: 'Cocktails', href: '/(tabs)/cocktails', Icon: CocktailsIcon },
  { key: 'shaker', label: 'Shaker', href: '/(tabs)/shaker', Icon: ShakerIcon },
  { key: 'ingredients', label: 'Ingredients', href: '/(tabs)/ingredients', Icon: IngredientsIcon },
];

function resolveActiveTab(pathname: string | null): TabKey {
  if (!pathname) {
    return 'cocktails';
  }

  if (pathname.startsWith('/(tabs)/cocktails')) {
    return 'cocktails';
  }

  if (pathname.startsWith('/(tabs)/shaker')) {
    return 'shaker';
  }

  if (pathname.startsWith('/(tabs)/ingredients') || pathname.startsWith('/ingredient')) {
    return 'ingredients';
  }

  return 'cocktails';
}

export function BottomTabsSwitcher() {
  const palette = Colors;
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const activeTab = useMemo(() => resolveActiveTab(pathname), [pathname]);

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
        {TABS.map(({ key, label, href, Icon }) => {
          const focused = key === activeTab;
          const color = focused ? palette.tint : palette.tabIconDefault;
          const labelColor = focused ? palette.tint : palette.icon;

          const handlePress = () => {
            if (focused) {
              return;
            }

            router.replace(href);
          };

          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={label}
              onPress={handlePress}
              style={styles.item}>
              <Icon
                width={ICON_SIZE}
                height={ICON_SIZE}
                fill={color}
                accessibilityRole="image"
                accessibilityLabel={label}
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
