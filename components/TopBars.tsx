import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutRectangle,
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
  filterActive?: boolean;
  filterExpanded?: boolean;
  onFilterLayout?: (layout: LayoutRectangle) => void;
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
  filterActive = false,
  filterExpanded = false,
  onFilterLayout,
}: SearchTopBarProps) {
  const palette = Colors;
  const accentColor = palette.tint;

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
        style={({ pressed }) => [styles.iconButton, pressed && styles.surfacePressed]}>
        <MaterialCommunityIcons name="menu" size={24} color={palette.onSurface} />
      </Pressable>
      <View
        style={[
          styles.searchContainer,
          { backgroundColor: palette.surface, borderColor: palette.outline },
        ]}>
        <MaterialCommunityIcons name="magnify" size={20} color={palette.onSurface} style={styles.searchIcon} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={`${palette.onSurfaceVariant}99`}
          returnKeyType="search"
          onSubmitEditing={handleSubmit}
          style={[styles.searchInput, { color: palette.text, fontWeight: '400' }]}
        />
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search query"
            onPress={() => onChangeText('')}
            style={({ pressed }) => [styles.clearButton, pressed && styles.surfacePressed]}>
            <MaterialCommunityIcons name="close" size={18} color={palette.onSurface} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Filter items"
        accessibilityState={filterExpanded ? { expanded: true } : undefined}
        onPress={onFilterPress}
        onLayout={(event) => onFilterLayout?.(event.nativeEvent.layout)}
        style={({ pressed }) => [
          styles.iconButton,
          filterActive ? { backgroundColor: palette.primaryContainer } : null,
          pressed && styles.surfacePressed,
        ]}>
        <MaterialCommunityIcons
          name="filter-variant"
          size={24}
          color={filterActive ? accentColor : palette.icon}
        />
      </Pressable>
    </View>
  );
}

export function SegmentTabs({ options, value, onChange }: SegmentTabsProps) {
  const palette = Colors;
  const accentColor = palette.tint;

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
            style={({ pressed }) => [
              styles.tabButton,
              focused || pressed ? styles.tabButtonActive : null,
            ]}>
            <Text
              style={[
                styles.tabLabel,
                {
                  color: focused ? accentColor : palette.onSurface,
                  fontWeight: focused ? '600' : '500',
                },
              ]}>
              {option.label}
            </Text>
            <View
              style={[
                styles.tabIndicator,
                {
                  backgroundColor: focused ? accentColor : 'transparent',
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
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: Colors.primaryContainer,
  },
  tabLabel: {
    fontSize: 16,
  },
  tabIndicator: {
    width: '80%',
    height: 3,
    borderRadius: 3,
  },
  surfacePressed: {
    backgroundColor: Colors.surfaceVariant,
  },
});
