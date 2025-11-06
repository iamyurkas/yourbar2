import { Stack } from 'expo-router';
import React from 'react';

export default function IngredientStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="create" options={{ title: 'Create Ingredient' }} />
      <Stack.Screen name="[id]" options={{ title: 'Ingredient Details' }} />
      <Stack.Screen name="[id]/edit" options={{ title: 'Edit Ingredient' }} />
    </Stack>
  );
}
