import { Image } from 'expo-image';
import React from 'react';
import type { ImageSource } from 'expo-image';

type TabBarIconProps = {
  source: ImageSource;
  color: string;
  focused: boolean;
};

export function TabBarIcon({ source, color, focused }: TabBarIconProps) {
  return (
    <Image
      source={source}
      style={{ width: 24, height: 24, tintColor: color, opacity: focused ? 1 : 0.72 }}
      contentFit="contain"
    />
  );
}
