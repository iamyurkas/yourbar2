import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import CocktailIcon from '@/assets/images/cocktails.svg';
import IngredientsIcon from '@/assets/images/ingredients.svg';
import ShakerIcon from '@/assets/images/shaker.svg';
import { Colors } from '@/constants/theme';

export function SplashScreen() {
  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={styles.content}>
        <View style={styles.iconRow}>
          <Image source={CocktailIcon} style={[styles.icon, { tintColor: Colors.primary }]} contentFit="contain" />
          <Image source={ShakerIcon} style={[styles.icon, { tintColor: Colors.primary }]} contentFit="contain" />
          <Image source={IngredientsIcon} style={[styles.icon, { tintColor: Colors.primary }]} contentFit="contain" />
        </View>
        <Text style={[styles.title, { color: Colors.onSurface }]}>Your Bar</Text>
        <Text style={[styles.subtitle, { color: Colors.onSurfaceVariant }]}>your rules</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 36,
    height: 36,
    marginHorizontal: 12,
  },
  title: {
    marginTop: 20,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    letterSpacing: 1,
    textTransform: 'lowercase',
  },
});
