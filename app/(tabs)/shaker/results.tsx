import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type LayoutRectangle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CocktailListRow } from '@/components/CocktailListRow';
import { CollectionHeader } from '@/components/CollectionHeader';
import { SideMenuDrawer } from '@/components/SideMenuDrawer';
import { TagPill } from '@/components/TagPill';
import { getCocktailMethods, METHOD_ICON_MAP, type CocktailMethod } from '@/constants/cocktail-methods';
import { BUILTIN_COCKTAIL_TAGS } from '@/constants/cocktail-tags';
import { Colors } from '@/constants/theme';
import { isCocktailReady } from '@/libs/cocktail-availability';
import { createIngredientLookup } from '@/libs/ingredient-availability';
import { normalizeSearchText } from '@/libs/search-normalization';
import { useInventory, type Cocktail } from '@/providers/inventory-provider';

function parseListParam(param?: string | string[]) {
  if (!param) {
    return [] as string[];
  }

  if (Array.isArray(param)) {
    return param.flatMap((value) => parseListParam(value));
  }

  try {
    const parsed = JSON.parse(param);
    if (Array.isArray(parsed)) {
      return parsed.map((value) => String(value));
    }
  } catch {
    return [param];
  }

  return [param];
}

function resolveCocktailByKey(key: string, cocktails: Cocktail[]) {
  const numericId = Number(key);
  if (!Number.isNaN(numericId)) {
    const byId = cocktails.find((item) => Number(item.id ?? -1) === numericId);
    if (byId) {
      return byId;
    }
  }

  const normalized = normalizeSearchText(key);
  return cocktails.find((item) => normalizeSearchText(item.name ?? '') === normalized);
}

const METHOD_ICON_SIZE = 16;

