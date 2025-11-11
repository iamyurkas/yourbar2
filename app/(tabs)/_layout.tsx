import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="cocktails"
      screenOptions={{
        headerShown: false,
        tabBar: () => null,
      }}>
      <Tabs.Screen name="cocktails" options={{ title: 'Cocktails' }} />
      <Tabs.Screen name="shaker" options={{ title: 'Shaker' }} />
      <Tabs.Screen name="ingredients" options={{ title: 'Ingredients' }} />
    </Tabs>
  );
}
