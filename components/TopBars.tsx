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

import { useAppColors } from '@/constants/theme';

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
  const colors = useAppColors();

  const handleSubmit = (event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
    onSubmit?.(event.nativeEvent.text);
  };

  return (
    <View
      style={[
        styles.topBar,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.outline,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open navigation"
        onPress={onMenuPress}
        style={styles.iconButton}>
        <MaterialCommunityIcons name="menu" size={24} color={colors.onSurface} />
      </Pressable>
      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.background }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.onSurface} style={styles.searchIcon} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={`${colors.onSurfaceVariant}99`}
          returnKeyType="search"
          onSubmitEditing={handleSubmit}
          style={[styles.searchInput, { color: colors.text, fontWeight: '400' }]}
        />
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search query"
            onPress={() => onChangeText('')}
            style={styles.clearButton}>
            <MaterialCommunityIcons name="close" size={18} color={colors.onSurface} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Filter items"
        accessibilityState={filterExpanded ? { expanded: true } : undefined}
        onPress={onFilterPress}
        onLayout={(event) => onFilterLayout?.(event.nativeEvent.layout)}
        style={[
          styles.iconButton,
          filterActive
            ? { backgroundColor: `${colors.tint}1A` }
            : null,
        ]}>
        <MaterialCommunityIcons
          name="filter-variant"
          size={24}
          color={filterActive ? colors.tint : colors.icon}
        />
      </Pressable>
    </View>
  );
}

export function SegmentTabs({ options, value, onChange }: SegmentTabsProps) {
  const colors = useAppColors();

  return (
    <View style={[styles.tabs, { backgroundColor: colors.surface }]}>
      {options.map((option) => {
        const focused = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={() => onChange(option.key)}
            style={styles.tabButton}>
            <Text
              style={[
                styles.tabLabel,
                {
                  color: focused ? colors.tint : colors.onSurfaceVariant,
                  fontWeight: focused ? '600' : '400',
                },
              ]}>
              {option.label}
            </Text>
            <View
              style={[
                styles.tabIndicator,
                {
                  backgroundColor: focused ? colors.tint : 'transparent',
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
    paddingTop: 12,
    paddingBottom: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
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
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 0,
    elevation: 4,
    zIndex: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    gap: 6,
  },
  tabLabel: {
    fontSize: 14,
  },
  tabIndicator: {
    width: '60%',
    height: 3,
    borderRadius: 2,
  },
});
