import { Tabs } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CocktailIcon from '@/assets/images/cocktails.svg';
import LemonIcon from '@/assets/images/ingredients.svg';
import ShakerIcon from '@/assets/images/shaker.svg';
import { AppDialog, type DialogOptions } from '@/components/AppDialog';
import { TabBarButton } from '@/components/tab-bar/TabBarButton';
import { TabBarIcon } from '@/components/tab-bar/TabBarIcon';
import { Colors } from '@/constants/theme';
import { getLastCocktailTab, getLastIngredientTab } from '@/libs/collection-tabs';
import { useThemeSettings } from '@/providers/theme-provider';

type TabPressHandler = (navigation: { navigate: (...args: never[]) => void }, route: { name: string }) => void;

const TAB_SCREENS: Array<{
  name: 'cocktails' | 'shaker' | 'ingredients';
  title: string;
  icon: typeof CocktailIcon;
  onTabPress: TabPressHandler;
}> = [
  {
    name: 'cocktails',
    title: 'Cocktails',
    icon: CocktailIcon,
    onTabPress: (navigation, route) => {
      getLastCocktailTab();
      navigation.navigate(route.name as never, { screen: 'index' } as never);
    },
  },
  {
    name: 'shaker',
    title: 'Shaker',
    icon: ShakerIcon,
    onTabPress: (navigation, route) => {
      navigation.navigate(route.name as never, { screen: 'index' } as never);
    },
  },
  {
    name: 'ingredients',
    title: 'Ingredients',
    icon: LemonIcon,
    onTabPress: (navigation, route) => {
      getLastIngredientTab();
      navigation.navigate(route.name as never, { screen: 'index' } as never);
    },
  },
];

export default function TabLayout() {
  const [dialogOptions, setDialogOptions] = useState<DialogOptions | null>(null);
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useThemeSettings();

  const tabBarInsetColor = isDarkMode ? Colors.onSurfaceVariant : Colors.surface;

  const closeDialog = useCallback(() => {
    setDialogOptions(null);
  }, []);

  const showDialog = useCallback((options: DialogOptions) => {
    setDialogOptions(options);
  }, []);

  return (
    <>
      <Tabs
        initialRouteName="cocktails"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.onSurfaceVariant,
          tabBarStyle: {
            height: 72 + insets.bottom,
            paddingTop: 8,
            paddingBottom: insets.bottom,
            backgroundColor: 'transparent',
          },
          tabBarItemStyle: {
            justifyContent: 'center',
            alignItems: 'center',
          },
          tabBarBackground: () => (
            <View style={styles.tabBarBackground}>
              <View style={styles.tabBarSurface} />
              <View style={[styles.tabBarInset, { height: insets.bottom, backgroundColor: tabBarInsetColor }]} />
            </View>
          ),
        }}>
        {TAB_SCREENS.map(({ name, title, icon, onTabPress }) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title,
              tabBarButton: (props) => <TabBarButton {...props} onOpenDialog={showDialog} />,
              tabBarIcon: ({ color, focused }) => <TabBarIcon source={icon} color={color} focused={focused} />,
            }}
            listeners={({ navigation, route }) => ({
              tabPress: (event) => {
                event.preventDefault();
                onTabPress(navigation, route);
              },
            })}
          />
        ))}
      </Tabs>
      <AppDialog
        visible={dialogOptions != null}
        title={dialogOptions?.title ?? ''}
        message={dialogOptions?.message}
        actions={dialogOptions?.actions ?? []}
        onRequestClose={closeDialog}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tabBarBackground: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
  },
  tabBarSurface: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  tabBarInset: {
    height: 0,
    backgroundColor: Colors.surface,
  },
});
