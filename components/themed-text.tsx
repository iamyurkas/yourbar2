import { StyleSheet, Text, type TextProps } from 'react-native';

import { palette } from '@/theme/theme';
import { Colors, Fonts } from '@/constants/theme';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = lightColor ?? Colors.text;

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Fonts?.sans,
    fontWeight: '400',
  },
  defaultSemiBold: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Fonts?.sans,
    fontWeight: '600',
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: Fonts?.sans,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: Fonts?.sans,
    fontWeight: '600',
  },
  link: {
    lineHeight: 24,
    fontSize: 15,
    fontFamily: Fonts?.sans,
    fontWeight: '600',
    color: palette.primary,
  },
});
