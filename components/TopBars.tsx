import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputSubmitEditingEventData,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { radii, spacing, typography } from '@/theme/design-tokens';

type SearchTopBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onSubmit?: (value: string) => void;
  onMenuPress?: () => void;
  onFilterPress?: () => void;
};

export type SegmentTabOption = {
  key: string;
  label: string;
};

type SegmentTabsProps = {
  options: SegmentTabOption[];
  value: string;
  onChange: (key: string) => void;
};

export function SearchTopBar({
  value,
  onChangeText,
  placeholder = 'Search',
  onSubmit,
  onMenuPress,
  onFilterPress,
}: SearchTopBarProps) {
  const palette = Colors;

  const handleSubmit = (event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
    onSubmit?.(event.nativeEvent.text);
  };

  return (
    <View
      style={[
        styles.topBar,
        {
          backgroundColor: palette.surfaceBright,
          borderBottomColor: palette.outline,
          borderBottomWidth: StyleSheet.hairlineWidth,
          shadowColor: palette.shadow,
        },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open navigation"
        onPress={onMenuPress}
        style={[
          styles.iconButton,
          {
            backgroundColor: palette.surface,
            borderColor: palette.outline,
          },
        ]}>
        <MaterialCommunityIcons name="menu" size={22} color={palette.onSurface} />
      </Pressable>
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: palette.surface,
            borderColor: palette.outline,
          },
        ]}>
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color={palette.icon}
          style={styles.searchIcon}
        />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={`${palette.onSurfaceVariant}99`}
          returnKeyType="search"
          onSubmitEditing={handleSubmit}
          style={[styles.searchInput, { color: palette.text }]}
        />
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search query"
            onPress={() => onChangeText('')}
            style={styles.clearButton}>
            <MaterialCommunityIcons name="close" size={18} color={palette.onSurface} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Filter items"
        onPress={onFilterPress}
        style={[
          styles.iconButton,
          {
            backgroundColor: palette.surface,
            borderColor: palette.outline,
          },
        ]}>
        <MaterialCommunityIcons name="filter-variant" size={22} color={palette.icon} />
      </Pressable>
    </View>
  );
}

export function SegmentTabs({ options, value, onChange }: SegmentTabsProps) {
  const palette = Colors;

  return (
    <View
      style={[
        styles.tabs,
        {
          backgroundColor: palette.surfaceBright,
        },
      ]}>
      {options.map((option) => {
        const focused = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={() => onChange(option.key)}
            style={[
              styles.tabButton,
              {
                backgroundColor: focused ? palette.tint : 'transparent',
                borderColor: focused ? palette.tint : palette.outline,
              },
            ]}>
            <Text
              style={[
                styles.tabLabel,
                {
                  color: focused ? palette.onPrimary : palette.onSurfaceVariant,
                },
              ]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    zIndex: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tabLabel: {
    ...typography.label,
    textTransform: 'uppercase',
  },
});
