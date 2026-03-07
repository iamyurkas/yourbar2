import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useScrollToTop } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
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
import { CollectionHeader } from '@/components/CollectionHeader';
import { CollectionListSkeleton } from '@/components/CollectionListSkeleton';
import { CocktailFiltersPanel } from '@/components/CocktailFiltersPanel';
import { FabAdd } from '@/components/FabAdd';
import { useOnboardingAnchors } from '@/components/onboarding/OnboardingContext';
import { ListRow, Thumb } from '@/components/RowParts';
import { SideMenuDrawer } from '@/components/SideMenuDrawer';
import type { SegmentTabOption } from '@/components/TopBars';
import { getCocktailMethods, METHOD_ICON_MAP, type CocktailMethod } from '@/constants/cocktail-methods';
import { BUILTIN_COCKTAIL_TAGS } from '@/constants/cocktail-tags';
import { useAppColors } from '@/constants/theme';
import { summariseCocktailAvailability } from '@/libs/cocktail-availability';
import { getLastCocktailTab, setLastCocktailTab, type CocktailTabKey } from '@/libs/collection-tabs';
import { compareOptionalGlobalAlphabet } from '@/libs/global-sort';
import { getPluralCategory } from '@/libs/i18n/plural';
import { useI18n } from '@/libs/i18n/use-i18n';
import { createIngredientLookup } from '@/libs/ingredient-availability';
import { navigateToDetailsWithReturnTo } from '@/libs/navigation';
import { normalizeSearchText } from '@/libs/search-normalization';
import { buildTagOptions, type TagOption } from '@/libs/tag-options';
import { useCocktailTabLogic, type MyTabListItem } from '@/libs/use-cocktail-tab-logic';
import { useInventoryActions, useInventoryData, useInventorySettings, type Cocktail } from '@/providers/inventory-provider';
import { tagColors } from '@/theme/theme';
import IngredientsIcon from '@/assets/images/ingredients.svg';

type CocktailMethodOption = {
  id: CocktailMethod['id'];
  label: string;
};

const METHOD_ICON_SIZE = 16;
type CocktailAvailabilitySummary = ReturnType<typeof summariseCocktailAvailability>;
type CocktailSortOption = 'alphabetical' | 'requiredCount' | 'missingRequiredCount' | 'rating' | 'random';

function countRequiredIngredients(cocktail: Cocktail, ignoreGarnish: boolean): number {
  return (cocktail.ingredients ?? []).filter(
    (ingredient) => !ingredient?.optional && !(ignoreGarnish && ingredient?.garnish),
  ).length;
}

