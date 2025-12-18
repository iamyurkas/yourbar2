import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type LayoutRectangle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CocktailListRow } from '@/components/CocktailListRow';
import { CollectionHeader } from '@/components/CollectionHeader';
import { FabAdd } from '@/components/FabAdd';
import { SideMenuDrawer } from '@/components/SideMenuDrawer';
import { TagPill } from '@/components/TagPill';
import type { SegmentTabOption } from '@/components/TopBars';
import { BUILTIN_COCKTAIL_TAGS } from '@/constants/cocktail-tags';
import { Colors } from '@/constants/theme';
import { isCocktailReady } from '@/libs/cocktail-availability';
import { createIngredientLookup, isRecipeIngredientAvailable } from '@/libs/ingredient-availability';
import { useInventory, type Cocktail } from '@/providers/inventory-provider';
import { palette } from '@/theme/theme';

type CocktailSection = {
  key: string;
  label: string;
  data: Cocktail[];
};

type CocktailTabKey = 'all' | 'my' | 'favorites';

type CocktailTagOption = {
  key: string;
  name: string;
  color: string;
};

const TAB_OPTIONS: SegmentTabOption[] = [
  { key: 'all', label: 'All' },
  { key: 'my', label: 'My' },
  { key: 'favorites', label: 'Favorites' },
];

