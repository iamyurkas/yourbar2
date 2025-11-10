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

import { Colors } from '@/constants/theme';
import { palette as appPalette } from '@/theme/theme';

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
  const colors = Colors;
  const rippleColor = `${appPalette.tertiary}59`;

  const handleSubmit = (event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
    onSubmit?.(event.nativeEvent.text);
  };

  return (
    <View
      style={[
        styles.topBar,
        { backgroundColor: colors.background, borderBottomColor: `${colors.outline}33` },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open navigation"
        onPress={onMenuPress}
        android_ripple={{ color: rippleColor, foreground: true }}
        style={({ pressed }: PressableStateCallbackType) => [
          styles.iconButton,
          pressed && styles.iconButtonPressed,
        ]}>
        <MaterialCommunityIcons name="menu" size={24} color={colors.onSurface} />
      </Pressable>
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: colors.surface,
            borderColor: `${colors.outline}88`,
          },
        ]}>
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color={colors.onSurfaceVariant}
          style={styles.searchIcon}
        />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={`${appPalette.placeholder}AA`}
          returnKeyType="search"
          onSubmitEditing={handleSubmit}
          style={[styles.searchInput, { color: colors.text, fontWeight: '500' }]}
        />
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search query"
            onPress={() => onChangeText('')}
            android_ripple={{ color: rippleColor, foreground: true }}
            style={({ pressed }: PressableStateCallbackType) => [
              styles.clearButton,
              pressed && styles.iconButtonPressed,
            ]}>
            <MaterialCommunityIcons name="close" size={18} color={colors.onSurfaceVariant} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Filter items"
        onPress={onFilterPress}
        android_ripple={{ color: rippleColor, foreground: true }}
        style={({ pressed }: PressableStateCallbackType) => [
          styles.iconButton,
          pressed && styles.iconButtonPressed,
        ]}>
        <MaterialCommunityIcons name="tune" size={22} color={colors.tint} />
      </Pressable>
    </View>
  );
}

export function SegmentTabs({ options, value, onChange }: SegmentTabsProps) {
  const colors = Colors;
  const rippleColor = `${appPalette.tertiary}59`;

  return (
    <View
      style={[
        styles.tabs,
        {
          backgroundColor: colors.surface,
          borderBottomColor: `${colors.outline}55`,
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
            android_ripple={{ color: rippleColor, foreground: true }}
            style={({ pressed }: PressableStateCallbackType) => [
              styles.tabButton,
              pressed && styles.tabPressed,
            ]}>
            <Text
              style={[
                styles.tabLabel,
                {
                  color: focused ? colors.tint : colors.onSurfaceVariant,
                  fontWeight: focused ? '600' : '500',
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
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    gap: 8,
  },
  tabPressed: {
    opacity: 0.78,
  },
  tabLabel: {
    fontSize: 15,
  },
  tabIndicator: {
    width: '60%',
    height: 3,
    borderRadius: 2,
  },
});
