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
import { radius, spacing, typography } from '@/theme/design-system';

const ICON_BUTTON_SIZE = spacing.xxl + spacing.sm;
const CLEAR_BUTTON_SIZE = spacing.xl + spacing.xs;

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
          backgroundColor: palette.background,
          borderBottomColor: palette.outline,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open navigation"
        onPress={onMenuPress}
        style={[styles.iconButton, { backgroundColor: palette.surfaceVariant }]}>
        <MaterialCommunityIcons name="menu" size={24} color={palette.onSurface} />
      </Pressable>
      <View style={[styles.searchContainer, { backgroundColor: palette.surface, borderColor: palette.background }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={palette.onSurface} style={styles.searchIcon} />
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
            style={[styles.clearButton, { backgroundColor: palette.surfaceVariant }]}>
            <MaterialCommunityIcons name="close" size={18} color={palette.onSurface} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Filter items"
        onPress={onFilterPress}
        style={[styles.iconButton, { backgroundColor: palette.surfaceVariant }]}>
        <MaterialCommunityIcons name="filter-variant" size={24} color={palette.icon} />
      </Pressable>
    </View>
  );
}

export function SegmentTabs({ options, value, onChange }: SegmentTabsProps) {
  const palette = Colors;

  return (
    <View style={[styles.tabs, { backgroundColor: palette.surface }]}> 
      {options.map((option) => {
        const focused = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={() => onChange(option.key)}
            style={[styles.tabButton, focused ? { backgroundColor: `${palette.tint}14` } : undefined]}>
            <Text
              style={[
                styles.tabLabel,
                {
                  color: focused ? palette.tint : palette.onSurfaceVariant,
                  fontWeight: focused ? '600' : '500',
                },
              ]}>
              {option.label}
            </Text>
            <View
              style={[
                styles.tabIndicator,
                {
                  backgroundColor: focused ? palette.tint : 'transparent',
                },
              ]}
            />
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
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  iconButton: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
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
    width: CLEAR_BUTTON_SIZE,
    height: CLEAR_BUTTON_SIZE,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: 0,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  tabLabel: {
    ...typography.label,
  },
  tabIndicator: {
    width: '60%',
    height: 3,
    borderRadius: radius.sm,
  },
});
