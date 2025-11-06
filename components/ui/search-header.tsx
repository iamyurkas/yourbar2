import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { PlatformPressable } from '@react-navigation/elements';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type SearchHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder: string;
  onPressMenu?: () => void;
  onPressFilter?: () => void;
  filterActive?: boolean;
  accessory?: React.ReactNode;
};

export function SearchHeader({
  query,
  onQueryChange,
  placeholder,
  onPressMenu,
  onPressFilter,
  filterActive = false,
  accessory,
}: SearchHeaderProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const outline = colors.outline;
  const tertiary = colors.tertiary;
  const textColor = colors.text;
  const iconColor = colors.icon;

  return (
    <View style={styles.container}>
      <PlatformPressable
        accessibilityRole="button"
        onPress={onPressMenu}
        style={({ pressed }) => [
          styles.iconButton,
          { backgroundColor: pressed ? colors.surfaceVariant : 'transparent' },
        ]}
        android_ripple={{ color: tertiary }}>
        <MaterialIcons name="menu" size={24} color={iconColor} />
      </PlatformPressable>

      <View
        style={[
          styles.searchField,
          {
            borderColor: outline,
            backgroundColor: colors.surface,
          },
        ]}>
        <MaterialIcons name="search" size={20} color={iconColor} style={styles.leadingIcon} />
        <TextInput
          value={query}
          placeholder={placeholder}
          placeholderTextColor={`${iconColor}99`}
          onChangeText={onQueryChange}
          style={[styles.input, { color: textColor }]}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityRole="search"
        />
        {query.length > 0 ? (
          <PlatformPressable
            accessibilityRole="button"
            onPress={() => onQueryChange('')}
            style={({ pressed }) => [
              styles.clearButton,
              { backgroundColor: pressed ? colors.surfaceVariant : 'transparent' },
            ]}
            android_ripple={{ color: tertiary }}>
            <MaterialIcons name="close" size={18} color={iconColor} />
          </PlatformPressable>
        ) : null}
      </View>

      <PlatformPressable
        accessibilityRole="button"
        onPress={onPressFilter}
        disabled={!onPressFilter}
        style={({ pressed }) => [
          styles.iconButton,
          {
            backgroundColor: pressed
              ? colors.surfaceVariant
              : filterActive
                ? colors.primaryContainer
                : 'transparent',
            borderColor: filterActive ? colors.primary : 'transparent',
          },
        ]}
        android_ripple={{ color: tertiary }}>
        <MaterialIcons
          name={filterActive ? 'tune' : 'filter-alt'}
          size={24}
          color={filterActive ? colors.primary : iconColor}
        />
      </PlatformPressable>

      {accessory}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 12,
    height: 44,
    overflow: 'hidden',
  },
  leadingIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

