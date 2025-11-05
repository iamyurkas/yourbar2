import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="cocktails"
        options={{
          title: 'Cocktails',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="glass-cocktail" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shaker"
        options={{
          title: 'Shaker',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="cup-outline" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ingredients"
        options={{
          title: 'Ingredients',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="food-apple-outline" size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
