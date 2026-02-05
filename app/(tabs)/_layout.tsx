import { Stack, usePathname, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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

type TabName = 'cocktails' | 'shaker' | 'ingredients';

const TAB_SCREENS: Array<{
  name: TabName;
  title: string;
  icon: typeof CocktailIcon;
  path: string;
}> = [
    {
      name: 'cocktails',
      title: 'Cocktails',
      icon: CocktailIcon,
      path: '/cocktails',
    },
    {
      name: 'shaker',
      title: 'Shaker',
      icon: ShakerIcon,
      path: '/shaker',
    },
    {
      name: 'ingredients',
      title: 'Ingredients',
      icon: LemonIcon,
      path: '/ingredients',
    },
  ];

export default function TabLayout() {
  const [dialogOptions, setDialogOptions] = useState<DialogOptions | null>(null);
  const insets = useSafeAreaInsets();
  const Colors = useAppColors();
  const pathname = usePathname();
  const router = useRouter();

  const activeTab = useMemo<TabName>(() => {
    if (pathname.startsWith('/cocktails')) return 'cocktails';
    if (pathname.startsWith('/shaker')) return 'shaker';
    if (pathname.startsWith('/ingredients')) return 'ingredients';
    return 'cocktails';
  }, [pathname]);

  const closeDialog = useCallback(() => {
    setDialogOptions(null);
  }, []);

  const showDialog = useCallback((options: DialogOptions) => {
    setDialogOptions(options);
  }, []);

  const handleTabPress = useCallback((name: TabName) => {
    switch (name) {
      case 'cocktails':
        getLastCocktailTab();
        router.navigate('/cocktails');
        break;
      case 'shaker':
        router.navigate('/shaker');
        break;
      case 'ingredients':
        getLastIngredientTab();
        router.navigate('/ingredients');
        break;
    }
  }, [router]);

  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'simple_push',
        }}>
        <Stack.Screen name="cocktails/index" options={{ title: 'Cocktails' }} />
        <Stack.Screen name="cocktails/[cocktailId]" options={{ title: 'Cocktail details' }} />
        <Stack.Screen name="cocktails/create" options={{ title: 'Add cocktail' }} />
        <Stack.Screen name="ingredients/index" options={{ title: 'Ingredients' }} />
        <Stack.Screen name="ingredients/[ingredientId]" options={{ title: 'Ingredient details' }} />
        <Stack.Screen name="ingredients/create" options={{ title: 'Add ingredient' }} />
        <Stack.Screen name="shaker/index" options={{ title: 'Shaker' }} />
        <Stack.Screen name="shaker/results" options={{ title: 'Shaker results' }} />
      </Stack>

      <View style={[styles.tabBarContainer, { height: 72 + insets.bottom, paddingBottom: insets.bottom }]}>
        <View style={styles.tabBarBackground}>
          <View style={[styles.tabBarSurface, { backgroundColor: Colors.surface }]} />
          <View style={[styles.tabBarInset, { height: insets.bottom, backgroundColor: Colors.surface }]} />
        </View>
        <View style={styles.tabBarContent}>
          {TAB_SCREENS.map(({ name, title, icon }) => {
            const focused = activeTab === name;
            const color = focused ? Colors.primary : Colors.onSurfaceVariant;
            return (
              <OnboardingAnchor key={name} name={`tab-${name}`} style={styles.tabAnchor}>
                <TabBarButton
                  onOpenDialog={showDialog}
                  onPress={() => handleTabPress(name)}
                  accessibilityLabel={title}
                  style={styles.tabButton}
                >
                  <TabBarIcon source={icon} color={color} focused={focused} />
                </TabBarButton>
              </OnboardingAnchor>
            );
          })}
        </View>
      </View>

      <AppDialog
        visible={dialogOptions != null}
        title={dialogOptions?.title ?? ''}
        message={dialogOptions?.message}
        actions={dialogOptions?.actions ?? []}
        onRequestClose={closeDialog}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
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
  tabBarContent: {
    flex: 1,
    flexDirection: 'row',
  },
  tabAnchor: {
    flex: 1,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
