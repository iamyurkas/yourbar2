import React from 'react';
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { MainTabs } from './MainTabs';
import { SettingsStack } from './SettingsStack';
import { palette } from '@theme/colors';

const Drawer = createDrawerNavigator();

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: palette.background,
    primary: palette.primary,
    card: palette.surface,
    text: palette.text,
    border: palette.border,
  },
};

export const RootNavigator = () => (
  <NavigationContainer theme={navigationTheme}>
    <Drawer.Navigator initialRouteName="Main" screenOptions={{ headerShown: false }}>
      <Drawer.Screen name="Main" component={MainTabs} options={{ title: 'Cocktails' }} />
      <Drawer.Screen name="Settings" component={SettingsStack} options={{ title: 'Settings' }} />
    </Drawer.Navigator>
  </NavigationContainer>
);
