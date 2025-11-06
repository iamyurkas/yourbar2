import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

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
  const palette = Colors.light;
  const backgroundColor = '#FFFFFF';
  const borderColor = palette.outline;
  const placeholderColor = '#A1A1A1';
  const textColor = palette.text;
  const accent = palette.tint;

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
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 12,
    height: 44,
    shadowColor: '#000000',
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
    fontSize: 18,
    color: '#A1A1A1',
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
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});

