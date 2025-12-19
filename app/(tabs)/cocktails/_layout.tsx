import { Stack } from 'expo-router';
import React from 'react';

export default function CocktailsLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
