import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type PressableStateCallbackType,
  type TextInputSubmitEditingEventData,
} from 'react-native';

import { Colors, Fonts, Radii, Shadows, Spacing } from '@/constants/theme';

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

  const renderIconButtonStyle = ({ pressed }: PressableStateCallbackType) => [
    styles.iconButton,
    {
      backgroundColor: palette.surface,
      borderColor: `${palette.outline}CC`,
      opacity: pressed ? 0.85 : 1,
    },
  ];

  const renderClearButtonStyle = ({ pressed }: PressableStateCallbackType) => [
    styles.clearButton,
    {
      backgroundColor: palette.surface,
      borderColor: `${palette.outline}80`,
      opacity: pressed ? 0.85 : 1,
    },
  ];

  return (
    <View
      style={[
        styles.topBar,
        {
          backgroundColor: palette.surfaceBright,
          borderBottomColor: `${palette.outline}80`,
        },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open navigation"
        onPress={onMenuPress}
        style={renderIconButtonStyle}
        android_ripple={{ color: `${palette.tint}26`, borderless: false }}>
        <MaterialCommunityIcons name="menu" size={22} color={palette.onSurface} />
      </Pressable>
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: palette.surface,
            borderColor: `${palette.outline}80`,
            shadowColor: palette.shadow,
          },
        ]}>
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color={palette.onSurfaceMuted}
          style={styles.searchIcon}
        />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={`${palette.onSurfaceVariant}AA`}
          returnKeyType="search"
          onSubmitEditing={handleSubmit}
          style={[styles.searchInput, { color: palette.text, fontFamily: Fonts?.sans }]}
        />
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search query"
            onPress={() => onChangeText('')}
            style={renderClearButtonStyle}
            android_ripple={{ color: `${palette.tint}14`, borderless: false }}>
            <MaterialCommunityIcons name="close" size={18} color={palette.onSurface} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Filter items"
        onPress={onFilterPress}
        style={renderIconButtonStyle}
        android_ripple={{ color: `${palette.tint}26`, borderless: false }}>
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
          backgroundColor: palette.surface,
          borderColor: `${palette.outline}80`,
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
            style={({ pressed }) => [
              styles.tabButton,
              {
                backgroundColor: focused ? `${palette.tint}1F` : palette.surface,
                borderColor: focused ? palette.tint : 'transparent',
                opacity: pressed ? 0.9 : 1,
              },
            ]}>
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
    gap: Spacing.md,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
    ...Shadows.level1,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 6,
    ...Shadows.level1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    minHeight: 24,
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
    marginTop: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  tabLabel: {
    fontSize: 15,
    fontFamily: Fonts?.sans,
  },
  tabIndicator: {
    width: '50%',
    height: 3,
    borderRadius: Radii.xs,
  },
});
