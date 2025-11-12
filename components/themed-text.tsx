import { StyleSheet, Text, type TextProps } from 'react-native';

import { palette } from '@/theme/theme';
import { Colors } from '@/constants/theme';
import { fontFamilies, typography } from '@/theme/design-system';

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
    ...typography.body,
    fontFamily: fontFamilies.sans,
  },
  defaultSemiBold: {
    ...typography.bodyLarge,
    fontFamily: fontFamilies.sans,
    fontWeight: '600',
  },
  title: {
    ...typography.headline,
  },
  subtitle: {
    ...typography.title,
  },
  link: {
    ...typography.body,
    fontFamily: fontFamilies.sans,
    fontWeight: '600',
    color: palette.primary,
  },
});
