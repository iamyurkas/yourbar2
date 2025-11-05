import { Tabs } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  const { surface, border, activeBackground } = useMemo(() => {
    if (colorScheme === 'dark') {
      return {
        surface: '#1F1B24',
        border: 'rgba(255,255,255,0.08)',
        activeBackground: 'rgba(10,126,164,0.24)',
      };
    }

    return {
      surface: '#F7F2FA',
      border: 'rgba(17,24,28,0.08)',
      activeBackground: 'rgba(10,126,164,0.12)',
    };
  }, [colorScheme]);

  const tint = Colors[colorScheme ?? 'light'].tint;
  const inactiveTint = Colors[colorScheme ?? 'light'].tabIconDefault;

  return (
    <Tabs
      initialRouteName="cocktails"
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: tint,
        tabBarInactiveTintColor: inactiveTint,
        tabBarActiveBackgroundColor: activeBackground,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        tabBarIconStyle: styles.tabIcon,
        tabBarHideOnKeyboard: true,
        tabBarStyle: [styles.tabBar, { backgroundColor: surface, borderColor: border }],
        sceneContainerStyle: styles.scene,
      }}>
      <Tabs.Screen
        name="cocktails"
        options={{
          title: 'Cocktails',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="wineglass.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="shaker"
        options={{
          title: 'Shaker',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="shaker.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="ingredients"
        options={{
          title: 'Ingredients',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="shopping.basket.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 28,
    borderWidth: 1,
    height: 80,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabItem: {
    borderRadius: 20,
  },
  tabIcon: {
    marginBottom: -2,
  },
  scene: {
    backgroundColor: 'transparent',
  },
});
