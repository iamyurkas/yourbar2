import React from 'react';
import { Feather } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
  View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type SearchBarProps = {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  style?: StyleProp<ViewStyle>;
};

export function SearchBar({ placeholder, value, onChange, onSubmitEditing, style }: SearchBarProps) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];

  const handleClear = () => {
    if (value) {
      onChange('');
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surfaceVariant,
          borderColor: theme.outline,
        },
        style,
      ]}>
      <Feather name="search" size={18} color={theme.icon} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={theme.textSubtle}
        value={value}
        onChangeText={onChange}
        style={[styles.input, { color: theme.text }]}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityRole="search"
        onSubmitEditing={onSubmitEditing}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={handleClear}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          android_ripple={{ color: theme.ripple, radius: 18 }}>
          <Feather name="x-circle" size={18} color={theme.textSubtle} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    gap: 12,
    height: 44,
  },
  input: {
    flex: 1,
    fontSize: 15,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: 0.95 }],
  },
});
