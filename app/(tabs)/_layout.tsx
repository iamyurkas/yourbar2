import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import type { ImageSource } from 'expo-image';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

import cocktailsIcon from '@/assets/images/cocktails.svg';
import shakerIcon from '@/assets/images/shaker.svg';
import ingredientsIcon from '@/assets/images/ingredients.svg';

type TabIconProps = {
  color: string;
  size?: number;
  source: ImageSource;
};

const TabImageIcon = ({ color, size = 24, source }: TabIconProps) => (
  <Image
    source={source}
    style={{ width: size, height: size, tintColor: color }}
    contentFit="contain"
  />
);

export default function TabLayout() {
  const colorScheme = useColorScheme();

  const palette = Colors[colorScheme ?? 'light'];
  const { surface, outline: border } = palette;
  const tint = palette.tint;
  const inactiveTint = palette.tabIconDefault;
  const activeBackground = colorScheme === 'dark' ? '#1F2A36' : `${tint}22`;

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
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: surface,
            borderColor: border,
            shadowColor: colorScheme === 'dark' ? 'transparent' : '#4DABF7',
            shadowOpacity: colorScheme === 'dark' ? 0 : 0.08,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 12 },
            elevation: colorScheme === 'dark' ? 0 : 6,
          },
        ],
        sceneContainerStyle: styles.scene,
      }}>
      <Tabs.Screen
        name="cocktails"
        options={{
          title: 'Cocktails',
          tabBarIcon: ({ color }) => (
            <TabImageIcon color={color} source={cocktailsIcon} />
          ),
        }}
      />
      <Tabs.Screen
        name="shaker"
        options={{
          title: 'Shaker',
          tabBarIcon: ({ color }) => (
            <TabImageIcon color={color} source={shakerIcon} />
          ),
        }}
      />
      <Tabs.Screen
        name="ingredients"
        options={{
          title: 'Ingredients',
          tabBarIcon: ({ color }) => (
            <TabImageIcon color={color} source={ingredientsIcon} />
          ),
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
