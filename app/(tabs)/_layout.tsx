import { Image } from 'expo-image';
import { Tabs, useRouter, useSegments } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert } from 'react-native';

import CocktailIcon from '@/assets/images/cocktails.svg';
import LemonIcon from '@/assets/images/ingredients.svg';
import ShakerIcon from '@/assets/images/shaker.svg';
import { palette } from '@/theme/theme';

export default function TabLayout() {
  const router = useRouter();
  const segments = useSegments();
  const tabRoots = useMemo(
    () => ({
      cocktails: '/(tabs)/cocktails',
      ingredients: '/(tabs)/ingredients',
      shaker: '/(tabs)/shaker',
    }),
    [],
  );
  const activeTab = segments[1] as keyof typeof tabRoots | undefined;
  const isEditingFlow = useMemo(() => {
    const isEditableTab = segments.includes('cocktails') || segments.includes('ingredients');
    const isEditScreen = segments.includes('create') || segments.includes('edit');
    return isEditableTab && isEditScreen;
  }, [segments]);

  const createTabPressHandler = (tabName: keyof typeof tabRoots) => ({
    navigation,
  }: {
    navigation: {
      isFocused: () => boolean;
      navigate: (name: keyof typeof tabRoots) => void;
    };
  }) => ({
    tabPress: (event: { preventDefault: () => void }) => {
      const isFocused = navigation.isFocused();
      const isCurrentTab = activeTab === tabName;

      if (isEditingFlow) {
        event.preventDefault();
        Alert.alert(
          'Leave without saving?',
          'If you leave now, all unsaved data will be lost.',
          [
            { text: 'Stay', style: 'cancel' },
            {
              text: 'Leave',
              style: 'destructive',
              onPress: () => {
                if (isCurrentTab) {
                  router.replace(tabRoots[tabName]);
                } else {
                  navigation.navigate(tabName);
                }
              },
            },
          ],
        );
        return;
      }

      if (isFocused) {
        event.preventDefault();
        router.replace(tabRoots[tabName]);
      }
    },
  });

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
        listeners={createTabPressHandler('cocktails')}
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
        listeners={createTabPressHandler('shaker')}
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
        listeners={createTabPressHandler('ingredients')}
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
