import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
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

type Palette = (typeof Colors)['light'];

type TabBarItemProps = {
  label: string;
  icon: ImageSource;
  focused: boolean;
  theme: Palette;
};

const TabImageIcon = ({ color, size = 24, source }: TabIconProps) => (
  <Image
    source={source}
    style={{ width: size, height: size, tintColor: color }}
    contentFit="contain"
  />
);

function TabBarItem({ label, icon, focused, theme }: TabBarItemProps) {
  return (
    <View style={styles.tabContent}>
      <TabImageIcon color={focused ? theme.primary : theme.tabIconDefault} source={icon} />
      <Text
        style={[
          styles.tabLabel,
          { color: focused ? theme.primary : theme.tabIconDefault },
        ]}>
        {label}
      </Text>
      <View
        style={[
          styles.indicator,
          {
            backgroundColor: focused ? theme.primary : theme.outlineVariant,
            opacity: focused ? 1 : 0,
          },
        ]}
      />
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <Tabs
      initialRouteName="cocktails"
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: theme.surface,
            borderTopWidth: 0,
            shadowColor: theme.primary,
          },
        ],
        tabBarItemStyle: styles.tabItem,
        sceneContainerStyle: { backgroundColor: theme.background },
      }}>
      <Tabs.Screen
        name="cocktails"
        options={{
          title: 'Cocktails',
          tabBarIcon: ({ focused }) => (
            <TabBarItem label="Cocktails" icon={cocktailsIcon} focused={focused} theme={theme} />
          ),
        }}
      />
      <Tabs.Screen
        name="shaker"
        options={{
          title: 'Shaker',
          tabBarIcon: ({ focused }) => (
            <TabBarItem label="Shaker" icon={shakerIcon} focused={focused} theme={theme} />
          ),
        }}
      />
      <Tabs.Screen
        name="ingredients"
        options={{
          title: 'Ingredients',
          tabBarIcon: ({ focused }) => (
            <TabBarItem
              label="Ingredients"
              icon={ingredientsIcon}
              focused={focused}
              theme={theme}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 88,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    elevation: 12,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -2 },
  },
  tabItem: {
    borderRadius: 18,
  },
  tabContent: {
    alignItems: 'center',
    gap: 4,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  indicator: {
    marginTop: 4,
    height: 4,
    width: 28,
    borderRadius: 999,
  },
});
