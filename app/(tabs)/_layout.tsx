import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import { Tabs, usePathname, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CocktailIcon from '@/assets/images/cocktails.svg';
import LemonIcon from '@/assets/images/ingredients.svg';
import ShakerIcon from '@/assets/images/shaker.svg';
import { AppDialog, type DialogOptions } from '@/components/AppDialog';
import { HapticTab } from '@/components/haptic-tab';
import { getLastCocktailTab, getLastIngredientTab } from '@/libs/collection-tabs';
import { useUnsavedChanges } from '@/providers/unsaved-changes-provider';
import { palette } from '@/theme/theme';

const EDITING_PATH_PATTERN = /^\/(cocktails\/create|ingredients\/create|ingredients\/[^/]+\/edit)(\/|$)/;

type TabBarButtonProps = BottomTabBarButtonProps & {
  onOpenDialog: (options: DialogOptions) => void;
};

function TabBarButton({ onOpenDialog, ...props }: TabBarButtonProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const isEditingRoute = EDITING_PATH_PATTERN.test(pathname);

  const handlePress = useCallback(() => {
    const proceed = () => {
      if (isEditingRoute) {
        if (pathname.startsWith('/cocktails')) {
          router.replace('/cocktails');
        } else if (pathname.startsWith('/ingredients')) {
          router.replace('/ingredients');
        } else if (pathname.startsWith('/shaker')) {
          router.replace('/shaker');
        }
      }
      setHasUnsavedChanges(false);
      props.onPress?.();
    };

    if (hasUnsavedChanges) {
      onOpenDialog({
        title: 'Leave without saving?',
        message: 'Your changes will be lost if you leave this screen.',
        actions: [
          { label: 'Stay', variant: 'secondary' },
          { label: 'Leave', variant: 'destructive', onPress: proceed },
        ],
      });
      return;
    }

    proceed();
  }, [hasUnsavedChanges, isEditingRoute, onOpenDialog, pathname, props, router, setHasUnsavedChanges]);

  return <HapticTab {...props} onPress={handlePress} />;
}

export default function TabLayout() {
  const [dialogOptions, setDialogOptions] = useState<DialogOptions | null>(null);
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  const tabBarInsetColor = isDarkMode ? palette.onSurfaceVariant : palette.surface;

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
          tabBarActiveTintColor: palette.primary,
          tabBarInactiveTintColor: palette.onSurfaceVariant,
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
        <Tabs.Screen
          name="cocktails"
          options={{
            title: 'Cocktails',
            tabBarButton: (props) => <TabBarButton {...props} onOpenDialog={showDialog} />,
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
              getLastCocktailTab();
              navigation.navigate(route.name as never, { screen: 'index' } as never);
            },
          })}
        />
        <Tabs.Screen
          name="shaker"
          options={{
            title: 'Shaker',
            tabBarButton: (props) => <TabBarButton {...props} onOpenDialog={showDialog} />,
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
            tabBarButton: (props) => <TabBarButton {...props} onOpenDialog={showDialog} />,
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
              getLastIngredientTab();
              navigation.navigate(route.name as never, { screen: 'index' } as never);
            },
          })}
        />
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
    backgroundColor: palette.surface,
  },
  tabBarInset: {
    height: 0,
    backgroundColor: palette.surface,
  },
});
