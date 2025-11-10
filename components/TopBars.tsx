import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
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
    <View style={[styles.topBarWrapper, { backgroundColor: palette.surface }]}>
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: palette.surfaceBright,
            shadowColor: palette.shadow,
          },
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open navigation"
          onPress={onMenuPress}
          style={[styles.iconButton, { backgroundColor: palette.surfaceVariant }]}
          android_ripple={{ color: `${palette.onSurfaceDisabled}` }}>
          <MaterialCommunityIcons name="menu" size={22} color={palette.onSurface} />
        </Pressable>
        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: palette.surface,
              borderColor: palette.outlineVariant,
              shadowColor: palette.shadow,
            },
          ]}>
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={palette.onSurface}
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
              style={[styles.clearButton, { backgroundColor: palette.surfaceVariant }]}
            >
              <MaterialCommunityIcons name="close" size={18} color={palette.onSurface} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filter items"
          onPress={onFilterPress}
          style={[styles.iconButton, { backgroundColor: palette.surfaceVariant }]}
          android_ripple={{ color: `${palette.onSurfaceDisabled}` }}>
          <MaterialCommunityIcons name="filter-variant" size={22} color={palette.icon} />
        </Pressable>
      </View>
    </View>
  );
}

export function SegmentTabs({ options, value, onChange }: SegmentTabsProps) {
  const palette = Colors;

  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorWidth = useRef(new Animated.Value(0)).current;
  const hasMeasured = useRef(false);

  const handleLayout = useCallback(
    (key: string) =>
      (event: LayoutChangeEvent) => {
        const { x, width } = event.nativeEvent.layout;
        setLayouts((prev) => {
          const existing = prev[key];
          if (existing && existing.x === x && existing.width === width) {
            return prev;
          }
          return { ...prev, [key]: { x, width } };
        });
      },
    [],
  );

  useEffect(() => {
    const layout = layouts[value];
    if (!layout) {
      return;
    }

    if (!hasMeasured.current) {
      indicatorX.setValue(layout.x);
      indicatorWidth.setValue(layout.width);
      hasMeasured.current = true;
      return;
    }

    Animated.spring(indicatorX, {
      toValue: layout.x,
      useNativeDriver: true,
      friction: 18,
      tension: 180,
    }).start();

    Animated.timing(indicatorWidth, {
      toValue: layout.width,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [indicatorWidth, indicatorX, layouts, value]);

  const activeLayout = layouts[value];

  return (
    <View style={[styles.tabsWrapper, { backgroundColor: palette.surface }]}>
      <View
        style={[
          styles.tabs,
          {
            backgroundColor: palette.surfaceVariant,
            borderColor: palette.outlineVariant,
          },
        ]}>
        {activeLayout ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.tabIndicator,
              {
                backgroundColor: palette.surfaceBright,
                shadowColor: palette.shadow,
                transform: [{ translateX: indicatorX }],
                width: indicatorWidth,
              },
            ]}
          />
        ) : null}
        {options.map((option) => {
          const focused = option.key === value;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="tab"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={() => onChange(option.key)}
              onLayout={handleLayout(option.key)}
              style={styles.tabButton}>
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
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBarWrapper: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 6,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 16,
    minHeight: 48,
    elevation: 3,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  tabs: {
    flexDirection: 'row',
    position: 'relative',
    borderRadius: 999,
    padding: 4,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999,
    zIndex: 1,
  },
  tabLabel: {
    fontSize: 15,
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 999,
    elevation: 2,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
});
