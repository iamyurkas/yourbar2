import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CocktailsHomeScreen } from './CocktailsHomeScreen';
import { AddCocktailScreen } from './AddCocktailScreen';

export type CocktailsStackParamList = {
  CocktailsHome: undefined;
  AddCocktail: undefined;
};

const Stack = createNativeStackNavigator<CocktailsStackParamList>();

export const CocktailsNavigator = () => (
  <Stack.Navigator>
    <Stack.Screen name="CocktailsHome" component={CocktailsHomeScreen} options={{ headerShown: false }} />
    <Stack.Screen name="AddCocktail" component={AddCocktailScreen} options={{ title: 'Add Cocktail' }} />
  </Stack.Navigator>
);
