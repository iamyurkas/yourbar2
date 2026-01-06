import { Image } from 'expo-image';
import { Tabs, usePathname, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';

import CocktailIcon from '@/assets/images/cocktails.svg';
import LemonIcon from '@/assets/images/ingredients.svg';
import ShakerIcon from '@/assets/images/shaker.svg';
import { AppDialog, type DialogOptions } from '@/components/AppDialog';
import { HapticTab } from '@/components/haptic-tab';
import { getLastCocktailTab, getLastIngredientTab, setLastCocktailTab, setLastIngredientTab } from '@/libs/collection-tabs';
import { resolveStartingScreenTarget } from '@/libs/starting-screen';
import { useUnsavedChanges } from '@/providers/unsaved-changes-provider';
import { useInventory } from '@/providers/inventory-provider';
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
  const { startingScreen } = useInventory();
  const router = useRouter();
  const pathname = usePathname();
  const hasAppliedStartingScreen = useRef(false);

  const startingTarget = useMemo(() => resolveStartingScreenTarget(startingScreen), [startingScreen]);
  const initialTabRoute = useMemo(() => startingTarget.path.replace('/', ''), [startingTarget.path]);

  const closeDialog = useCallback(() => {
    setDialogOptions(null);
  }, []);

  const showDialog = useCallback((options: DialogOptions) => {
    setDialogOptions(options);
  }, []);

  useEffect(() => {
    if (hasAppliedStartingScreen.current) {
      return;
    }

    if (startingTarget.cocktailTab) {
      setLastCocktailTab(startingTarget.cocktailTab);
    }
    if (startingTarget.ingredientTab) {
      setLastIngredientTab(startingTarget.ingredientTab);
    }

    if (pathname !== startingTarget.path) {
      router.replace(startingTarget.path);
    }

    hasAppliedStartingScreen.current = true;
  }, [pathname, router, startingTarget]);

  return (
    <>
      <Tabs
        initialRouteName={initialTabRoute as 'cocktails' | 'shaker' | 'ingredients'}
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
