import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type LayoutRectangle,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CocktailListRow } from '@/components/CocktailListRow';
import { CocktailFiltersPanel } from '@/components/CocktailFiltersPanel';
import { CollectionHeader } from '@/components/CollectionHeader';
import { SideMenuDrawer } from '@/components/SideMenuDrawer';
import { getCocktailMethods, METHOD_ICON_MAP, type CocktailMethod } from '@/constants/cocktail-methods';
import { BUILTIN_COCKTAIL_TAGS } from '@/constants/cocktail-tags';
import { useAppColors } from '@/constants/theme';
import { summariseCocktailAvailability } from '@/libs/cocktail-availability';
import { createIngredientLookup } from '@/libs/ingredient-availability';
import { navigateToDetailsWithReturnTo } from '@/libs/navigation';
import { normalizeSearchText } from '@/libs/search-normalization';
import { compareOptionalGlobalAlphabet } from '@/libs/global-sort';
import { useI18n } from '@/libs/i18n/use-i18n';
import { buildTagOptions } from '@/libs/tag-options';
import { buildCocktailSortOptions, type CocktailSortOption } from '@/libs/cocktail-sort-options';
import { useInventory, type Cocktail } from '@/providers/inventory-provider';

function parseListParam(param?: string | string[]): string[] {
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
const LIST_ROW_HEIGHT = 76;
const LIST_SEPARATOR_HEIGHT = StyleSheet.hairlineWidth;
const LIST_ITEM_LAYOUT_HEIGHT = LIST_ROW_HEIGHT + LIST_SEPARATOR_HEIGHT;

function countRequiredIngredients(cocktail: Cocktail, ignoreGarnish: boolean): number {
  return (cocktail.ingredients ?? []).filter(
    (ingredient) => !ingredient?.optional && !(ignoreGarnish && ingredient?.garnish),
  ).length;
}

export default function ShakerResultsScreen() {
  const {
    cocktails,
    availableIngredientIds,
    ingredients,
    ignoreGarnish,
    allowAllSubstitutes,
    getCocktailRating,
    getCocktailComment,
  } = useInventory();
  const Colors = useAppColors();
  const { t } = useI18n();
  const params = useLocalSearchParams();
  const [query, setQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFilterMenuVisible, setFilterMenuVisible] = useState(false);
  const [selectedTagKeys, setSelectedTagKeys] = useState<Set<string>>(() => new Set());
  const [selectedMethodIds, setSelectedMethodIds] = useState<Set<CocktailMethod['id']>>(
    () => new Set(),
  );
  const [selectedStarRatings, setSelectedStarRatings] = useState<Set<number>>(() => new Set());
  const [selectedSortOption, setSelectedSortOption] = useState<CocktailSortOption>('alphabetical');
  const [isSortDescending, setSortDescending] = useState(false);
  const [headerLayout, setHeaderLayout] = useState<LayoutRectangle | null>(null);
  const [filterAnchorLayout, setFilterAnchorLayout] = useState<LayoutRectangle | null>(null);
  const listRef = useRef<FlatList<Cocktail>>(null);
  const lastScrollOffset = useRef(0);
  const searchStartOffset = useRef<number | null>(null);
  const previousQuery = useRef(query);

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

    return items.sort((a, b) => compareOptionalGlobalAlphabet(a.name, b.name));
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

    return items.sort((a, b) => compareOptionalGlobalAlphabet(a.name, b.name));
  }, [cocktails, unavailableIds]);

  const listData = useMemo(
    () => [...availableCocktails, ...unavailableCocktails],
    [availableCocktails, unavailableCocktails],
  );

  useEffect(() => {
    const wasEmpty = previousQuery.current.length === 0;
    const isEmpty = query.length === 0;

    if (wasEmpty && !isEmpty) {
      searchStartOffset.current = lastScrollOffset.current;
    } else if (!wasEmpty && isEmpty && searchStartOffset.current !== null) {
      const restoreOffset = searchStartOffset.current;
      searchStartOffset.current = null;
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: restoreOffset, animated: false });
      });
    }

    previousQuery.current = query;
  }, [query]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    lastScrollOffset.current = event.nativeEvent.contentOffset.y;
  }, []);

  const ingredientLookup = useMemo(() => createIngredientLookup(ingredients), [ingredients]);
  const defaultTagColor = Colors.tint;

  const availableTagOptions = useMemo(
    () => buildTagOptions(listData, (cocktail) => cocktail.tags ?? [], BUILTIN_COCKTAIL_TAGS, defaultTagColor),
    [defaultTagColor, listData],
  );

  const availableMethodOptions = useMemo(() => {
    const methodOrder = getCocktailMethods();
    const methodMap = new Map(methodOrder.map((method) => [method.id, method]));
    const usedMethods = new Set<CocktailMethod['id']>();

    listData.forEach((cocktail) => {
      const legacyMethodId =
        (cocktail as { methodId?: CocktailMethod['id'] | null }).methodId ?? null;
      const methodIds = (cocktail.methodIds?.length
        ? cocktail.methodIds
        : legacyMethodId
          ? [legacyMethodId]
          : []) as CocktailMethod["id"][];
      methodIds.forEach((methodId) => {
        if (methodMap.has(methodId)) {
          usedMethods.add(methodId);
        }
      });
    });

    return methodOrder.filter((method) => usedMethods.has(method.id));
  }, [listData]);

  const availableStarRatings = useMemo<number[]>(() => {
    const ratings = new Set<number>();
    listData.forEach((cocktail) => {
      const rating = getCocktailRating(cocktail);
      if (rating > 0) {
        ratings.add(rating);
      }
    });

    return [...ratings].sort((a, b) => a - b);
  }, [getCocktailRating, listData]);

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
    setSelectedStarRatings((previous) => {
      if (previous.size === 0) {
        return previous;
      }

      const validRatings = new Set(availableStarRatings);
      let didChange = false;
      const next = new Set<number>();

      previous.forEach((rating) => {
        if (validRatings.has(rating)) {
          next.add(rating);
        } else {
          didChange = true;
        }
      });

      if (!didChange && next.size === previous.size) {
        return previous;
      }

      return next;
    });
  }, [availableStarRatings]);

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
    setSelectedStarRatings((previous) => (previous.size === 0 ? previous : new Set<number>()));
    setSelectedSortOption('alphabetical');
    setSortDescending(false);
  }, []);

  const handleSortOptionChange = useCallback((option: CocktailSortOption) => {
    setSelectedSortOption((previous) => {
      if (previous === option) {
        setSortDescending((current) => !current);
        return previous;
      }

      setSortDescending(false);
      return option;
    });
  }, []);

  const handleStarRatingFilterToggle = useCallback((rating: number) => {
    setSelectedStarRatings((previous) => {
      const next = new Set(previous);
      if (next.has(rating)) {
        next.delete(rating);
      } else {
        next.add(rating);
      }
      return next;
    });
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

      const isMuddle = methodId === 'muddle';
      return (
        <View style={styles.methodIconWrapper}>
          <MaterialCommunityIcons
            name={icon.name}
            size={METHOD_ICON_SIZE}
            color={tintColor}
            style={isMuddle ? styles.muddleIcon : undefined}
          />
        </View>
      );
    },
    [Colors],
  );

  const normalizedQuery = useMemo(() => {
    const normalized = normalizeSearchText(query);
    const tokens = normalized ? normalized.split(/\s+/).filter(Boolean) : [];
    return { text: normalized, tokens };
  }, [query]);

  const filteredByStarRatings = useMemo(() => {
    if (selectedStarRatings.size === 0) {
      return listData;
    }

    return listData.filter((cocktail) => selectedStarRatings.has(getCocktailRating(cocktail)));
  }, [getCocktailRating, listData, selectedStarRatings]);

  const filteredByMethods = useMemo(() => {
    if (selectedMethodIds.size === 0) {
      return filteredByStarRatings;
    }

    return filteredByStarRatings.filter((cocktail) => {
      const legacyMethodId =
        (cocktail as { methodId?: CocktailMethod['id'] | null }).methodId ?? null;
      const methodIds = (cocktail.methodIds?.length
        ? cocktail.methodIds
        : legacyMethodId
          ? [legacyMethodId]
          : []) as CocktailMethod["id"][];
      if (methodIds.length === 0) {
        return false;
      }

      return methodIds.some((methodId) => selectedMethodIds.has(methodId));
    });
  }, [filteredByStarRatings, selectedMethodIds]);

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

  const availabilitySummaryByKey = useMemo(() => {
    const summaryMap = new Map<string, ReturnType<typeof summariseCocktailAvailability>>();

    filteredCocktails.forEach((cocktail) => {
      const cocktailKey = String(cocktail.id ?? cocktail.name);
      summaryMap.set(
        cocktailKey,
        summariseCocktailAvailability(cocktail, availableIngredientIds, ingredientLookup, undefined, {
          ignoreGarnish,
          allowAllSubstitutes,
        }),
      );
    });

    return summaryMap;
  }, [
    allowAllSubstitutes,
    availableIngredientIds,
    filteredCocktails,
    ignoreGarnish,
    ingredientLookup,
  ]);

  const randomSortRanks = useMemo(() => {
    const rankMap = new Map<string, number>();

    filteredCocktails.forEach((cocktail) => {
      const key = String(cocktail.id ?? cocktail.name);
      rankMap.set(key, Math.random());
    });

    return rankMap;
  }, [filteredCocktails]);

  const availableCocktailKeys = useMemo(() => {
    return new Set(availableCocktails.map((cocktail) => String(cocktail.id ?? cocktail.name)));
  }, [availableCocktails]);

  const sortCocktailSubset = useCallback(
    (items: Cocktail[]) => {
      const base = [...items];
      base.sort((left, right) => {
        const leftName = left.name ?? '';
        const rightName = right.name ?? '';
        let result = 0;

        if (selectedSortOption === 'alphabetical') {
          result = compareOptionalGlobalAlphabet(leftName, rightName);
          return isSortDescending ? -result : result;
        }

        if (selectedSortOption === 'requiredCount') {
          const leftCount = countRequiredIngredients(left, ignoreGarnish);
          const rightCount = countRequiredIngredients(right, ignoreGarnish);
          if (leftCount !== rightCount) {
            result = leftCount - rightCount;
          } else {
            result = compareOptionalGlobalAlphabet(leftName, rightName);
          }
          return isSortDescending ? -result : result;
        }

        if (selectedSortOption === 'rating') {
          const leftRating = getCocktailRating(left);
          const rightRating = getCocktailRating(right);
          if (leftRating !== rightRating) {
            result = rightRating - leftRating;
          } else {
            result = compareOptionalGlobalAlphabet(leftName, rightName);
          }
          return isSortDescending ? -result : result;
        }

        if (selectedSortOption === 'recentlyAdded') {
          const leftId = Number(left.id ?? -1);
          const rightId = Number(right.id ?? -1);
          if (leftId !== rightId) {
            result = rightId - leftId;
          } else {
            result = compareOptionalGlobalAlphabet(leftName, rightName);
          }
          return isSortDescending ? -result : result;
        }

        const leftKey = String(left.id ?? left.name);
        const rightKey = String(right.id ?? right.name);
        const leftRank = randomSortRanks.get(leftKey) ?? 0;
        const rightRank = randomSortRanks.get(rightKey) ?? 0;
        if (leftRank !== rightRank) {
          result = leftRank - rightRank;
        } else {
          result = compareOptionalGlobalAlphabet(leftName, rightName);
        }

        return isSortDescending ? -result : result;
      });

      return base;
    },
    [getCocktailRating, ignoreGarnish, isSortDescending, randomSortRanks, selectedSortOption],
  );

  const sortedCocktails = useMemo(() => {
    const filteredAvailable: Cocktail[] = [];
    const filteredUnavailable: Cocktail[] = [];

    filteredCocktails.forEach((cocktail) => {
      const key = String(cocktail.id ?? cocktail.name);
      if (availableCocktailKeys.has(key)) {
        filteredAvailable.push(cocktail);
      } else {
        filteredUnavailable.push(cocktail);
      }
    });

    return [
      ...sortCocktailSubset(filteredAvailable),
      ...sortCocktailSubset(filteredUnavailable),
    ];
  }, [availableCocktailKeys, filteredCocktails, sortCocktailSubset]);

  const isFilterActive =
    selectedTagKeys.size > 0 ||
    selectedMethodIds.size > 0 ||
    selectedStarRatings.size > 0 ||
    selectedSortOption !== 'alphabetical' ||
    isSortDescending;
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
      navigateToDetailsWithReturnTo({
        pathname: '/cocktails/[cocktailId]',
        params: {
          cocktailId: String(targetId),
        },
        returnToPath: '/shaker/results',
        returnToParams: {
          available: availableParam ?? '',
          unavailable: unavailableParam ?? '',
        },
      });
    },
    [params.available, params.unavailable],
  );

  const getAvailabilitySummary = useCallback(
    (cocktail: Cocktail) => {
      const cocktailKey = String(cocktail.id ?? cocktail.name);
      const cachedSummary = availabilitySummaryByKey.get(cocktailKey);
      if (cachedSummary) {
        return cachedSummary;
      }

      return summariseCocktailAvailability(cocktail, availableIngredientIds, ingredientLookup, undefined, {
        ignoreGarnish,
        allowAllSubstitutes,
      });
    },
    [
      allowAllSubstitutes,
      availabilitySummaryByKey,
      availableIngredientIds,
      ignoreGarnish,
      ingredientLookup,
    ],
  );

  const renderItem = useCallback(
    ({ item }: { item: Cocktail }) => {
      const availability = getAvailabilitySummary(item);
      return (
        <CocktailListRow
          cocktail={item}
          ingredients={ingredients}
          showMethodIcons
          onPress={() => handlePressCocktail(item)}
          isReady={availability.isReady}
          missingCount={availability.missingCount}
          recipeNamesCount={availability.recipeNames.length}
          ingredientLine={availability.ingredientLine}
          ratingValue={getCocktailRating(item)}
          hasComment={Boolean(getCocktailComment(item).trim())}
          hasBrandFallback={availability.hasBrandFallback}
          hasStyleFallback={availability.hasStyleFallback}
        />
      );
    },
    [
      getAvailabilitySummary,
      getCocktailComment,
      getCocktailRating,
      handlePressCocktail,
      ingredients,
    ],
  );

  const renderSeparator = useCallback(
    ({ leadingItem }: { leadingItem?: Cocktail | null }) => {
      const cocktailKey = leadingItem ? String(leadingItem.id ?? leadingItem.name) : '';
      const isReady = cocktailKey ? availabilitySummaryByKey.get(cocktailKey)?.isReady ?? false : false;
      const backgroundColor = isReady ? Colors.outline : Colors.outlineVariant;

      return <View style={[styles.divider, { backgroundColor }]} />;
    },
    [Colors, availabilitySummaryByKey],
  );
  const keyExtractor = useCallback((item: Cocktail) => String(item.id ?? item.name), []);
  const getItemLayout = useCallback((_: ArrayLike<Cocktail> | null | undefined, index: number) => ({
    length: LIST_ITEM_LAYOUT_HEIGHT,
    offset: LIST_ITEM_LAYOUT_HEIGHT * index,
    index,
  }), []);

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
            placeholder={t("common.search")}
            onMenuPress={() => setIsMenuOpen(true)}
            onFilterPress={handleFilterPress}
            filterActive={isFilterActive}
            filterExpanded={isFilterMenuVisible}
            onFilterLayout={handleFilterLayout}
            helpTitle={t("shakerResults.helpTitle")}
            helpText={t("shakerResults.helpText")}
          />
        </View>
        {isFilterMenuVisible ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.closeTagFilters")}
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
              <CocktailFiltersPanel
                sortSectionLabel={t('shakerResults.sortBy')}
                filterSectionLabel={t('common.filterBy')}
                sortOptions={buildCocktailSortOptions({
                  selectedSortOption,
                  isSortDescending,
                  onSortOptionChange: handleSortOptionChange,
                  tintColor: Colors.tint,
                  surfaceColor: Colors.surface,
                  showRequiredCountOption: false,
                  getAccessibilityLabel: (option) => {
                    switch (option) {
                      case 'alphabetical':
                        return t('cocktails.sortOptionAlphabeticalAccessibility');
                      case 'rating':
                        return t('cocktails.sortOptionRatingAccessibility');
                      case 'recentlyAdded':
                        return t('cocktails.sortOptionRecentlyAddedAccessibility');
                      default:
                        return t('cocktails.sortOptionRandomAccessibility');
                    }
                  },
                })}
                availableStarRatings={availableStarRatings}
                selectedStarRatings={selectedStarRatings}
                onToggleStarRating={handleStarRatingFilterToggle}
                showRatingFilters={availableStarRatings.length > 0}
                availableMethodOptions={availableMethodOptions}
                selectedMethodIds={selectedMethodIds}
                onToggleMethod={handleMethodFilterToggle}
                renderMethodIcon={renderMethodIcon}
                availableTagOptions={availableTagOptions}
                selectedTagKeys={selectedTagKeys}
                onToggleTag={handleTagFilterToggle}
                onClearFilters={handleClearFilters}
                showClearButton={isFilterActive}
                tintColor={Colors.tint}
                outlineColor={Colors.primary}
                onSurfaceVariantColor={Colors.onSurfaceVariant}
                surfaceVariantColor={Colors.surfaceVariant}
                andLabel={t('common.and')}
                noTagsAvailableLabel={t('common.noTagsAvailable')}
                clearFiltersLabel={t('common.clearFilters')}
                getMethodLabel={(methodId) => t(`cocktailMethod.${methodId}.label`)}
                getTagLabel={(tag) => {
                  const isBuiltin = !isNaN(Number(tag.key)) && Number(tag.key) >= 1 && Number(tag.key) <= 11;
                  const translatedName = isBuiltin ? t(`cocktailTag.${tag.key}`) : tag.name;
                  return (isBuiltin && translatedName !== `cocktailTag.${tag.key}`) ? translatedName : tag.name;
                }}
              />
            </View>
          </>
        ) : null}
        <FlatList
          ref={listRef}
          data={sortedCocktails}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          renderItem={renderItem}
          ItemSeparatorComponent={renderSeparator}
          contentContainerStyle={styles.listContent}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          removeClippedSubviews
          ListEmptyComponent={
            <Text style={[styles.emptyLabel, { color: Colors.onSurfaceVariant }]}>
              {t("shakerResults.emptyMatchingRecipes")}
            </Text>
          }
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          // Keep list item taps active while the keyboard dismisses.
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
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
    minWidth: 280,
    maxWidth: '92%',
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
  methodIcon: {
    width: METHOD_ICON_SIZE,
    height: METHOD_ICON_SIZE,
  },
  methodIconWrapper: {
    width: METHOD_ICON_SIZE,
    height: METHOD_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muddleIcon: {
    transform: [{ scaleX: 2 }],
  },
  emptyLabel: {
    textAlign: 'center',
    marginTop: 80,
    fontSize: 14,
  },
});
