import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { IngredientsHomeScreen } from './IngredientsHomeScreen';
import { AddIngredientScreen } from './AddIngredientScreen';

export type IngredientsStackParamList = {
  IngredientsHome: undefined;
  AddIngredient: undefined;
};

const Stack = createNativeStackNavigator<IngredientsStackParamList>();

export const IngredientsNavigator = () => (
  <Stack.Navigator>
    <Stack.Screen name="IngredientsHome" component={IngredientsHomeScreen} options={{ headerShown: false }} />
    <Stack.Screen name="AddIngredient" component={AddIngredientScreen} options={{ title: 'Add Ingredient' }} />
  </Stack.Navigator>
);
