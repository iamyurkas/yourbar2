import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { SearchTopBar, SegmentTabs, type SegmentTabOption } from '@/components/TopBars';
import { Colors } from '@/constants/theme';
import { spacing } from '@/theme/design-tokens';

type CollectionHeaderProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  onSearchSubmit?: (value: string) => void;
  onMenuPress?: () => void;
  onFilterPress?: () => void;
  tabs?: SegmentTabOption[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  style?: StyleProp<ViewStyle>;
};

export function CollectionHeader({
  searchValue,
  onSearchChange,
  placeholder,
  onSearchSubmit,
  onMenuPress,
  onFilterPress,
  tabs,
  activeTab,
  onTabChange,
  style,
}: CollectionHeaderProps) {
  const shouldShowTabs = Boolean(tabs?.length && activeTab !== undefined && onTabChange);
  const palette = Colors;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.surfaceBright,
          borderBottomColor: palette.outline,
          shadowColor: palette.shadow,
        },
        style,
      ]}>
      <SearchTopBar
        value={searchValue}
        onChangeText={onSearchChange}
        placeholder={placeholder}
        onSubmit={onSearchSubmit}
        onMenuPress={onMenuPress}
        onFilterPress={onFilterPress}
      />
      {shouldShowTabs && tabs ? (
        <SegmentTabs options={tabs} value={activeTab!} onChange={onTabChange!} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 12,
    elevation: 1,
  },
});

