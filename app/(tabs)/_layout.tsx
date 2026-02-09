import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CocktailIcon from '@/assets/images/cocktails.svg';
import LemonIcon from '@/assets/images/ingredients.svg';
import ShakerIcon from '@/assets/images/shaker.svg';
import { AppDialog, type DialogOptions } from '@/components/AppDialog';
import { TabBarButton } from '@/components/tab-bar/TabBarButton';
import { TabBarIcon } from '@/components/tab-bar/TabBarIcon';
import { OnboardingAnchor } from '@/components/onboarding/OnboardingAnchor';
import { useAppColors } from '@/constants/theme';
import { getLastCocktailTab, getLastIngredientTab } from '@/libs/collection-tabs';

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
  const Colors = useAppColors();

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
            Platform.OS === 'ios' ? (
              <BlurView
                intensity={80}
                style={StyleSheet.absoluteFill}
                tint={Colors.surface === '#F3F3F3' ? 'light' : 'dark'}
              />
            ) : (
              <View style={styles.tabBarBackground}>
                <View style={[styles.tabBarSurface, { backgroundColor: Colors.surface }]} />
                <View style={[styles.tabBarInset, { height: insets.bottom, backgroundColor: Colors.surface }]} />
              </View>
            )
          ),
        }}>
        {TAB_SCREENS.map(({ name, title, icon, onTabPress }) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title,
              tabBarButton: (props) => (
                <OnboardingAnchor name={`tab-${name}`} style={styles.tabAnchor}>
                  <TabBarButton {...props} onOpenDialog={showDialog} />
                </OnboardingAnchor>
              ),
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
  },
  tabBarInset: {
    height: 0,
  },
  tabAnchor: {
    flex: 1,
  },
});
