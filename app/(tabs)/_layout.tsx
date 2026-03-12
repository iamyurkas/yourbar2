import { Tabs } from 'expo-router';
import { StackActions } from '@react-navigation/native';
import { useCallback, useState } from 'react';
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
import { useI18n } from '@/libs/i18n/use-i18n';

const getNestedStackKey = (
  navigation: { getState: () => { routes: { key: string; state?: { key?: string } }[] } },
  route: { key: string; state?: { key?: string } },
) => {
  const stateRoute = navigation.getState().routes.find((candidate) => candidate.key === route.key);
  return stateRoute?.state?.key ?? route.state?.key;
};

const TAB_SCREENS: {
  name: 'cocktails' | 'shaker' | 'ingredients';
  titleKey: string;
  icon: typeof CocktailIcon;
}[] = [
    {
      name: 'cocktails',
      titleKey: 'tabs.cocktails',
      icon: CocktailIcon,
    },
    {
      name: 'shaker',
      titleKey: 'tabs.shaker',
      icon: ShakerIcon,
    },
    {
      name: 'ingredients',
      titleKey: 'tabs.ingredients',
      icon: LemonIcon,
    },
  ];

export default function TabLayout() {
  const [dialogOptions, setDialogOptions] = useState<DialogOptions | null>(null);
  const { t } = useI18n();
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
            backgroundColor: Colors.surface,
          },
          tabBarItemStyle: {
            justifyContent: 'center',
            alignItems: 'center',
          },
        }}>
        {TAB_SCREENS.map(({ name, titleKey, icon }) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title: t(titleKey),
              tabBarButton: (props) => (
                <OnboardingAnchor name={`tab-${name}`} style={styles.tabAnchor}>
                  <TabBarButton {...props} onOpenDialog={showDialog} />
                </OnboardingAnchor>
              ),
              tabBarIcon: ({ color, focused }) => <TabBarIcon source={icon} color={color} focused={focused} />,
            }}
            listeners={({ navigation, route }) => ({
              tabPress: (event) => {
                const navState = navigation.getState();
                const focusedRouteKey = navState.routes[navState.index]?.key;
                const isCurrentTabFocused = focusedRouteKey === route.key;

                if (!isCurrentTabFocused) {
                  return;
                }

                event.preventDefault();
                const nestedStackKey = getNestedStackKey(navigation, route);
                if (nestedStackKey) {
                  navigation.dispatch(Object.assign(StackActions.popToTop(), { target: nestedStackKey }));
                }
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
});
