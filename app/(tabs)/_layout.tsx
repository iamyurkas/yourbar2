import { Image } from 'expo-image';
import { Tabs, usePathname, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Alert } from 'react-native';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';

import CocktailIcon from '@/assets/images/cocktails.svg';
import LemonIcon from '@/assets/images/ingredients.svg';
import ShakerIcon from '@/assets/images/shaker.svg';
import { HapticTab } from '@/components/haptic-tab';
import { getLastCocktailTab, getLastIngredientTab } from '@/libs/collection-tabs';
import { palette } from '@/theme/theme';

const UNSAVED_PATH_PATTERN = /^\/(cocktails\/create|ingredients\/create|ingredients\/[^/]+\/edit)(\/|$)/;

function TabBarButton(props: BottomTabBarButtonProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isEditing = UNSAVED_PATH_PATTERN.test(pathname);

  const handlePress = useCallback(() => {
    const proceed = () => {
      if (isEditing) {
        if (pathname.startsWith('/cocktails')) {
          router.replace('/cocktails');
        } else if (pathname.startsWith('/ingredients')) {
          router.replace('/ingredients');
        } else if (pathname.startsWith('/shaker')) {
          router.replace('/shaker');
        }
      }
      props.onPress?.();
    };

    if (isEditing) {
      Alert.alert(
        'Leave without saving?',
        'Your changes will be lost if you leave this screen.',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: proceed },
        ],
      );
      return;
    }

    proceed();
  }, [isEditing, pathname, props, router]);

  return <HapticTab {...props} onPress={handlePress} />;
}

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
          tabBarButton: (props) => <TabBarButton {...props} />,
          tabBarIcon: ({ color, focused }) => (
            <Image
              source={CocktailIcon}
              style={{ width: 24, height: 24, tintColor: color, opacity: focused ? 1 : 0.72 }}
              contentFit="contain"
            />
          ),
        }}
        listeners={({ navigation, route }) => ({
          tabPress: (event) => {
            event.preventDefault();
            const targetTab = getLastCocktailTab();
            navigation.navigate(route.name as never, { screen: 'index', params: { tab: targetTab } } as never);
          },
        })}
      />
      <Tabs.Screen
        name="shaker"
        options={{
          title: 'Shaker',
          tabBarButton: (props) => <TabBarButton {...props} />,
          tabBarIcon: ({ color, focused }) => (
            <Image
              source={ShakerIcon}
              style={{ width: 24, height: 24, tintColor: color, opacity: focused ? 1 : 0.72 }}
              contentFit="contain"
            />
          ),
        }}
        listeners={({ navigation, route }) => ({
          tabPress: (event) => {
            event.preventDefault();
            navigation.navigate(route.name as never, { screen: 'index' } as never);
          },
        })}
      />
      <Tabs.Screen
        name="ingredients"
        options={{
          title: 'Ingredients',
          tabBarButton: (props) => <TabBarButton {...props} />,
          tabBarIcon: ({ color, focused }) => (
            <Image
              source={LemonIcon}
              style={{ width: 24, height: 24, tintColor: color, opacity: focused ? 1 : 0.72 }}
              contentFit="contain"
            />
          ),
        }}
        listeners={({ navigation, route }) => ({
          tabPress: (event) => {
            event.preventDefault();
            const targetTab = getLastIngredientTab();
            navigation.navigate(route.name as never, { screen: 'index', params: { tab: targetTab } } as never);
          },
        })}
      />
    </Tabs>
  );
}
