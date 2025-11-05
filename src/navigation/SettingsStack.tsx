import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsScreen } from '@screens/Settings/SettingsScreen';

export type SettingsStackParamList = {
  SettingsHome: undefined;
};

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export const SettingsStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="SettingsHome" component={SettingsScreen} options={{ title: 'Settings' }} />
  </Stack.Navigator>
);
