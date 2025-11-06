import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import type { ImageSource } from 'expo-image';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { PastelTabBar } from '@/components/ui/pastel-tab-bar';

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

  const tint = Colors[colorScheme ?? 'light'].tint;
  const inactiveTint = Colors[colorScheme ?? 'light'].tabIconDefault;

  return (
    <Tabs
      initialRouteName="cocktails"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tint,
        tabBarInactiveTintColor: inactiveTint,
        tabBarHideOnKeyboard: true,
        sceneContainerStyle: styles.scene,
        tabBar: (props) => <PastelTabBar {...props} />,
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
  scene: {
    backgroundColor: 'transparent',
  },
});
