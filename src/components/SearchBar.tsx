import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { palette } from '@theme/colors';
import { spacing } from '@theme/spacing';

interface SearchBarProps {
  value: string;
  placeholder?: string;
  onChangeText?: (value: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, placeholder = 'Search', onChangeText }) => {
  return (
    <View style={styles.container}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        style={styles.input}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  input: {
    fontSize: 16,
    color: palette.text,
  },
});
