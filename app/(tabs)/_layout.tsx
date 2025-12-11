import { Image } from 'expo-image';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

import CocktailIcon from '@/assets/images/cocktails.svg';
import LemonIcon from '@/assets/images/ingredients.svg';
import ShakerIcon from '@/assets/images/shaker.svg';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="cocktails"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.tint,
        tabBarInactiveTintColor: Colors.onSurfaceVariant,
        tabBarStyle: {
          height: 64,
          paddingVertical: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: Colors.outline,
          backgroundColor: Colors.surface,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 4,
        },
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="cocktails"
        options={{
          title: 'Cocktails',
          tabBarIcon: ({ color, focused }) => (
            <Image
              source={CocktailIcon}
              style={{ width: 24, height: 24, tintColor: color }}
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
              style={{ width: 24, height: 24, tintColor: color }}
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
              style={{ width: 24, height: 24, tintColor: color }}
              contentFit="contain"
            />
          ),
        }}
      />
    </Tabs>
  );
}
