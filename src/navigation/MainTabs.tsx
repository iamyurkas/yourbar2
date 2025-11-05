import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CocktailsNavigator } from '@screens/Cocktails/CocktailsNavigator';
import { ShakerScreen } from '@screens/Shaker/ShakerScreen';
import { IngredientsNavigator } from '@screens/Ingredients/IngredientsNavigator';
import { palette } from '@theme/colors';
import { Ionicons } from '@expo/vector-icons';

export type MainTabParamList = {
  Cocktails: undefined;
  Shaker: undefined;
  Ingredients: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: palette.primary,
      tabBarInactiveTintColor: palette.muted,
      tabBarStyle: {
        borderTopColor: palette.border,
      },
      tabBarIcon: ({ color, size }) => {
        const iconName = route.name === 'Cocktails' ? 'wine' : route.name === 'Ingredients' ? 'restaurant' : 'color-wand';
        return <Ionicons name={iconName as any} size={size} color={color} />;
      },
    })}
  >
    <Tab.Screen name="Cocktails" component={CocktailsNavigator} />
    <Tab.Screen name="Shaker" component={ShakerScreen} />
    <Tab.Screen name="Ingredients" component={IngredientsNavigator} />
  </Tab.Navigator>
);
