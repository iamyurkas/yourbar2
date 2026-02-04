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
import { OnboardingAnchor } from '@/components/onboarding/OnboardingAnchor';

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
  anchorPrefix?: string;
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
  const Colors = useAppColors();

  const handleSubmit = (event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
    onSubmit?.(event.nativeEvent.text);
  };

  return (
    <View
      style={[
        styles.topBar,
        {
          backgroundColor: Colors.background,
          borderBottomColor: Colors.outline,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open navigation"
        onPress={onMenuPress}
        style={styles.iconButton}>
        <MaterialCommunityIcons name="menu" size={24} color={Colors.onSurface} />
      </Pressable>
      <View style={[styles.searchContainer, { backgroundColor: Colors.surface, borderColor: Colors.background }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={Colors.onSurface} style={styles.searchIcon} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={`${Colors.onSurfaceVariant}99`}
          returnKeyType="search"
          onSubmitEditing={handleSubmit}
          style={[styles.searchInput, { color: Colors.text, fontWeight: '400' }]}
        />
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search query"
            onPress={() => onChangeText('')}
            style={styles.clearButton}>
            <MaterialCommunityIcons name="close" size={18} color={Colors.onSurface} />
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
            ? { backgroundColor: `${Colors.tint}1A` }
            : null,
        ]}>
        <MaterialCommunityIcons
          name="filter-variant"
          size={24}
          color={filterActive ? Colors.tint : Colors.icon}
        />
      </Pressable>
    </View>
  );
}

export function SegmentTabs({ options, value, onChange, anchorPrefix }: SegmentTabsProps) {
  const Colors = useAppColors();

  return (
    <View style={[styles.tabs, { backgroundColor: Colors.surface }]}>
      {options.map((option) => {
        const focused = option.key === value;
        const content = (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={() => onChange(option.key)}
            style={styles.tabButton}>
            <Text
              style={[
                styles.tabLabel,
                {
                  color: focused ? Colors.tint : Colors.onSurfaceVariant,
                  fontWeight: focused ? '600' : '400',
                },
              ]}>
              {option.label}
            </Text>
            <View
              style={[
                styles.tabIndicator,
                {
                  backgroundColor: focused ? Colors.tint : 'transparent',
                },
              ]}
            />
          </Pressable>
        );

        if (anchorPrefix) {
          return (
            <OnboardingAnchor
              key={option.key}
              name={`${anchorPrefix}-${option.key}`}
              style={styles.tabAnchor}>
              {content}
            </OnboardingAnchor>
          );
        }

        return <React.Fragment key={option.key}>{content}</React.Fragment>;
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
  tabAnchor: {
    flex: 1,
  },
});