export default function CocktailsScreen() {
  const { onTabChangeRequest } = useOnboardingAnchors();
  const { cocktails, availableIngredientIds, ingredients, shoppingIngredientIds, getCocktailRating, loading } =
    useInventoryData();
  const { ignoreGarnish, allowAllSubstitutes, ratingFilterThreshold, showTabCounters } = useInventorySettings();
  const { toggleIngredientShopping } = useInventoryActions();
  const Colors = useAppColors();
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<CocktailTabKey>(() => getLastCocktailTab());

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
  const [collapsedMissingIngredientIds, setCollapsedMissingIngredientIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [headerLayout, setHeaderLayout] = useState<LayoutRectangle | null>(null);
  const [filterAnchorLayout, setFilterAnchorLayout] = useState<LayoutRectangle | null>(null);
  const listRef = useRef<FlatList<MyTabListItem | Cocktail>>(null);
  const lastScrollOffset = useRef(0);
  const searchStartOffset = useRef<number | null>(null);
  const previousQuery = useRef(query);

  useScrollToTop(listRef);

  useEffect(() => {
    return onTabChangeRequest((screen, tab) => {
      if (screen === 'cocktails') {
        setActiveTab(tab as CocktailTabKey);
      }
    });
  }, [onTabChangeRequest]);

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
  const router = useRouter();
  const ingredientLookup = useMemo(() => createIngredientLookup(ingredients), [ingredients]);
  const defaultTagColor = tagColors.yellow ?? Colors.highlightFaint;

  useEffect(() => {
    setLastCocktailTab(activeTab);
  }, [activeTab, t]);

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

  const ratedCocktails = useMemo(() => {
    return cocktails.filter((cocktail) => {
      const ratingValue = getCocktailRating(cocktail);
      return ratingValue >= ratingFilterThreshold;
    });
  }, [cocktails, getCocktailRating, ratingFilterThreshold]);

  const baseTabCocktails = useMemo(() => {
    if (activeTab === 'favorites') {
      return ratedCocktails;
    }

    return cocktails;
  }, [activeTab, cocktails, ratedCocktails]);

  const cocktailsByTab = useMemo<Record<CocktailTabKey, Cocktail[]>>(() => ({
    all: cocktails,
    my: cocktails,
    favorites: ratedCocktails,
  }), [cocktails, ratedCocktails]);



  const availableTagOptions = useMemo<TagOption[]>(
    () => buildTagOptions(baseTabCocktails, (cocktail) => cocktail.tags ?? [], BUILTIN_COCKTAIL_TAGS, defaultTagColor),
    [baseTabCocktails, defaultTagColor],
  );

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

  const availableMethodOptions = useMemo<CocktailMethodOption[]>(() => {
    const methodOrder = getCocktailMethods();
    const methodMap = new Map(methodOrder.map((method) => [method.id, method]));
    const usedMethods = new Set<CocktailMethodOption['id']>();

    baseTabCocktails.forEach((cocktail) => {
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

    return methodOrder
      .filter((method) => usedMethods.has(method.id))
      .map((method) => ({ id: method.id, label: method.label }));
  }, [baseTabCocktails]);

  const availableStarRatings = useMemo<number[]>(() => {
    if (activeTab !== 'favorites') {
      return [];
    }

    const ratings = new Set<number>();
    baseTabCocktails.forEach((cocktail) => {
      const rating = getCocktailRating(cocktail);
      if (rating > 0) {
        ratings.add(rating);
      }
    });

    return [...ratings].sort((a, b) => a - b);
  }, [activeTab, baseTabCocktails, getCocktailRating]);

  useEffect(() => {
    setSelectedStarRatings((previous) => {
      if (previous.size === 0) {
        return previous;
      }

      if (activeTab !== 'favorites') {
        return new Set<number>();
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
  }, [activeTab, availableStarRatings]);

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

  const normalizedQuery = useMemo(() => {
    const normalized = normalizeSearchText(query);
    const tokens = normalized ? normalized.split(/\s+/).filter(Boolean) : [];
    return { text: normalized, tokens };
  }, [query]);

  const filteredByStarRatings = useMemo(() => {
    const base = baseTabCocktails;
    if (activeTab !== 'favorites' || selectedStarRatings.size === 0) {
      return base;
    }

    return base.filter((cocktail) => selectedStarRatings.has(getCocktailRating(cocktail)));
  }, [activeTab, baseTabCocktails, getCocktailRating, selectedStarRatings]);

  const filteredByMethods = useMemo(() => {
    const base = filteredByStarRatings;
    if (selectedMethodIds.size === 0) {
      return base;
    }

    return base.filter((cocktail) => {
      const legacyMethodId = (cocktail as { methodId?: CocktailMethod['id'] | null }).methodId ?? null;
      const methodIds = (cocktail.methodIds?.length ? cocktail.methodIds : legacyMethodId ? [legacyMethodId] : []) as CocktailMethod["id"][];
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

  const filteredAvailabilitySummaryByKey = useMemo(() => {
    const summaryMap = new Map<string, CocktailAvailabilitySummary>();

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
  }, [allowAllSubstitutes, availableIngredientIds, filteredCocktails, ignoreGarnish, ingredientLookup]);

  const randomSortRanks = useMemo(() => {
    const rankMap = new Map<string, number>();

    filteredCocktails.forEach((cocktail) => {
      const key = String(cocktail.id ?? cocktail.name);
      rankMap.set(key, Math.random());
    });

    return rankMap;
  }, [filteredCocktails]);

  const compareCocktailsBySelectedSort = useCallback(
    (left: Cocktail, right: Cocktail) => {
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

      if (selectedSortOption === 'missingRequiredCount') {
        const leftKey = String(left.id ?? left.name);
        const rightKey = String(right.id ?? right.name);
        const leftMissing = filteredAvailabilitySummaryByKey.get(leftKey)?.missingCount ?? 0;
        const rightMissing = filteredAvailabilitySummaryByKey.get(rightKey)?.missingCount ?? 0;
        if (leftMissing !== rightMissing) {
          result = leftMissing - rightMissing;
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
    },
    [
      filteredAvailabilitySummaryByKey,
      getCocktailRating,
      ignoreGarnish,
      isSortDescending,
      randomSortRanks,
      selectedSortOption,
    ],
  );

  const sortedCocktails = useMemo(
    () => [...filteredCocktails].sort(compareCocktailsBySelectedSort),
    [compareCocktailsBySelectedSort, filteredCocktails],
  );

  const myTabListData = useCocktailTabLogic({
    allowAllSubstitutes,
    availableIngredientIds,
    filteredCocktails,
    ignoreGarnish,
    ingredientLookup,
    defaultTagColor,
    compareCocktails: compareCocktailsBySelectedSort,
  });

  const visibleMyTabItems = useMemo(() => {
    return myTabListData.items.filter((item) => {
      if (item.type !== 'cocktail' || item.parentIngredientId == null) {
        return true;
      }

      return !collapsedMissingIngredientIds.has(item.parentIngredientId);
    });
  }, [collapsedMissingIngredientIds, myTabListData]);

  const myReadyCocktailsCount = useMemo(() => {
    return myTabListData.items.filter(
      (item) => item.type === 'cocktail' && item.parentIngredientId == null,
    ).length;
  }, [myTabListData]);

  const tabOptions = useMemo<SegmentTabOption[]>(() => [
    {
      key: 'all',
      label: t('common.tabAll'),
      counter: showTabCounters ? `(${cocktailsByTab.all.length})` : undefined,
    },
    {
      key: 'my',
      label: t('common.tabMy'),
      counter: showTabCounters ? `(${myReadyCocktailsCount})` : undefined,
    },
    {
      key: 'favorites',
      label: t('common.tabFavorites'),
      counter: showTabCounters ? `(${cocktailsByTab.favorites.length})` : undefined,
    },
  ], [cocktailsByTab.all.length, cocktailsByTab.favorites.length, myReadyCocktailsCount, showTabCounters, t]);


  const keyExtractor = useCallback((item: Cocktail) => String(item.id ?? item.name), []);
  const myTabKeyExtractor = useCallback((item: MyTabListItem) => item.key, []);

  const handleSelectCocktail = useCallback(
    (cocktail: Cocktail) => {
      const candidateId = cocktail.id ?? cocktail.name;
      if (!candidateId) {
        return;
      }

      navigateToDetailsWithReturnTo({
        pathname: '/cocktails/[cocktailId]',
        params: { cocktailId: String(candidateId) },
        returnToPath: '/cocktails',
      });
    },
    [],
  );

  const handleSelectIngredient = useCallback(
    (ingredientId: number) => {
      if (ingredientId >= 0) {
        navigateToDetailsWithReturnTo({
          pathname: '/ingredients/[ingredientId]',
          params: { ingredientId: String(ingredientId) },
          returnToPath: '/cocktails',
        });
      }
    },
    [],
  );

  const handleShoppingToggle = useCallback(
    (ingredientId: number) => {
      if (ingredientId >= 0) {
        toggleIngredientShopping(ingredientId);
      }
    },
    [toggleIngredientShopping],
  );

  const handleToggleIngredientCollapse = useCallback((ingredientId: number) => {
    setCollapsedMissingIngredientIds((previous) => {
      const next = new Set(previous);
      if (next.has(ingredientId)) {
        next.delete(ingredientId);
      } else {
        next.add(ingredientId);
      }
      return next;
    });
  }, []);

  const availabilitySummaryByKey = useMemo(() => {
    const summaryMap = new Map<string, CocktailAvailabilitySummary>();

    sortedCocktails.forEach((cocktail) => {
      const cocktailKey = String(cocktail.id ?? cocktail.name);
      summaryMap.set(
        cocktailKey,
        summariseCocktailAvailability(
          cocktail,
          availableIngredientIds,
          ingredientLookup,
          undefined,
          {
            ignoreGarnish,
            allowAllSubstitutes,
          },
          t,
          locale,
        ),
      );
    });

    return summaryMap;
  }, [
    allowAllSubstitutes,
    availableIngredientIds,
    ignoreGarnish,
    ingredientLookup,
    locale,
    sortedCocktails,
    t,
  ]);

  const myTabAvailabilitySummaryByKey = useMemo(() => {
    const summaryMap = new Map<string, CocktailAvailabilitySummary>();

    myTabListData.items.forEach((item) => {
      if (item.type !== 'cocktail') {
        return;
      }

      const cocktailKey = String(item.cocktail.id ?? item.cocktail.name);
      if (summaryMap.has(cocktailKey)) {
        return;
      }

      summaryMap.set(
        cocktailKey,
        summariseCocktailAvailability(
          item.cocktail,
          availableIngredientIds,
          ingredientLookup,
          undefined,
          {
            ignoreGarnish,
            allowAllSubstitutes,
          },
          t,
          locale,
        ),
      );
    });

    return summaryMap;
  }, [
    allowAllSubstitutes,
    availableIngredientIds,
    ignoreGarnish,
    ingredientLookup,
    locale,
    myTabListData.items,
    t,
  ]);

  const getAvailabilitySummary = useCallback(
    (cocktail: Cocktail, preferredMap?: Map<string, CocktailAvailabilitySummary>) => {
      const cocktailKey = String(cocktail.id ?? cocktail.name);
      const cachedSummary = preferredMap?.get(cocktailKey) ?? availabilitySummaryByKey.get(cocktailKey);
      if (cachedSummary) {
        return cachedSummary;
      }

      return summariseCocktailAvailability(
        cocktail,
        availableIngredientIds,
        ingredientLookup,
        undefined,
        {
          ignoreGarnish,
          allowAllSubstitutes,
        },
        t,
        locale,
      );
    },
    [
      allowAllSubstitutes,
      availabilitySummaryByKey,
      availableIngredientIds,
      ignoreGarnish,
      ingredientLookup,
      locale,
      t,
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
          onPress={() => handleSelectCocktail(item)}
          isReady={availability.isReady}
          missingCount={availability.missingCount}
          recipeNamesCount={availability.recipeNames.length}
          ingredientLine={availability.ingredientLine}
          ratingValue={getCocktailRating(item)}
          hasBrandFallback={availability.hasBrandFallback}
          hasStyleFallback={availability.hasStyleFallback}
        />
      );
    },
    [
      getAvailabilitySummary,
      getCocktailRating,
      handleSelectCocktail,
      ingredients,
    ],
  );

  const renderMyItem = useCallback(
    ({ item }: { item: MyTabListItem }) => {
      if (item.type === 'separator') {
        return (
          <View style={styles.moreIngredientsWrapper}>
            <View
              style={[
                styles.moreIngredientsBadge,
                {
                  backgroundColor: Colors.surface,
                  borderColor: Colors.outline,
                },
              ]}>
              <Text style={[styles.moreIngredientsLabel, { color: Colors.primary }]}>
                {t("cocktails.oneMoreIngredientForMore")}
              </Text>
            </View>
          </View>
        );
      }

      if (item.type === 'ingredient-header') {
        const isOnShoppingList = shoppingIngredientIds.has(item.ingredientId);
        const accessibilityLabel = isOnShoppingList
          ? t('cocktails.removeIngredientFromShopping')
          : t('cocktails.addIngredientToShopping');
        const titleLabel = t("cocktails.buyNamed", { name: item.name });
        const pluralCategory = getPluralCategory(locale, item.cocktailCount);
        const subtitleLabel = t(`cocktails.toMakeMore.${pluralCategory}`, { count: item.cocktailCount });
        const thumbnail = <Thumb label={item.name} uri={item.photoUri ?? undefined} />;
        const brandIndicatorColor = item.isStyled
          ? Colors.styledIngredient
          : item.isBranded
            ? Colors.primary
            : undefined;
        const isCollapsed = collapsedMissingIngredientIds.has(item.ingredientId);
        const collapseAccessibilityLabel = isCollapsed
          ? t('cocktails.expandIngredientGroup', { name: item.name })
          : t('cocktails.collapseIngredientGroup', { name: item.name });

        return (
          <ListRow
            title={titleLabel}
            subtitle={subtitleLabel}
            selected
            highlightColor={Colors.highlightSubtle}
            tagColor={item.tagColor}
            thumbnail={thumbnail}
            brandIndicatorColor={brandIndicatorColor}
            onPress={() => handleSelectIngredient(item.ingredientId)}
            accessibilityRole="button"
            metaAlignment="center"
            control={
              <View style={styles.shoppingSlot}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={collapseAccessibilityLabel}
                  onPress={() => handleToggleIngredientCollapse(item.ingredientId)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.shoppingButton, pressed ? styles.shoppingButtonPressed : null]}>
                  <MaterialCommunityIcons
                    name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={20}
                    color={Colors.onSurfaceVariant}
                    style={styles.shoppingIcon}
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={accessibilityLabel}
                  onPress={() => handleShoppingToggle(item.ingredientId)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.shoppingButton, pressed ? styles.shoppingButtonPressed : null]}>
                  <MaterialIcons
                    name={isOnShoppingList ? 'shopping-cart' : 'add-shopping-cart'}
                    size={20}
                    color={isOnShoppingList ? Colors.tint : Colors.onSurfaceVariant}
                    style={styles.shoppingIcon}
                  />
                </Pressable>
              </View>
            }
          />
        );
      }

      const availability = getAvailabilitySummary(item.cocktail, myTabAvailabilitySummaryByKey);

      return (
        <CocktailListRow
          cocktail={item.cocktail}
          ingredients={ingredients}
          showMethodIcons
          onPress={() => handleSelectCocktail(item.cocktail)}
          isReady={availability.isReady}
          missingCount={availability.missingCount}
          recipeNamesCount={availability.recipeNames.length}
          ingredientLine={availability.ingredientLine}
          ratingValue={getCocktailRating(item.cocktail)}
          hasBrandFallback={availability.hasBrandFallback}
          hasStyleFallback={availability.hasStyleFallback}
        />
      );
    },
    [
      getAvailabilitySummary,
      getCocktailRating,
      handleSelectCocktail,
      handleSelectIngredient,
      handleShoppingToggle,
      handleToggleIngredientCollapse,
      ingredients,
      myTabAvailabilitySummaryByKey,
      collapsedMissingIngredientIds,
      shoppingIngredientIds,
      Colors,
      locale,
      t,
    ],
  );

  const renderSeparator = useCallback(
    ({ leadingItem }: { leadingItem?: Cocktail | null }) => {
      const isReady = leadingItem ? getAvailabilitySummary(leadingItem).isReady : false;
      const backgroundColor = isReady ? Colors.outline : Colors.outlineVariant;

      return <View style={[styles.divider, { backgroundColor }]} />;
    },
    [getAvailabilitySummary, Colors],
  );

  const renderMySeparator = useCallback(
    ({ leadingItem }: { leadingItem?: MyTabListItem | null }) => {
      if (!leadingItem || leadingItem.type !== 'cocktail') {
        return null;
      }

      const cocktailKey = String(leadingItem.cocktail.id ?? leadingItem.cocktail.name);
      const isReady = myTabListData.availabilityMap.get(cocktailKey) ?? false;
      const backgroundColor = isReady ? Colors.outline : Colors.outlineVariant;

      return <View style={[styles.divider, { backgroundColor }]} />;
    },
    [myTabListData, Colors],
  );

  const isFilterActive =
    selectedTagKeys.size > 0 ||
    selectedMethodIds.size > 0 ||
    selectedStarRatings.size > 0 ||
    selectedSortOption !== 'alphabetical' ||
    isSortDescending;
  const isMyTab = activeTab === 'my';
  const emptyMessage = useMemo(() => {
    switch (activeTab) {
      case 'my':
        return t('cocktails.emptyMy');
      case 'favorites':
        return t('cocktails.emptyFavorites');
      default:
        return t('cocktails.emptyAll');
    }
  }, [activeTab, t]);
  const helpContent = useMemo(() => {
    switch (activeTab) {
      case 'my':
        return {
          title: t('cocktails.helpMyTitle'),
          text: t('cocktails.helpMyText'),
        };
      case 'favorites':
        return {
          title: t('cocktails.helpFavoritesTitle'),
          text: t('cocktails.helpFavoritesText'),
        };
      case 'all':
      default:
        return {
          title: t('cocktails.helpAllTitle'),
          text: t('cocktails.helpAllText'),
        };
    }
  }, [activeTab, t]);

  const filterMenuTop = useMemo(() => {
    if (headerLayout && filterAnchorLayout) {
      return headerLayout.y + filterAnchorLayout.y + filterAnchorLayout.height + 6;
    }

    if (headerLayout) {
      return headerLayout.y + headerLayout.height;
    }

    return 0;
  }, [filterAnchorLayout, headerLayout]);


  const showRatingFilters = activeTab === 'favorites' && availableStarRatings.length > 0;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors.background }]}
      edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.headerWrapper} onLayout={handleHeaderLayout}>
          <CollectionHeader
            searchValue={query}
            onSearchChange={setQuery}
            placeholder={t('common.search')}
            onMenuPress={() => setIsMenuOpen(true)}
            tabs={tabOptions}
            activeTab={activeTab}
            onTabChange={(key) => setActiveTab(key as CocktailTabKey)}
            anchorPrefix="cocktails-tab"
            onFilterPress={handleFilterPress}
            filterActive={isFilterActive}
            filterExpanded={isFilterMenuVisible}
            onFilterLayout={handleFilterLayout}
            helpTitle={helpContent.title}
            helpText={helpContent.text}
          />
        </View>
        {isFilterMenuVisible ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.closeTagFilters')}
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
                sortSectionLabel={t('cocktails.sortBy')}
                sortOptions={[
                  {
                    key: 'alphabetical',
                    label: isSortDescending && selectedSortOption === 'alphabetical' ? 'z-A' : 'A-z',
                    selected: selectedSortOption === 'alphabetical',
                    onPress: () => handleSortOptionChange('alphabetical'),
                    accessibilityLabel: t('cocktails.sortOptionAlphabeticalAccessibility'),
                  },
                  {
                    key: 'requiredCount',
                    label: '',
                    selected: selectedSortOption === 'requiredCount',
                    onPress: () => handleSortOptionChange('requiredCount'),
                    accessibilityLabel: t('cocktails.sortOptionRequiredCountAccessibility'),
                    icon: (
                      <View style={styles.sortIconInnerWrap}>
                        <Image
                          source={IngredientsIcon}
                          style={{ width: 16, height: 16, tintColor: selectedSortOption === 'requiredCount' ? Colors.surface : Colors.tint }}
                          contentFit="contain"
                        />
                        {selectedSortOption === 'requiredCount' ? (
                          <MaterialCommunityIcons
                            name={isSortDescending ? 'arrow-down-thin' : 'arrow-up-thin'}
                            size={12}
                            color={Colors.surface}
                            style={styles.sortDirectionIcon}
                          />
                        ) : null}
                      </View>
                    ),
                  },
                  {
                    key: 'missingRequiredCount',
                    label: '',
                    selected: selectedSortOption === 'missingRequiredCount',
                    onPress: () => handleSortOptionChange('missingRequiredCount'),
                    accessibilityLabel: t('cocktails.sortOptionMissingRequiredCountAccessibility'),
                    icon: (
                      <View style={styles.sortIconInnerWrap}>
                        <MaterialCommunityIcons
                          name="check"
                          size={16}
                          color={selectedSortOption === 'missingRequiredCount' ? Colors.surface : Colors.tint}
                        />
                        {selectedSortOption === 'missingRequiredCount' ? (
                          <MaterialCommunityIcons
                            name={isSortDescending ? 'arrow-down-thin' : 'arrow-up-thin'}
                            size={12}
                            color={Colors.surface}
                            style={styles.sortDirectionIcon}
                          />
                        ) : null}
                      </View>
                    ),
                  },
                  {
                    key: 'rating',
                    label: '',
                    selected: selectedSortOption === 'rating',
                    onPress: () => handleSortOptionChange('rating'),
                    accessibilityLabel: t('cocktails.sortOptionRatingAccessibility'),
                    icon: (
                      <View style={styles.sortIconInnerWrap}>
                        <MaterialCommunityIcons
                          name="star"
                          size={16}
                          color={selectedSortOption === 'rating' ? Colors.surface : Colors.tint}
                        />
                        {selectedSortOption === 'rating' ? (
                          <MaterialCommunityIcons
                            name={isSortDescending ? 'arrow-down-thin' : 'arrow-up-thin'}
                            size={12}
                            color={Colors.surface}
                            style={styles.sortDirectionIcon}
                          />
                        ) : null}
                      </View>
                    ),
                  },
                  {
                    key: 'random',
                    label: '',
                    selected: selectedSortOption === 'random',
                    onPress: () => handleSortOptionChange('random'),
                    accessibilityLabel: t('cocktails.sortOptionRandomAccessibility'),
                    icon: (
                      <View style={styles.sortIconInnerWrap}>
                        <MaterialCommunityIcons
                          name="shuffle-variant"
                          size={16}
                          color={selectedSortOption === 'random' ? Colors.surface : Colors.tint}
                        />
                        {selectedSortOption === 'random' ? (
                          <MaterialCommunityIcons
                            name={isSortDescending ? 'arrow-down-thin' : 'arrow-up-thin'}
                            size={12}
                            color={Colors.surface}
                            style={styles.sortDirectionIcon}
                          />
                        ) : null}
                      </View>
                    ),
                  },
                ]}
                availableStarRatings={availableStarRatings}
                selectedStarRatings={selectedStarRatings}
                onToggleStarRating={handleStarRatingFilterToggle}
                showRatingFilters={showRatingFilters}
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
        {loading ? (
          <CollectionListSkeleton />
        ) : isMyTab ? (
          <FlatList<MyTabListItem>
            ref={listRef as React.RefObject<FlatList<MyTabListItem>>}
            data={visibleMyTabItems}
            keyExtractor={myTabKeyExtractor}
            renderItem={renderMyItem}
            ItemSeparatorComponent={renderMySeparator}
            contentContainerStyle={styles.listContent}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={5}
            showsVerticalScrollIndicator
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            onScroll={handleScroll}
            scrollEventThrottle={16}
            ListEmptyComponent={
              <Text style={[styles.emptyLabel, { color: Colors.onSurfaceVariant }]}>
                {emptyMessage}
              </Text>
            }
          />
        ) : (
          <FlatList<Cocktail>
            ref={listRef as React.RefObject<FlatList<Cocktail>>}
            data={sortedCocktails}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ItemSeparatorComponent={renderSeparator}
            contentContainerStyle={styles.listContent}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={5}
            showsVerticalScrollIndicator
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            onScroll={handleScroll}
            scrollEventThrottle={16}
            ListEmptyComponent={
              <Text style={[styles.emptyLabel, { color: Colors.onSurfaceVariant }]}>
                {emptyMessage}
              </Text>
            }
          />
        )}
      </View>
      <FabAdd
        label={t("cocktails.addCocktail")}
        onPress={() =>
          router.push({ pathname: '/cocktails/create', params: { source: 'cocktails' } })
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
  moreIngredientsWrapper: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  moreIngredientsBadge: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  moreIngredientsLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  shoppingButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shoppingButtonPressed: {
    opacity: 0.6,
  },
  shoppingIcon: {
    width: 20,
    height: 20,
    alignSelf: 'flex-end',
  },
  shoppingSlot: {
    minHeight: 24,
    minWidth: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyLabel: {
    textAlign: 'center',
    marginTop: 80,
    fontSize: 14,
    paddingHorizontal: 20,
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
  sortIconInnerWrap: {
    width: METHOD_ICON_SIZE,
    height: METHOD_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortDirectionIcon: {
    position: 'absolute',
    right: -8,
    top: -8,
  },
  muddleIcon: {
    transform: [{ scaleX: 2 }],
  },
});
