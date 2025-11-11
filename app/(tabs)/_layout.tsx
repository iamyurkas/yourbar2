import { Image } from 'expo-image';
import { Tabs } from 'expo-router';
import React from 'react';

import CocktailIcon from '@/assets/images/cocktails.svg';
import LemonIcon from '@/assets/images/ingredients.svg';
import ShakerIcon from '@/assets/images/shaker.svg';
import { palette } from '@/theme/theme';

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="cocktails"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.onSurfaceVariant,
        tabBarStyle: {
          height: 72,
          paddingVertical: 8,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
      }}>
      <Tabs.Screen
        name="cocktails"
        options={{
          title: 'Cocktails',
          tabBarIcon: ({ color, focused }) => (
            <Image
              source={CocktailIcon}
              style={{ width: 24, height: 24, tintColor: color, opacity: focused ? 1 : 0.72 }}
              contentFit="contain"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="shaker"
        options={{
          title: 'Shaker',
          tabBarIcon: ({ color, focused }) => (
            <Image
              source={ShakerIcon}
              style={{ width: 24, height: 24, tintColor: color, opacity: focused ? 1 : 0.72 }}
              contentFit="contain"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="ingredients"
        options={{
          title: 'Ingredients',
          tabBarIcon: ({ color, focused }) => (
            <Image
              source={LemonIcon}
              style={{ width: 24, height: 24, tintColor: color, opacity: focused ? 1 : 0.72 }}
              contentFit="contain"
            />
          ),
        }}
      />
    </Tabs>
  );
}
