import React from 'react';
import { StyleSheet, View, type LayoutRectangle, type StyleProp, type ViewStyle } from 'react-native';

import { SearchTopBar, SegmentTabs, type SegmentTabOption } from '@/components/TopBars';

type CollectionHeaderProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  onSearchSubmit?: (value: string) => void;
  onMenuPress?: () => void;
  onFilterPress?: () => void;
  filterActive?: boolean;
  filterExpanded?: boolean;
  onFilterLayout?: (layout: LayoutRectangle) => void;
  tabs?: SegmentTabOption[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  anchorIdPrefix?: string;
  style?: StyleProp<ViewStyle>;
};

export function CollectionHeader({
  searchValue,
  onSearchChange,
  placeholder,
  onSearchSubmit,
  onMenuPress,
  onFilterPress,
  filterActive,
  filterExpanded,
  onFilterLayout,
  tabs,
  activeTab,
  onTabChange,
  anchorIdPrefix,
  style,
}: CollectionHeaderProps) {
  const shouldShowTabs = Boolean(tabs?.length && activeTab !== undefined && onTabChange);

  return (
    <View style={[styles.container, style]}>
      <SearchTopBar
        value={searchValue}
        onChangeText={onSearchChange}
        placeholder={placeholder}
        onSubmit={onSearchSubmit}
        onMenuPress={onMenuPress}
        onFilterPress={onFilterPress}
        filterActive={filterActive}
        filterExpanded={filterExpanded}
        onFilterLayout={onFilterLayout}
      />
      {shouldShowTabs && tabs ? (
        <SegmentTabs
          options={tabs}
          value={activeTab!}
          onChange={onTabChange!}
          anchorIdPrefix={anchorIdPrefix}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 0,
  },
});

