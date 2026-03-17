import { Tabs } from 'expo-router';
import { StackActions } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CocktailIcon from '@/assets/images/cocktails.svg';
import LemonIcon from '@/assets/images/ingredients.svg';
import ShakerIcon from '@/assets/images/shaker.svg';
import { AppDialog, type DialogOptions } from '@/components/AppDialog';
import { TabBarButton } from '@/components/tab-bar/TabBarButton';
import { TabBarIcon } from '@/components/tab-bar/TabBarIcon';
import { useAppColors } from '@/constants/theme';
import { useI18n } from '@/libs/i18n/use-i18n';

type TabPressHandler = (
  navigation: {
    dispatch: (action: ReturnType<typeof StackActions.popToTop> & { target?: string }) => void;
    getState: () => {
      index: number;
      routes: {
        key: string;
        state?: {
          key?: string;
        };
      }[];
    };
  },
  route: {
    key: string;
    state?: {
      key?: string;
    };
  },
) => void;

const getNestedStackKey = (
  navigation: { getState: () => { routes: { key: string; state?: { key?: string } }[] } },
  route: { key: string; state?: { key?: string } },
) => {
  const stateRoute = navigation.getState().routes.find((candidate) => candidate.key === route.key);
  return stateRoute?.state?.key ?? route.state?.key;
};

const isFocusedTabRoute = (
  navigation: { getState: () => { index: number; routes: { key: string }[] } },
  route: { key: string },
) => navigation.getState().routes[navigation.getState().index]?.key === route.key;

const TAB_SCREENS: {
  name: 'cocktails' | 'shaker' | 'ingredients';
  titleKey: string;
  icon: typeof CocktailIcon;
  onTabPress: TabPressHandler;
  onboardingTargetId: 'tab-cocktails' | 'tab-shaker' | 'tab-ingredients';
}[] = [
  {
    name: 'cocktails',
    titleKey: 'tabs.cocktails',
    icon: CocktailIcon,
    onboardingTargetId: 'tab-cocktails',
    onTabPress: (navigation, route) => {
      const nestedStackKey = getNestedStackKey(navigation, route);
      if (nestedStackKey) {
        navigation.dispatch(Object.assign(StackActions.popToTop(), { target: nestedStackKey }));
      }
    },
  },
  {
    name: 'shaker',
    titleKey: 'tabs.shaker',
    icon: ShakerIcon,
    onboardingTargetId: 'tab-shaker',
    onTabPress: (navigation, route) => {
      const nestedStackKey = getNestedStackKey(navigation, route);
      if (nestedStackKey) {
        navigation.dispatch(Object.assign(StackActions.popToTop(), { target: nestedStackKey }));
      }
    },
  },
  {
    name: 'ingredients',
    titleKey: 'tabs.ingredients',
    icon: LemonIcon,
    onboardingTargetId: 'tab-ingredients',
    onTabPress: (navigation, route) => {
      const nestedStackKey = getNestedStackKey(navigation, route);
      if (nestedStackKey) {
        navigation.dispatch(Object.assign(StackActions.popToTop(), { target: nestedStackKey }));
      }
    },
  },
];

export default function TabLayout() {
  const [dialogOptions, setDialogOptions] = useState<DialogOptions | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const Colors = useAppColors();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
    };
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
          freezeOnBlur: false,
          lazy: false,
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
        {TAB_SCREENS.map(({ name, titleKey, icon, onTabPress, onboardingTargetId }) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title: t(titleKey),
              tabBarButton: (props) => <TabBarButton {...props} onboardingTargetId={onboardingTargetId} onOpenDialog={showDialog} />,
              tabBarIcon: ({ color, focused }) => <TabBarIcon source={icon} color={color} focused={focused} />,
            }}
            listeners={({ navigation, route }) => ({
              tabPress: (event) => {
                if (appStateRef.current !== 'active' || !isFocusedTabRoute(navigation, route)) {
                  return;
                }

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
