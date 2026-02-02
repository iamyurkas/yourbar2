import { Image, type ImageProps } from 'expo-image';
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

const whitePixel = require('@/assets/images/white_pixel.png');

export interface AppImageProps extends ImageProps {
  containerStyle?: ViewStyle | ViewStyle[];
}

/**
 * A wrapper around `expo-image` that adds a white pixel background.
 */
export function AppImage({ source, style, containerStyle, contentFit, ...props }: AppImageProps) {
  if (!source) {
    return null;
  }

  return (
    <View style={[styles.container, containerStyle, style]}>
      <Image
        source={whitePixel}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
        transition={0}
      />
      <Image
        source={source}
        style={[styles.foreground, style, { backgroundColor: 'transparent' }]}
        contentFit={contentFit}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  foreground: {
    width: '100%',
    height: '100%',
  },
});
