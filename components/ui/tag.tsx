import { ReactNode } from 'react';
import { StyleProp, StyleSheet, TextStyle, View, ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

type TagProps = {
  label: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  leading?: ReactNode;
};

export function Tag({ label, color, style, textStyle, leading }: TagProps) {
  const fallbackBackground = useThemeColor({ light: '#E8E9FF', dark: '#28314E' }, 'background');
  const textColor = useThemeColor({}, 'text');

  return (
    <View style={[styles.container, { backgroundColor: color ?? fallbackBackground }, style]}>
      {leading}
      <ThemedText style={[styles.label, { color: textColor }, textStyle]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
});
