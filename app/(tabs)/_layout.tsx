import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme ?? 'light';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[scheme].tabIconSelected,
        tabBarInactiveTintColor: Colors[scheme].tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveBackgroundColor: Colors[scheme].tabBarActiveBackground,
        tabBarInactiveBackgroundColor: Colors[scheme].tabBarInactiveBackground,
        tabBarItemStyle: {
          borderRadius: 20,
          marginHorizontal: 4,
          paddingVertical: 6,
        },
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 12,
          elevation: 0,
          borderTopWidth: 0,
          backgroundColor: Colors[scheme].surface,
          borderRadius: 28,
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 10,
          shadowColor: '#000000',
          shadowOpacity: scheme === 'dark' ? 0.35 : 0.12,
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 16,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 0.25,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Cocktails',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="martini.glass.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shaker"
        options={{
          title: 'Shaker',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="cocktail.shaker.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ingredients"
        options={{
          title: 'Ingredients',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="leaf.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