export default function CocktailsScreen() {
  const { cocktails, availableIngredientIds, ingredients, ignoreGarnish, allowAllSubstitutes } =
    useInventory();
  const [activeTab, setActiveTab] = useState<CocktailTabKey>('all');
  const [query, setQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFilterMenuVisible, setFilterMenuVisible] = useState(false);
  const [selectedTagKeys, setSelectedTagKeys] = useState<Set<string>>(() => new Set());
  const [headerLayout, setHeaderLayout] = useState<LayoutRectangle | null>(null);
  const [filterAnchorLayout, setFilterAnchorLayout] = useState<LayoutRectangle | null>(null);
  const paletteColors = Colors;
  const router = useRouter();
  const ingredientLookup = useMemo(() => createIngredientLookup(ingredients), [ingredients]);
  const defaultTagColor = palette.tagYellow ?? palette.highlightFaint;

  const availableTagOptions = useMemo<CocktailTagOption[]>(() => {
    const map = new Map<string, CocktailTagOption>();
    const builtinTagOrder = new Map<string, number>();

    BUILTIN_COCKTAIL_TAGS.forEach((tag, index) => {
      builtinTagOrder.set(String(tag.id), index);
      if (tag.name) {
        builtinTagOrder.set(tag.name.trim().toLowerCase(), index);
      }
    });

    cocktails.forEach((cocktail) => {
      (cocktail.tags ?? []).forEach((tag) => {
        if (!tag) {
          return;
        }

        const key = tag.id != null ? String(tag.id) : tag.name?.toLowerCase();
        if (!key) {
          return;
        }

        if (!map.has(key)) {
          map.set(key, {
            key,
            name: tag.name ?? 'Unnamed tag',
            color: tag.color ?? defaultTagColor,
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      const normalizedNameA = a.name.trim().toLowerCase();
      const normalizedNameB = b.name.trim().toLowerCase();
      const orderA = builtinTagOrder.get(a.key) ?? builtinTagOrder.get(normalizedNameA);
      const orderB = builtinTagOrder.get(b.key) ?? builtinTagOrder.get(normalizedNameB);

      if (orderA != null || orderB != null) {
        if (orderA == null) {
          return 1;
        }

        if (orderB == null) {
          return -1;
        }

        if (orderA !== orderB) {
          return orderA - orderB;
        }
      }

      return normalizedNameA.localeCompare(normalizedNameB);
    });
  }, [cocktails, defaultTagColor]);

  useEffect(() => {
    setSelectedTagKeys((previous) => {
      if (previous.size === 0) {
        return previous;
      }

      const validKeys = new Set(availableTagOptions.map((tag) => tag.key));
      let didChange = false;
      const next = new Set<string>();

      previous.forEach((key) => {
        if (validKeys.has(key)) {
          next.add(key);
        } else {
          didChange = true;
        }
      });

      if (!didChange && next.size === previous.size) {
        return previous;
      }

      return next;
    });
  }, [availableTagOptions]);

  const handleHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const nextLayout = event.nativeEvent.layout;
    setHeaderLayout((previous) => {
      if (
        previous &&
        Math.abs(previous.x - nextLayout.x) < 0.5 &&
        Math.abs(previous.y - nextLayout.y) < 0.5 &&
        Math.abs(previous.width - nextLayout.width) < 0.5 &&
        Math.abs(previous.height - nextLayout.height) < 0.5
      ) {
        return previous;
      }

      return nextLayout;
    });
  }, []);

  const handleFilterLayout = useCallback((layout: LayoutRectangle) => {
    setFilterAnchorLayout((previous) => {
      if (
        previous &&
        Math.abs(previous.x - layout.x) < 0.5 &&
        Math.abs(previous.y - layout.y) < 0.5 &&
        Math.abs(previous.width - layout.width) < 0.5 &&
        Math.abs(previous.height - layout.height) < 0.5
      ) {
        return previous;
      }

      return layout;
    });
  }, []);

  const handleFilterPress = useCallback(() => {
    setFilterMenuVisible((previous) => !previous);
  }, []);

  const handleCloseFilterMenu = useCallback(() => {
    setFilterMenuVisible(false);
  }, []);

  const handleTagFilterToggle = useCallback((key: string) => {
    setSelectedTagKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleClearTagFilters = useCallback(() => {
    setSelectedTagKeys((previous) => {
      if (previous.size === 0) {
        return previous;
      }

      return new Set<string>();
    });
  }, []);

  const readyToMix = useMemo(() => {
    return cocktails.filter((cocktail) => {
      const recipe = cocktail.ingredients ?? [];
      if (recipe.length === 0) {
        return false;
      }
      return recipe.every((item) =>
        isRecipeIngredientAvailable(item, availableIngredientIds, ingredientLookup, {
          ignoreGarnish,
          allowAllSubstitutes,
        }),
      );
    });
  }, [cocktails, availableIngredientIds, allowAllSubstitutes, ignoreGarnish, ingredientLookup]);

  const ratedCocktails = useMemo(() => {
    return cocktails.filter((cocktail) => {
      const ratingValue = Number((cocktail as { userRating?: number }).userRating ?? 0);
      return ratingValue > 0;
    });
  }, [cocktails]);

  const sections = useMemo<Record<CocktailTabKey, CocktailSection>>(() => {
    return {
      all: { key: 'all', label: 'All', data: cocktails },
      my: { key: 'my', label: 'My', data: readyToMix },
      favorites: {
        key: 'favorites',
        label: 'Favorites',
        data: ratedCocktails,
      },
    };
  }, [cocktails, readyToMix, ratedCocktails]);

  const activeSection = sections[activeTab] ?? sections.all;

  const normalizedQuery = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const tokens = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    return { text: trimmed, tokens };
  }, [query]);

  const filteredByTags = useMemo(() => {
    const base = activeSection.data;
    if (selectedTagKeys.size === 0) {
      return base;
    }

    return base.filter((cocktail) => {
      const tags = cocktail.tags ?? [];
      if (tags.length === 0) {
        return false;
      }

      return tags.some((tag) => {
        if (!tag) {
          return false;
        }

        const key = tag.id != null ? String(tag.id) : tag.name?.toLowerCase();
        if (!key) {
          return false;
        }

        return selectedTagKeys.has(key);
      });
    });
  }, [activeSection.data, selectedTagKeys]);

  const filteredCocktails = useMemo(() => {
    const base = filteredByTags;
    if (!normalizedQuery.text) {
      return base;
    }

    const { text, tokens } = normalizedQuery;
    if (tokens.length <= 1) {
      const token = tokens[0] ?? text;
      return base.filter((cocktail) => cocktail.searchNameNormalized.includes(token));
    }

    return base.filter((cocktail) =>
      tokens.every(
        (token) =>
          cocktail.searchTokensNormalized.includes(token) ||
          cocktail.searchNameNormalized.includes(token),
      ),
    );
  }, [filteredByTags, normalizedQuery]);

  const keyExtractor = useCallback((item: Cocktail) => String(item.id ?? item.name), []);

  const handleSelectCocktail = useCallback(
    (cocktail: Cocktail) => {
      const candidateId = cocktail.id ?? cocktail.name;
      if (!candidateId) {
        return;
      }

      router.push({ pathname: '/cocktail/[cocktailId]', params: { cocktailId: String(candidateId) } });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: Cocktail }) => (
      <CocktailListRow
        cocktail={item}
        availableIngredientIds={availableIngredientIds}
        ingredientLookup={ingredientLookup}
        ignoreGarnish={ignoreGarnish}
        allowAllSubstitutes={allowAllSubstitutes}
        onPress={() => handleSelectCocktail(item)}
      />
    ),
    [
      availableIngredientIds,
      allowAllSubstitutes,
      handleSelectCocktail,
      ignoreGarnish,
      ingredientLookup,
    ],
  );

  const renderSeparator = useCallback(
    ({ leadingItem }: { leadingItem?: Cocktail | null }) => {
      const isReady = leadingItem
        ? isCocktailReady(leadingItem, availableIngredientIds, ingredientLookup, undefined, {
            ignoreGarnish,
            allowAllSubstitutes,
          })
        : false;
      const backgroundColor = isReady ? paletteColors.outline : paletteColors.outlineVariant;

      return <View style={[styles.divider, { backgroundColor }]} />;
    },
    [
      availableIngredientIds,
      allowAllSubstitutes,
      ignoreGarnish,
      ingredientLookup,
      paletteColors.outline,
      paletteColors.outlineVariant,
    ],
  );

  const isFilterActive = selectedTagKeys.size > 0;
  const filterMenuTop = useMemo(() => {
    if (headerLayout && filterAnchorLayout) {
      return headerLayout.y + filterAnchorLayout.y + filterAnchorLayout.height + 6;
    }

    if (headerLayout) {
      return headerLayout.y + headerLayout.height;
    }

    return 0;
  }, [filterAnchorLayout, headerLayout]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: paletteColors.background }]}
      edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.headerWrapper} onLayout={handleHeaderLayout}>
          <CollectionHeader
            searchValue={query}
            onSearchChange={setQuery}
            placeholder="Search"
            onMenuPress={() => setIsMenuOpen(true)}
            tabs={TAB_OPTIONS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onFilterPress={handleFilterPress}
            filterActive={isFilterActive}
            filterExpanded={isFilterMenuVisible}
            onFilterLayout={handleFilterLayout}
          />
        </View>
        {isFilterMenuVisible ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close tag filters"
              onPress={handleCloseFilterMenu}
              style={styles.filterMenuBackdrop}
            />
            <View
              style={[
                styles.filterMenu,
                {
                  top: filterMenuTop,
                  backgroundColor: paletteColors.surface,
                  borderColor: paletteColors.outline,
                  shadowColor: palette.shadow,
                },
              ]}>
              {availableTagOptions.length > 0 ? (
                <View style={styles.filterTagList}>
                  {availableTagOptions.map((tag) => {
                    const selected = selectedTagKeys.has(tag.key);
                    return (
                      <TagPill
                        key={tag.key}
                        label={tag.name}
                        color={tag.color}
                        selected={selected}
                        onPress={() => handleTagFilterToggle(tag.key)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        androidRippleColor={`${paletteColors.surfaceVariant}33`}
                      />
                    );
                  })}
                </View>
              ) : (
                <Text style={[styles.filterMenuEmpty, { color: paletteColors.onSurfaceVariant }]}>
                  No tags available
                </Text>
              )}
              {selectedTagKeys.size > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear selected tag filters"
                  onPress={handleClearTagFilters}
                  style={styles.filterMenuClearButton}>
                  <Text style={[styles.filterMenuClearLabel, { color: paletteColors.tint }]}>Clear filters</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}
        <FlatList
          data={filteredCocktails}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={renderSeparator}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={[styles.emptyLabel, { color: paletteColors.onSurfaceVariant }]}>No cocktails yet</Text>
          }
        />
      </View>
      <FabAdd
        label="Add cocktail"
        onPress={() =>
          router.push({ pathname: '/cocktail/create', params: { source: 'cocktails' } })
        }
      />
      <SideMenuDrawer visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    position: 'relative',
  },
  headerWrapper: {
    zIndex: 2,
  },
  listContent: {
    paddingTop: 0,
    paddingBottom: 80,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  emptyLabel: {
    textAlign: 'center',
    marginTop: 80,
    fontSize: 14,
  },
  filterMenuBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 3,
  },
  filterMenu: {
    position: 'absolute',
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-end',
    zIndex: 4,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  filterTagList: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-end',
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
