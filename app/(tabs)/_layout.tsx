import { Tabs } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CocktailIcon from '@/assets/images/cocktails.svg';
import LemonIcon from '@/assets/images/ingredients.svg';
import ShakerIcon from '@/assets/images/shaker.svg';
import { AppDialog, type DialogOptions } from '@/components/AppDialog';
import { OnboardingAnchor } from '@/components/onboarding/OnboardingAnchor';
import { TabBarButton } from '@/components/tab-bar/TabBarButton';
import { TabBarIcon } from '@/components/tab-bar/TabBarIcon';
import { useAppColors } from '@/constants/theme';
import { getLastCocktailTab, getLastIngredientTab } from '@/libs/collection-tabs';
import { useI18n } from '@/libs/i18n/use-i18n';

type TabPressHandler = (navigation: { navigate: (...args: never[]) => void }, route: { name: string }) => void;

const TAB_SCREENS: {
  name: 'cocktails' | 'shaker' | 'ingredients';
  titleKey: string;
  icon: typeof CocktailIcon;
  onTabPress: TabPressHandler;
}[] = [
    {
      name: 'cocktails',
      titleKey: 'tabs.cocktails',
      icon: CocktailIcon,
      onTabPress: (navigation, route) => {
        getLastCocktailTab();
        navigation.navigate(route.name as never, { screen: 'index' } as never);
      },
    },
    {
      name: 'shaker',
      titleKey: 'tabs.shaker',
      icon: ShakerIcon,
      onTabPress: (navigation, route) => {
        navigation.navigate(route.name as never, { screen: 'index' } as never);
      },
    },
    {
      name: 'ingredients',
      titleKey: 'tabs.ingredients',
      icon: LemonIcon,
      onTabPress: (navigation, route) => {
        getLastIngredientTab();
        navigation.navigate(route.name as never, { screen: 'index' } as never);
      },
    },
  ];

export default function TabLayout() {
  const [dialogOptions, setDialogOptions] = useState<DialogOptions | null>(null);
  const [layoutWorkaround, setLayoutWorkaround] = useState(false);
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const Colors = useAppColors();

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLayoutWorkaround(true);
    }, 500);
    return () => clearTimeout(timeout);
  }, []);

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
            height: 72 + insets.bottom + (layoutWorkaround ? 0 : 0.1),
            backgroundColor: Colors.surface,
          },
          tabBarItemStyle: {
            paddingTop: 8,
            paddingBottom: insets.bottom,
            justifyContent: 'center',
            alignItems: 'stretch',
          },
        }}>
        {TAB_SCREENS.map(({ name, titleKey, icon, onTabPress }) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title: t(titleKey),
              tabBarButton: (props) => (
                <OnboardingAnchor
                  name={`tab-${name}`}
                  style={[styles.tabAnchor, props.style]}
                >
                  <TabBarButton
                    {...props}
                    style={styles.tabButton}
                    onOpenDialog={showDialog}
                  />
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
  tabAnchor: {
    flex: 1,
  },
  tabButton: {
    flex: 1,
  },
});
