import { View, type ViewProps } from 'react-native';

import { useAppColors } from '@/constants/theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const colors = useAppColors();
  const backgroundColor = (colors.background === '#FFFFFF' ? lightColor : darkColor) ?? colors.background;

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
