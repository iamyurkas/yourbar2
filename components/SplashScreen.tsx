import { Image } from 'expo-image';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import CocktailIcon from '@/assets/images/cocktails.svg';
import IngredientIcon from '@/assets/images/ingredients.svg';
import ShakerIcon from '@/assets/images/shaker.svg';
import { Colors, Fonts } from '@/constants/theme';

type SplashIcon = typeof CocktailIcon;

const ICONS: SplashIcon[] = [CocktailIcon, ShakerIcon, IngredientIcon];

function getRandomIcon(current: SplashIcon): SplashIcon {
  const filtered = ICONS.filter((icon) => icon !== current);
  return filtered[Math.floor(Math.random() * filtered.length)] ?? current;
}

export function SplashScreen() {
  const [firstIcon, setFirstIcon] = useState<SplashIcon>(CocktailIcon);
  const [secondIcon, setSecondIcon] = useState<SplashIcon>(ShakerIcon);
  const [thirdIcon, setThirdIcon] = useState<SplashIcon>(IngredientIcon);

  const updateIcon = useCallback((setter: React.Dispatch<React.SetStateAction<SplashIcon>>) => {
    setter((current) => getRandomIcon(current));
  }, []);

  useEffect(() => {
    const handles = [
      setInterval(() => updateIcon(setFirstIcon), 300),
      setInterval(() => updateIcon(setSecondIcon), 400),
      setInterval(() => updateIcon(setThirdIcon), 500),
    ];

    return () => {
      handles.forEach((handle) => clearInterval(handle));
    };
  }, [updateIcon]);

  return (
    <View style={styles.container}>
      <View style={styles.iconRow}>
        <Image source={firstIcon} style={styles.icon} contentFit="contain" />
        <Image source={secondIcon} style={styles.icon} contentFit="contain" />
        <Image source={thirdIcon} style={styles.icon} contentFit="contain" />
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
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 32,
  },
  icon: {
    width: 56,
    height: 56,
    tintColor: Colors.primary,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontFamily: Fonts.rounded,
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: Fonts.rounded,
    color: Colors.onSurfaceVariant,
  },
});
