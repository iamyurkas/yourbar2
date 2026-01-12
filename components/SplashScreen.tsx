import { Image } from 'expo-image';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import CocktailIcon from '@/assets/images/cocktails.svg';
import LemonIcon from '@/assets/images/ingredients.svg';
import ShakerIcon from '@/assets/images/shaker.svg';
import { Colors } from '@/constants/theme';

const ICON_SOURCES = [CocktailIcon, ShakerIcon, LemonIcon];

function pickRandomIcon(exclude: (typeof ICON_SOURCES)[number]) {
  const options = ICON_SOURCES.filter((icon) => icon !== exclude);
  return options[Math.floor(Math.random() * options.length)] ?? exclude;
}

export function SplashScreen() {
  const [firstIcon, setFirstIcon] = useState(ICON_SOURCES[0]);
  const [secondIcon, setSecondIcon] = useState(ICON_SOURCES[1]);
  const [thirdIcon, setThirdIcon] = useState(ICON_SOURCES[2]);

  const updateFirstIcon = useCallback(() => {
    setFirstIcon((current) => pickRandomIcon(current));
  }, []);

  const updateSecondIcon = useCallback(() => {
    setSecondIcon((current) => pickRandomIcon(current));
  }, []);

  const updateThirdIcon = useCallback(() => {
    setThirdIcon((current) => pickRandomIcon(current));
  }, []);

  useEffect(() => {
    const firstInterval = setInterval(updateFirstIcon, 300);
    const secondInterval = setInterval(updateSecondIcon, 400);
    const thirdInterval = setInterval(updateThirdIcon, 500);

    return () => {
      clearInterval(firstInterval);
      clearInterval(secondInterval);
      clearInterval(thirdInterval);
    };
  }, [updateFirstIcon, updateSecondIcon, updateThirdIcon]);

  return (
    <View style={styles.container}>
      <View style={styles.iconRow}>
        <Image source={firstIcon} style={styles.icon} contentFit="contain" tintColor={Colors.primary} />
        <Image source={secondIcon} style={styles.icon} contentFit="contain" tintColor={Colors.primary} />
        <Image source={thirdIcon} style={styles.icon} contentFit="contain" tintColor={Colors.primary} />
      </View>
      <Text style={styles.title}>Your Bar</Text>
      <Text style={styles.subtitle}>Your rules</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 24,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 24,
  },
  icon: {
    width: 56,
    height: 56,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 16,
    color: Colors.onSurfaceVariant,
  },
});
