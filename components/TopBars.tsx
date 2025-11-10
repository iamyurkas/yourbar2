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
    <View style={[styles.topBar, { backgroundColor: palette.background }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open navigation"
        onPress={onMenuPress}
        style={[
          styles.iconButton,
          {
            backgroundColor: palette.surface,
            borderColor: `${palette.outline}80`,
            borderWidth: StyleSheet.hairlineWidth,
          },
        ]}>
        <MaterialCommunityIcons name="menu" size={22} color={palette.onSurface} />
      </Pressable>
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: palette.surface,
            borderColor: `${palette.outline}80`,
            borderWidth: StyleSheet.hairlineWidth,
            shadowColor: palette.shadow,
            shadowOpacity: 0.05,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 1,
          },
        ]}>
        <MaterialCommunityIcons name="magnify" size={20} color={palette.onSurfaceVariant} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={`${palette.onSurfaceVariant}B3`}
          returnKeyType="search"
          onSubmitEditing={handleSubmit}
          style={[styles.searchInput, { color: palette.text }]}
        />
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search query"
            onPress={() => onChangeText('')}
            style={[
              styles.clearButton,
              {
                backgroundColor: palette.surfaceVariant,
              },
            ]}>
            <MaterialCommunityIcons name="close" size={18} color={palette.onSurfaceVariant} />
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
            borderColor: `${palette.outline}80`,
            borderWidth: StyleSheet.hairlineWidth,
          },
        ]}>
        <MaterialCommunityIcons name="filter-variant" size={22} color={palette.onSurface} />
      </Pressable>
    </View>
  );
}

export function SegmentTabs({ options, value, onChange }: SegmentTabsProps) {
  const palette = Colors;

  return (
    <View style={styles.tabsContainer}>
      <View
        style={[
          styles.tabs,
          {
            backgroundColor: palette.surface,
            borderColor: `${palette.outline}80`,
            shadowColor: palette.shadow,
            shadowOpacity: 0.04,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 1,
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
                  backgroundColor: focused ? palette.surfaceBright : 'transparent',
                  borderColor: focused ? `${palette.outline}99` : 'transparent',
                  shadowOpacity: focused ? 0.08 : 0,
                  elevation: focused ? 2 : 0,
                },
              ]}>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: focused ? palette.text : palette.onSurfaceVariant,
                  },
                ]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsContainer: {
    paddingTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
    gap: 8,
    borderWidth: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
});
