import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
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
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#1E1D22' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,24,28,0.08)',
        },
      ]}>
      <View style={styles.leadingIcon}>
        <ThemedText style={styles.iconGlyph}>⌕</ThemedText>
      </View>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={isDark ? 'rgba(236,237,238,0.6)' : 'rgba(17,24,28,0.45)'}
        value={value}
        onChangeText={onChange}
        style={[styles.input, { color: isDark ? '#ECEDEE' : '#11181C' }]}
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
              backgroundColor: pressed
                ? isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(17,24,28,0.08)'
                : 'transparent',
            },
          ]}>
          <ThemedText style={styles.trailingLabel}>{trailingActionLabel}</ThemedText>
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
  },
  leadingIcon: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    fontSize: 18,
    opacity: 0.6,
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

