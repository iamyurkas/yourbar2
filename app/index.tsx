import React, { useEffect, useMemo } from 'react';
import { Redirect } from 'expo-router';

import { setLastCocktailTab, setLastIngredientTab } from '@/libs/collection-tabs';
import {
  useInventoryData,
  useInventorySettings,
  type StartScreen,
} from '@/providers/inventory-provider';

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
  const { loading } = useInventoryData();
  const { startScreen } = useInventorySettings();

  useEffect(() => {
    if (!loading) {
      syncTabPreference(startScreen);
    }
  }, [loading, startScreen]);

  const targetHref = useMemo(() => getHrefForStartScreen(startScreen), [startScreen]);

  if (loading) {
    return null;
  }

  return <Redirect href={targetHref} />;
}