export default function ShakerResultsScreen() {
  const router = useRouter();
  const {
    cocktails,
    availableIngredientIds,
    ingredients,
    ignoreGarnish,
    allowAllSubstitutes,
  } = useInventory();
  const params = useLocalSearchParams();
  const [query, setQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFilterMenuVisible, setFilterMenuVisible] = useState(false);
  const [selectedTagKeys, setSelectedTagKeys] = useState<Set<string>>(() => new Set());
  const [selectedMethodIds, setSelectedMethodIds] = useState<Set<CocktailMethod['id']>>(
    () => new Set(),
  );
  const [headerLayout, setHeaderLayout] = useState<LayoutRectangle | null>(null);
  const [filterAnchorLayout, setFilterAnchorLayout] = useState<LayoutRectangle | null>(null);

  const availableIds = useMemo(() => parseListParam(params.available), [params.available]);
  const unavailableIds = useMemo(() => parseListParam(params.unavailable), [params.unavailable]);

  const availableCocktails = useMemo(() => {
    const items: Cocktail[] = [];
    const seen = new Set<string>();

    availableIds.forEach((id) => {
      const cocktail = resolveCocktailByKey(id, cocktails);
      if (!cocktail) {
        return;
      }

      const key = String(cocktail.id ?? cocktail.name ?? id);
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      items.push(cocktail);
    });

    return items;
  }, [availableIds, cocktails]);

  const unavailableCocktails = useMemo(() => {
    const items: Cocktail[] = [];
    const seen = new Set<string>();

    unavailableIds.forEach((id) => {
      const cocktail = resolveCocktailByKey(id, cocktails);
      if (!cocktail) {
        return;
      }

      const key = String(cocktail.id ?? cocktail.name ?? id);
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      items.push(cocktail);
    });

    return items;
  }, [cocktails, unavailableIds]);

  const listData = useMemo(
    () => [...availableCocktails, ...unavailableCocktails],
    [availableCocktails, unavailableCocktails],
  );

  const ingredientLookup = useMemo(() => createIngredientLookup(ingredients), [ingredients]);
  const defaultTagColor = Colors.tint;

  const availableTagOptions = useMemo(() => {
    const map = new Map<string, { key: string; name: string; color: string }>();
    const builtinTagOrder = new Map<string, number>();

    BUILTIN_COCKTAIL_TAGS.forEach((tag, index) => {
      builtinTagOrder.set(String(tag.id), index);
      if (tag.name) {
        builtinTagOrder.set(tag.name.trim().toLowerCase(), index);
      }
    });

    listData.forEach((cocktail) => {
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
  }, [defaultTagColor, listData]);

  const availableMethodOptions = useMemo(() => {
    const methodOrder = getCocktailMethods();
    const methodMap = new Map(methodOrder.map((method) => [method.id, method]));
    const usedMethods = new Set<CocktailMethod['id']>();

    listData.forEach((cocktail) => {
      const legacyMethodId =
        (cocktail as { methodId?: CocktailMethod['id'] | null }).methodId ?? null;
      const methodIds = cocktail.methodIds?.length
        ? cocktail.methodIds
        : legacyMethodId
          ? [legacyMethodId]
          : [];
      methodIds.forEach((methodId) => {
        if (methodMap.has(methodId)) {
          usedMethods.add(methodId);
        }
      });
    });

    return methodOrder.filter((method) => usedMethods.has(method.id));
  }, [listData]);

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

  useEffect(() => {
    setSelectedMethodIds((previous) => {
      if (previous.size === 0) {
        return previous;
      }

      const validIds = new Set(availableMethodOptions.map((method) => method.id));
      let didChange = false;
      const next = new Set<CocktailMethod['id']>();

      previous.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          didChange = true;
        }
      });

      if (!didChange && next.size === previous.size) {
        return previous;
      }

      return next;
    });
  }, [availableMethodOptions]);

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

  const handleMethodFilterToggle = useCallback((methodId: CocktailMethod['id']) => {
    setSelectedMethodIds((previous) => {
      const next = new Set(previous);
      if (next.has(methodId)) {
        next.delete(methodId);
      } else {
        next.add(methodId);
      }
      return next;
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setSelectedTagKeys((previous) => (previous.size === 0 ? previous : new Set<string>()));
    setSelectedMethodIds((previous) => (previous.size === 0 ? previous : new Set<CocktailMethod['id']>()));
  }, []);

  const renderMethodIcon = useCallback(
    (methodId: CocktailMethod['id'], selected: boolean) => {
      const icon = METHOD_ICON_MAP[methodId];
      if (!icon) {
        return null;
      }

      const tintColor = selected ? Colors.surface : Colors.tint;
      if (icon.type === 'asset') {
        return (
          <Image
            source={icon.source}
            style={[styles.methodIcon, { tintColor }]}
            contentFit="contain"
          />
        );
      }

      return <MaterialCommunityIcons name={icon.name} size={METHOD_ICON_SIZE} color={tintColor} />;
    },
    [Colors.surface, Colors.tint],
  );

  const normalizedQuery = useMemo(() => {
    const normalized = normalizeSearchText(query);
    const tokens = normalized ? normalized.split(/\s+/).filter(Boolean) : [];
    return { text: normalized, tokens };
  }, [query]);

  const filteredByMethods = useMemo(() => {
    if (selectedMethodIds.size === 0) {
      return listData;
    }

    return listData.filter((cocktail) => {
      const legacyMethodId =
        (cocktail as { methodId?: CocktailMethod['id'] | null }).methodId ?? null;
      const methodIds = cocktail.methodIds?.length
        ? cocktail.methodIds
        : legacyMethodId
          ? [legacyMethodId]
          : [];
      if (methodIds.length === 0) {
        return false;
      }

      return methodIds.some((methodId) => selectedMethodIds.has(methodId));
    });
  }, [listData, selectedMethodIds]);

  const filteredByTags = useMemo(() => {
    const base = filteredByMethods;
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
  }, [filteredByMethods, selectedTagKeys]);

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

  const isFilterActive = selectedTagKeys.size > 0 || selectedMethodIds.size > 0;
  const filterMenuTop = useMemo(() => {
    if (headerLayout && filterAnchorLayout) {
      return headerLayout.y + filterAnchorLayout.y + filterAnchorLayout.height + 6;
    }

    if (headerLayout) {
      return headerLayout.y + headerLayout.height;
    }

    return 0;
  }, [filterAnchorLayout, headerLayout]);

  const handlePressCocktail = useCallback(
    (cocktail: Cocktail) => {
      const targetId = cocktail.id ?? cocktail.name;
      if (!targetId) {
        return;
      }

      const availableParam = Array.isArray(params.available)
        ? params.available[0]
        : params.available;
      const unavailableParam = Array.isArray(params.unavailable)
        ? params.unavailable[0]
        : params.unavailable;
      const returnToParams = JSON.stringify({
        available: availableParam ?? '',
        unavailable: unavailableParam ?? '',
      });

      router.push({
        pathname: '/cocktails/[cocktailId]',
        params: {
          cocktailId: String(targetId),
          returnToPath: '/shaker/results',
          returnToParams,
        },
      });
    },
    [params.available, params.unavailable, router],
  );

  const renderItem = useCallback(
    ({ item }: { item: Cocktail }) => (
      <CocktailListRow
        cocktail={item}
        availableIngredientIds={availableIngredientIds}
        ingredientLookup={ingredientLookup}
        ignoreGarnish={ignoreGarnish}
        allowAllSubstitutes={allowAllSubstitutes}
        showMethodIcons
        onPress={() => handlePressCocktail(item)}
      />
    ),
    [
      allowAllSubstitutes,
      availableIngredientIds,
      handlePressCocktail,
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
      const backgroundColor = isReady ? Colors.outline : Colors.outlineVariant;

      return <View style={[styles.divider, { backgroundColor }]} />;
    },
    [
      allowAllSubstitutes,
      availableIngredientIds,
      ignoreGarnish,
      ingredientLookup,
      Colors.outline,
      Colors.outlineVariant,
    ],
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View style={styles.container}>
        <View style={styles.headerWrapper} onLayout={handleHeaderLayout}>
          <CollectionHeader
            searchValue={query}
            onSearchChange={setQuery}
            placeholder="Search"
            onMenuPress={() => setIsMenuOpen(true)}
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
                  backgroundColor: Colors.surface,
                  borderColor: Colors.outline,
                  shadowColor: Colors.shadow,
                },
              ]}>
              <ScrollView style={styles.filterMenuScroll} showsVerticalScrollIndicator>
                <View style={styles.filterMenuContent}>
                  <View style={styles.filterMethodList}>
                    {availableMethodOptions.length > 0 ? (
                      availableMethodOptions.map((method) => {
                        const selected = selectedMethodIds.has(method.id);
                        return (
                          <TagPill
                            key={method.id}
                            label={method.label}
                            color={Colors.tint}
                            selected={selected}
                            icon={renderMethodIcon(method.id, selected)}
                            onPress={() => handleMethodFilterToggle(method.id)}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: selected }}
                            androidRippleColor={`${Colors.surfaceVariant}33`}
                          />
                        );
                      })
                    ) : (
                      <Text style={[styles.filterMenuEmpty, { color: Colors.onSurfaceVariant }]}>
                        No methods available
                      </Text>
                    )}
                  </View>
                  <View style={styles.filterSeparator}>
                    <View style={[styles.filterSeparatorLine, { backgroundColor: Colors.outline }]} />
                    <Text style={[styles.filterSeparatorLabel, { color: Colors.onSurfaceVariant }]}>
                      AND
                    </Text>
                    <View style={[styles.filterSeparatorLine, { backgroundColor: Colors.outline }]} />
                  </View>
                  <View style={styles.filterTagList}>
                    {availableTagOptions.length > 0 ? (
                      availableTagOptions.map((tag) => {
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
                            androidRippleColor={`${Colors.surfaceVariant}33`}
                          />
                        );
                      })
                    ) : (
                      <Text style={[styles.filterMenuEmpty, { color: Colors.onSurfaceVariant }]}>
                        No tags available
                      </Text>
                    )}
                  </View>
                </View>
                {selectedTagKeys.size > 0 || selectedMethodIds.size > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear selected filters"
                    onPress={handleClearFilters}
                    style={styles.filterMenuClearButton}>
                    <Text style={[styles.filterMenuClearLabel, { color: Colors.tint }]}>
                      Clear filters
                    </Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>
          </>
        ) : null}
        <FlatList
          data={filteredCocktails}
          keyExtractor={(item) => String(item.id ?? item.name)}
          renderItem={renderItem}
          ItemSeparatorComponent={renderSeparator}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.emptyLabel, { color: Colors.onSurfaceVariant }]}>
              No matching recipes
            </Text>
          }
          showsVerticalScrollIndicator={false}
        />
      </View>
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
    paddingBottom: 80,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
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
    alignItems: 'stretch',
    zIndex: 4,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  filterMenuScroll: {
    maxHeight: 540,
    paddingBottom: 2,
  },
  filterMenuContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  filterMethodList: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-start',
  },
  methodIcon: {
    width: METHOD_ICON_SIZE,
    height: METHOD_ICON_SIZE,
  },
  filterTagList: {
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
  emptyLabel: {
    textAlign: 'center',
    marginTop: 80,
    fontSize: 14,
  },
});
