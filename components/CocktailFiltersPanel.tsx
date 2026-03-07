import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TagPill } from '@/components/TagPill';
import type { CocktailMethod } from '@/constants/cocktail-methods';
import type { TagOption } from '@/libs/tag-options';

type CocktailFilterMethodOption = {
  id: CocktailMethod['id'];
};

type CocktailFiltersPanelProps = {
  sortSectionLabel?: string;
  sortOptions?: {
    key: string;
    label: string;
    icon?: React.ReactNode;
    selected: boolean;
    onPress: () => void;
    accessibilityLabel?: string;
  }[];
  availableStarRatings: number[];
  selectedStarRatings: Set<number>;
  onToggleStarRating: (rating: number) => void;
  showRatingFilters: boolean;
  availableMethodOptions: CocktailFilterMethodOption[];
  selectedMethodIds: Set<CocktailMethod['id']>;
  onToggleMethod: (methodId: CocktailMethod['id']) => void;
  renderMethodIcon: (methodId: CocktailMethod['id'], selected: boolean) => React.ReactNode;
  availableTagOptions: TagOption[];
  selectedTagKeys: Set<string>;
  onToggleTag: (key: string) => void;
  onClearFilters: () => void;
  showClearButton: boolean;
  tintColor: string;
  outlineColor: string;
  onSurfaceVariantColor: string;
  surfaceVariantColor: string;
  andLabel: string;
  noTagsAvailableLabel: string;
  clearFiltersLabel: string;
  getTagLabel: (tag: TagOption) => string;
  getMethodLabel: (methodId: CocktailMethod['id']) => string;
};

export function CocktailFiltersPanel({
  sortSectionLabel,
  sortOptions,
  availableStarRatings,
  selectedStarRatings,
  onToggleStarRating,
  showRatingFilters,
  availableMethodOptions,
  selectedMethodIds,
  onToggleMethod,
  renderMethodIcon,
  availableTagOptions,
  selectedTagKeys,
  onToggleTag,
  onClearFilters,
  showClearButton,
  tintColor,
  outlineColor,
  onSurfaceVariantColor,
  surfaceVariantColor,
  andLabel,
  noTagsAvailableLabel,
  clearFiltersLabel,
  getTagLabel,
  getMethodLabel,
}: CocktailFiltersPanelProps) {
  const showMethodFilters = availableMethodOptions.length > 0;
  const showSortOptions = Boolean(sortSectionLabel && sortOptions && sortOptions.length > 0);

  return (
    <ScrollView
      style={styles.filterMenuScroll}
      showsVerticalScrollIndicator
      keyboardShouldPersistTaps="handled">
      <View style={styles.filterMenuBody}>
        {showSortOptions ? (
          <View style={styles.filterSortSection}>
            <Text style={[styles.filterSortLabel, { color: onSurfaceVariantColor }]}>
              {sortSectionLabel}
            </Text>
            <ScrollView
              horizontal
              style={styles.filterSortScroll}
              contentContainerStyle={styles.filterSortRow}
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              {(sortOptions ?? []).map((option) => (
                <TagPill
                  key={option.key}
                  label={option.label}
                  color={tintColor}
                  selected={option.selected}
                  icon={option.icon}
                  onPress={option.onPress}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: option.selected }}
                  accessibilityLabel={option.accessibilityLabel}
                  androidRippleColor={`${surfaceVariantColor}33`}
                  style={option.label ? undefined : styles.iconOnlyPill}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
        {showSortOptions ? (
          <View style={[styles.sortSectionDivider, { backgroundColor: outlineColor }]} />
        ) : null}
        {showRatingFilters ? (
          <>
            <ScrollView
              horizontal
              style={styles.filterRatingScroll}
              contentContainerStyle={styles.filterRatingRow}
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              {availableStarRatings.map((rating) => {
                const selected = selectedStarRatings.has(rating);
                return (
                  <TagPill
                    key={`rating-${rating}`}
                    label={`${rating}★`}
                    color={tintColor}
                    selected={selected}
                    onPress={() => onToggleStarRating(rating)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    androidRippleColor={`${surfaceVariantColor}33`}
                  />
                );
              })}
            </ScrollView>
            <View style={styles.filterSeparator}>
              <View style={[styles.filterSeparatorLine, { backgroundColor: outlineColor }]} />
              <Text style={[styles.filterSeparatorLabel, { color: onSurfaceVariantColor }]}>
                {andLabel}
              </Text>
              <View style={[styles.filterSeparatorLine, { backgroundColor: outlineColor }]} />
            </View>
          </>
        ) : null}
        <View style={styles.filterMenuContent}>
          {showMethodFilters ? (
            <>
              <View style={styles.filterMethodList}>
                {availableMethodOptions.map((method) => {
                  const selected = selectedMethodIds.has(method.id);
                  return (
                    <TagPill
                      key={method.id}
                      label={getMethodLabel(method.id)}
                      color={tintColor}
                      selected={selected}
                      icon={renderMethodIcon(method.id, selected)}
                      onPress={() => onToggleMethod(method.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      androidRippleColor={`${surfaceVariantColor}33`}
                    />
                  );
                })}
              </View>
              <View style={styles.filterSeparator}>
                <View style={[styles.filterSeparatorLine, { backgroundColor: outlineColor }]} />
                <Text style={[styles.filterSeparatorLabel, { color: onSurfaceVariantColor }]}>{andLabel}</Text>
                <View style={[styles.filterSeparatorLine, { backgroundColor: outlineColor }]} />
              </View>
            </>
          ) : null}
          <View style={styles.filterTagList}>
            {availableTagOptions.length > 0 ? (
              availableTagOptions.map((tag) => {
                const selected = selectedTagKeys.has(tag.key);
                return (
                  <TagPill
                    key={tag.key}
                    label={getTagLabel(tag)}
                    color={tag.color}
                    selected={selected}
                    onPress={() => onToggleTag(tag.key)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    androidRippleColor={`${surfaceVariantColor}33`}
                  />
                );
              })
            ) : (
              <Text style={[styles.filterMenuEmpty, { color: onSurfaceVariantColor }]}>
                {noTagsAvailableLabel}
              </Text>
            )}
          </View>
        </View>
      </View>
      {showClearButton ? (
        <Pressable
          accessibilityRole="button"
          onPress={onClearFilters}
          style={styles.filterMenuClearButton}>
          <Text style={[styles.filterMenuClearLabel, { color: tintColor }]}>{clearFiltersLabel}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  filterMenuScroll: {
    maxHeight: 540,
    paddingBottom: 2,
  },
  filterMenuBody: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  filterSortSection: {
    marginBottom: 12,
    gap: 8,
  },
  filterSortLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  filterSortScroll: {
    alignSelf: 'stretch',
  },
  filterSortRow: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  iconOnlyPill: {
    minWidth: 53,
    minHeight: 36,
    paddingHorizontal: 10,
  },
  sortSectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  filterRatingScroll: {
    alignSelf: 'stretch',
  },
  filterRatingRow: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  filterMenuContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    minWidth: '100%',
  },
  filterMethodList: {
    flex: 1,
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-start',
  },
  filterTagList: {
    flex: 1,
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-end',
  },
  filterSeparator: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  filterSeparatorLine: {
    width: StyleSheet.hairlineWidth,
    flex: 1,
  },
  filterSeparatorLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingVertical: 4,
  },
  filterMenuEmpty: {
    fontSize: 14,
    textAlign: 'left',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  filterMenuClearButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterMenuClearLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
