import { Tabs } from 'expo-router';
import React from 'react';

import { BottomBar } from '@/navigation/BottomBar';

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="cocktails"
      screenOptions={{
        headerShown: false,
        tabBar: (props) => <BottomBar {...props} />,
        tabBarHideOnKeyboard: true,
      }}>
      <Tabs.Screen name="cocktails" options={{ title: 'Cocktails' }} />
      <Tabs.Screen name="shaker" options={{ title: 'Shaker' }} />
      <Tabs.Screen name="ingredients" options={{ title: 'Ingredients' }} />
    </Tabs>
  );
}
