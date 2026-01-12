import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

type SearchBarProps = {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  trailingActionLabel?: string;
  onPressTrailingAction?: () => void;
};

export function SearchBar({
  placeholder,
  value,
  onChange,
  trailingActionLabel,
  onPressTrailingAction,
}: SearchBarProps) {
  const paletteColors = Colors;
  const backgroundColor = paletteColors.surfaceBright;
  const borderColor = paletteColors.outline;
  const placeholderColor = paletteColors.placeholder;
  const textColor = paletteColors.text;
  const accent = paletteColors.tint;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          borderColor,
          shadowOpacity: 0.04,
        },
      ]}>
      <View style={styles.leadingIcon}>
        <ThemedText style={styles.iconGlyph}>⌕</ThemedText>
      </View>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        value={value}
        onChangeText={onChange}
        style={[styles.input, { color: textColor }]}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityRole="search"
      />
      {trailingActionLabel ? (
        <Pressable
          onPress={onPressTrailingAction}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.trailing,
            {
              backgroundColor: pressed ? `${accent}1A` : 'transparent',
            },
          ]}>
          <ThemedText style={[styles.trailingLabel, { color: accent }]}>{trailingActionLabel}</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 12,
    height: 44,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    shadowOpacity: 0.08,
    elevation: 2,
  },
  leadingIcon: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    fontSize: 16,
    color: Colors.placeholder,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  trailing: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  trailingLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
