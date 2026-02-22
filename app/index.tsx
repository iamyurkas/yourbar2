import React, { useEffect, useMemo } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

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
        <View style={styles.topGlow} />
        <View style={styles.bottomGlow} />

        <View style={styles.brandCard}>
          <Image source={require('@/assets/images/splash.png')} style={styles.splashImage} resizeMode="contain" />
          <Text style={styles.brandTitle}>your rules!</Text>
          <Text style={styles.brandSubtitle}>Shaking the perfect start…</Text>
          <View style={styles.loaderRow}>
            <ActivityIndicator size="small" color="#4DABF7" />
            <Text style={styles.loaderText}>Loading your bar</Text>
          </View>
        </View>
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
    backgroundColor: '#0F172A',
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  topGlow: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#4DABF7',
    opacity: 0.22,
  },
  bottomGlow: {
    position: 'absolute',
    bottom: -120,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#22D3EE',
    opacity: 0.2,
  },
  brandCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 24,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
  },
  splashImage: {
    width: 136,
    height: 136,
  },
  brandTitle: {
    marginTop: 8,
    color: '#0F172A',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  brandSubtitle: {
    marginTop: 6,
    color: '#475569',
    fontSize: 14,
    fontWeight: '500',
  },
  loaderRow: {
    marginTop: 18,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loaderText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
});
