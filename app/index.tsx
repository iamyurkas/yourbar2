import React, { useEffect, useMemo } from 'react';
import { Redirect } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';

import { setLastCocktailTab, setLastIngredientTab } from '@/libs/collection-tabs';
import { useInventory, type StartScreen } from '@/providers/inventory-provider';

function getHrefForStartScreen(screen: StartScreen): string {
  switch (screen) {
    case 'shaker':
      return '/(tabs)/shaker';
    case 'ingredients_all':
    case 'ingredients_my':
    case 'ingredients_shopping':
      return '/(tabs)/ingredients';
    case 'cocktails_all':
    case 'cocktails_my':
    case 'cocktails_favorites':
    default:
      return '/(tabs)/cocktails';
  }
}

function syncTabPreference(screen: StartScreen) {
  switch (screen) {
    case 'cocktails_my':
      setLastCocktailTab('my');
      break;
    case 'cocktails_favorites':
      setLastCocktailTab('favorites');
      break;
    case 'ingredients_my':
      setLastIngredientTab('my');
      break;
    case 'ingredients_shopping':
      setLastIngredientTab('shopping');
      break;
    case 'cocktails_all':
      setLastCocktailTab('all');
      break;
    case 'ingredients_all':
      setLastIngredientTab('all');
      break;
    case 'shaker':
    default:
      break;
  }
}

export default function Index() {
  const { startScreen, loading } = useInventory();

  useEffect(() => {
    if (!loading) {
      syncTabPreference(startScreen);
    }
  }, [loading, startScreen]);

  const targetHref = useMemo(() => getHrefForStartScreen(startScreen), [startScreen]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Image source={require('@/assets/images/splash.png')} style={styles.splashImage} resizeMode="contain" />
        <Text style={styles.loadingText}>your rules!</Text>
      </View>
    );
  }

  return <Redirect href={targetHref} />;
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4DABF7',
  },
  splashImage: {
    width: 180,
    height: 180,
  },
  loadingText: {
    marginTop: 12,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
});
