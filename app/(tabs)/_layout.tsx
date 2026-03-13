import { Tabs } from 'expo-router';
import { StackActions } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CocktailIcon from '@/assets/images/cocktails.svg';
import LemonIcon from '@/assets/images/ingredients.svg';
import ShakerIcon from '@/assets/images/shaker.svg';
import { AppDialog, type DialogOptions } from '@/components/AppDialog';
import { TabBarButton } from '@/components/tab-bar/TabBarButton';
import { TabBarIcon } from '@/components/tab-bar/TabBarIcon';
import { OnboardingProvider } from '@/providers/onboarding-provider';
import { useAppColors } from '@/constants/theme';
import { useI18n } from '@/libs/i18n/use-i18n';

type TabPressHandler = (
  navigation: {
    navigate: (...args: never[]) => void;
    dispatch: (action: ReturnType<typeof StackActions.popToTop> & { target?: string }) => void;
    getState: () => {
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
    name: string;
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

const TAB_SCREENS: {
  name: 'cocktails' | 'shaker' | 'ingredients';
  onboardingTargetId: 'tab-cocktails' | 'tab-shaker' | 'tab-ingredients';
  titleKey: string;
  icon: typeof CocktailIcon;
  onTabPress: TabPressHandler;
}[] = [
  {
    name: 'cocktails',
    titleKey: 'tabs.cocktails',
    icon: CocktailIcon,
    onboardingTargetId: 'tab-cocktails',
    onTabPress: (navigation, route) => {
      navigation.navigate(route.name as never, { screen: 'index' } as never);
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
      navigation.navigate(route.name as never, { screen: 'index' } as never);
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
      navigation.navigate(route.name as never, { screen: 'index' } as never);
      const nestedStackKey = getNestedStackKey(navigation, route);
      if (nestedStackKey) {
        navigation.dispatch(Object.assign(StackActions.popToTop(), { target: nestedStackKey }));
      }
    },
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
    <OnboardingProvider>
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
    </OnboardingProvider>
  );
}

