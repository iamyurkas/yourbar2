import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useScrollToTop } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
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

import { CocktailFiltersPanel } from '@/components/CocktailFiltersPanel';
import { CocktailListRow } from '@/components/CocktailListRow';
import { CollectionHeader } from '@/components/CollectionHeader';
import { CollectionListSkeleton } from '@/components/CollectionListSkeleton';
import { FabAdd } from '@/components/FabAdd';
import { ListRow, Thumb } from '@/components/RowParts';
import { SideMenuDrawer } from '@/components/SideMenuDrawer';
import type { SegmentTabOption } from '@/components/TopBars';
import { getCocktailMethods, METHOD_ICON_MAP, type CocktailMethod } from '@/constants/cocktail-methods';
import { BUILTIN_COCKTAIL_TAGS } from '@/constants/cocktail-tags';
import { useAppColors } from '@/constants/theme';
import { summariseCocktailAvailability } from '@/libs/cocktail-availability';
import { buildCocktailSortOptions, type CocktailSortOption } from '@/libs/cocktail-sort-options';
import { getLastCocktailTab, setLastCocktailTab, type CocktailTabKey } from '@/libs/collection-tabs';
import { compareOptionalGlobalAlphabet } from '@/libs/global-sort';
import { getPluralCategory } from '@/libs/i18n/plural';
import { useI18n } from '@/libs/i18n/use-i18n';
import { createIngredientLookup } from '@/libs/ingredient-availability';
import { buildReturnToParams, navigateToDetailsWithReturnTo } from '@/libs/navigation';
import { normalizeSearchText } from '@/libs/search-normalization';
import { buildTagOptions, type TagOption } from '@/libs/tag-options';
import { useCocktailTabLogic, type MyTabListItem } from '@/libs/use-cocktail-tab-logic';
import { useInventoryActions, useInventoryData, useInventorySettings, type Cocktail } from '@/providers/inventory-provider';
import { useOnboarding } from '@/providers/onboarding-provider';
import { tagColors } from '@/theme/theme';

type CocktailMethodOption = {
  id: CocktailMethod['id'];
  label: string;
};

const METHOD_ICON_SIZE = 16;
type CocktailAvailabilitySummary = ReturnType<typeof summariseCocktailAvailability>;

export default function CocktailsScreen() {
  const { cocktails, availableIngredientIds, ingredients, shoppingIngredientIds, partySelectedCocktailKeys, getCocktailRating, getCocktailComment, loading } =
    useInventoryData();
  const { ignoreGarnish, allowAllSubstitutes, showTabCounters } = useInventorySettings();
  const { toggleIngredientShopping, togglePartyCocktailSelection } = useInventoryActions();
  const Colors = useAppColors();
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<CocktailTabKey>(() => getLastCocktailTab());
  const { registerControl } = useOnboarding();

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
  const [optimisticPartySelection, setOptimisticPartySelection] = useState<Map<string, boolean>>(
    () => new Map(),
  );
  const [, startPartySelectionTransition] = useTransition();
  const listRef = useRef<FlatList<MyTabListItem | Cocktail>>(null);
  const lastScrollOffset = useRef(0);
  const pendingReturnScrollOffset = useRef<number | null>(null);
  const pendingFocusCocktailKey = useRef<string | null>(null);
  const hasAppliedReturnScrollOffset = useRef(true);
  const searchStartOffset = useRef<number | null>(null);
  const previousQuery = useRef(query);

  useScrollToTop(listRef);

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
  const params = useLocalSearchParams<{
    query?: string | string[];
    tab?: string | string[];
    tags?: string | string[];
    methods?: string | string[];
    ratings?: string | string[];
    sort?: string | string[];
    desc?: string | string[];
    scroll?: string | string[];
    focusCocktail?: string | string[];
  }>();
  const ingredientLookup = useMemo(() => createIngredientLookup(ingredients), [ingredients]);
  const defaultTagColor = tagColors.default ?? Colors.highlightFaint;

  const getParamValue = useCallback((value?: string | string[]) => {
    if (Array.isArray(value)) {
      return value[0] ?? '';
    }

    return value ?? '';
  }, []);

  useEffect(() => {
    const parsedQuery = getParamValue(params.query);
    setQuery((previous) => (previous === parsedQuery ? previous : parsedQuery));

    const parsedTab = getParamValue(params.tab);
    const nextTab: CocktailTabKey = parsedTab === 'my' || parsedTab === 'party' ? parsedTab : 'all';
    setActiveTab((previous) => (previous === nextTab ? previous : nextTab));

    const parsedTagKeys = getParamValue(params.tags)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    setSelectedTagKeys(() => new Set(parsedTagKeys));

    const parsedMethodIds = getParamValue(params.methods)
      .split(',')
      .map((item) => item.trim())
      .filter((item): item is CocktailMethod['id'] => Boolean(getCocktailMethods().find((method) => method.id === item)));
    setSelectedMethodIds(() => new Set(parsedMethodIds));

    const parsedRatings = getParamValue(params.ratings)
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5);
    setSelectedStarRatings(() => new Set(parsedRatings));

    const parsedSort = getParamValue(params.sort);
    const nextSortOption: CocktailSortOption =
      parsedSort === 'partySelected' || parsedSort === 'rating' || parsedSort === 'recentlyAdded' || parsedSort === 'random'
        ? parsedSort
        : 'alphabetical';
    setSelectedSortOption((previous) => (previous === nextSortOption ? previous : nextSortOption));

    const nextSortDescending = getParamValue(params.desc) === '1';
    setSortDescending((previous) => (previous === nextSortDescending ? previous : nextSortDescending));

    const parsedScroll = Number(getParamValue(params.scroll));
    if (Number.isFinite(parsedScroll) && parsedScroll >= 0) {
      pendingReturnScrollOffset.current = parsedScroll;
      hasAppliedReturnScrollOffset.current = false;
    } else {
      pendingReturnScrollOffset.current = null;
      hasAppliedReturnScrollOffset.current = true;
    }

    const parsedFocusCocktail = getParamValue(params.focusCocktail).trim();
    pendingFocusCocktailKey.current = parsedFocusCocktail.length > 0 ? parsedFocusCocktail : null;
  }, [
    getParamValue,
    params.desc,
    params.focusCocktail,
    params.methods,
    params.query,
    params.ratings,
    params.scroll,
    params.sort,
    params.tab,
    params.tags,
  ]);

  const listReturnToParams = useMemo<Record<string, string | undefined>>(
    () => ({
      query: query.length > 0 ? query : undefined,
      tab: activeTab,
      tags: selectedTagKeys.size > 0 ? [...selectedTagKeys].sort().join(',') : undefined,
      methods: selectedMethodIds.size > 0 ? [...selectedMethodIds].sort().join(',') : undefined,
      ratings: selectedStarRatings.size > 0 ? [...selectedStarRatings].sort((a, b) => a - b).join(',') : undefined,
      sort: selectedSortOption,
      desc: isSortDescending ? '1' : undefined,
    }),
    [activeTab, isSortDescending, query, selectedMethodIds, selectedSortOption, selectedStarRatings, selectedTagKeys],
  );

  const getReturnToParamsWithScroll = useCallback(() => {
    const roundedOffset = Math.max(0, Math.round(lastScrollOffset.current));
    return {
      ...listReturnToParams,
      scroll: String(roundedOffset),
    };
  }, [listReturnToParams]);

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

  const baseTabCocktails = cocktails;

  const cocktailsByTab = useMemo<Record<CocktailTabKey, Cocktail[]>>(() => ({
    all: cocktails,
    my: cocktails,
    party: cocktails,
  }), [cocktails]);



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
    const ratings = new Set<number>();
    baseTabCocktails.forEach((cocktail) => {
      const rating = getCocktailRating(cocktail);
      if (rating > 0) {
        ratings.add(rating);
      }
    });

    return [...ratings].sort((a, b) => a - b);
  }, [baseTabCocktails, getCocktailRating]);

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

  const normalizedQuery = useMemo(() => {
    const normalized = normalizeSearchText(query);
    const tokens = normalized ? normalized.split(/\s+/).filter(Boolean) : [];
    return { text: normalized, tokens };
  }, [query]);

  const filteredByStarRatings = useMemo(() => {
    const base = baseTabCocktails;
    if (selectedStarRatings.size === 0) {
      return base;
    }

    return base.filter((cocktail) => selectedStarRatings.has(getCocktailRating(cocktail)));
  }, [baseTabCocktails, getCocktailRating, selectedStarRatings]);

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

  const randomSortRanks = useMemo(() => {
    const rankMap = new Map<string, number>();

    filteredCocktails.forEach((cocktail) => {
      const key = String(cocktail.id ?? cocktail.name);
      rankMap.set(key, Math.random());
    });

    return rankMap;
  }, [filteredCocktails]);

  const effectivePartySelectedCocktailKeys = useMemo(() => {
    if (optimisticPartySelection.size === 0) {
      return partySelectedCocktailKeys;
    }

    const next = new Set(partySelectedCocktailKeys);
    optimisticPartySelection.forEach((value, key) => {
      if (value) {
        next.add(key);
      } else {
        next.delete(key);
      }
    });

    return next;
  }, [optimisticPartySelection, partySelectedCocktailKeys]);

  const deferredEffectivePartySelectedCocktailKeys = useDeferredValue(effectivePartySelectedCocktailKeys);
  const partySelectedCount = effectivePartySelectedCocktailKeys.size;

  const isPartySelected = useCallback(
    (key: string) => {
      if (!key) {
        return false;
      }

      if (optimisticPartySelection.has(key)) {
        return optimisticPartySelection.get(key) ?? partySelectedCocktailKeys.has(key);
      }

      return partySelectedCocktailKeys.has(key);
    },
    [optimisticPartySelection, partySelectedCocktailKeys],
  );

  const partySelectionKeysForSort = useMemo(
    () => (selectedSortOption === 'partySelected' ? deferredEffectivePartySelectedCocktailKeys : null),
    [deferredEffectivePartySelectedCocktailKeys, selectedSortOption],
  );

  const compareCocktailsBySelectedSort = useCallback(
    (left: Cocktail, right: Cocktail) => {
      const leftName = left.name ?? '';
      const rightName = right.name ?? '';
      let result = 0;

      if (selectedSortOption === 'alphabetical') {
        result = compareOptionalGlobalAlphabet(leftName, rightName);
        return isSortDescending ? -result : result;
      }

      if (selectedSortOption === 'partySelected') {
        const leftPartyScore = partySelectionKeysForSort?.has(String(left.id ?? left.name)) ? 1 : 0;
        const rightPartyScore = partySelectionKeysForSort?.has(String(right.id ?? right.name)) ? 1 : 0;
        if (leftPartyScore !== rightPartyScore) {
          result = rightPartyScore - leftPartyScore;
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
    },
    [
      getCocktailRating,
      isSortDescending,
      partySelectionKeysForSort,
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
      onboardingTargetId: 'cocktails-tab-my',
      counter: showTabCounters ? `(${myReadyCocktailsCount})` : undefined,
    },
    {
      key: 'party',
      label: t('common.tabParty'),
      counter: showTabCounters ? `(${partySelectedCount})` : undefined,
    },
  ], [cocktailsByTab.all.length, myReadyCocktailsCount, partySelectedCount, showTabCounters, t]);

  useEffect(() => {
    if (loading || hasAppliedReturnScrollOffset.current) {
      return;
    }

    const focusCocktailKey = pendingFocusCocktailKey.current;
    const restoreOffset = pendingReturnScrollOffset.current ?? 0;
    const myTabActive = activeTab === 'my';

    if (focusCocktailKey) {
      if (myTabActive) {
        const focusItem = visibleMyTabItems.find(
          (item) =>
            item.type === 'cocktail' &&
            String(item.cocktail.id ?? item.cocktail.name) === focusCocktailKey,
        );

        if (focusItem) {
          (listRef.current as FlatList<MyTabListItem> | null)?.scrollToItem({
            item: focusItem,
            animated: false,
            viewPosition: 0.5,
          });
          pendingFocusCocktailKey.current = null;
          pendingReturnScrollOffset.current = null;
          hasAppliedReturnScrollOffset.current = true;
          return;
        }
      } else {
        const focusItem = sortedCocktails.find(
          (cocktail) => String(cocktail.id ?? cocktail.name) === focusCocktailKey,
        );

        if (focusItem) {
          (listRef.current as FlatList<Cocktail> | null)?.scrollToItem({
            item: focusItem,
            animated: false,
            viewPosition: 0.5,
          });
          pendingFocusCocktailKey.current = null;
          pendingReturnScrollOffset.current = null;
          hasAppliedReturnScrollOffset.current = true;
          return;
        }
      }
    }

    listRef.current?.scrollToOffset({ offset: restoreOffset, animated: false });
    lastScrollOffset.current = restoreOffset;
    pendingFocusCocktailKey.current = null;
    pendingReturnScrollOffset.current = null;
    hasAppliedReturnScrollOffset.current = true;
  }, [activeTab, loading, sortedCocktails, visibleMyTabItems]);

  const handleScrollToIndexFailed = useCallback(
    ({ averageItemLength, index }: { averageItemLength: number; index: number }) => {
      if (!Number.isFinite(averageItemLength) || averageItemLength <= 0) {
        return;
      }
      listRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: false });
      pendingFocusCocktailKey.current = null;
      pendingReturnScrollOffset.current = null;
      hasAppliedReturnScrollOffset.current = true;
    },
    [],
  );



  useEffect(() => {
    const unregister = registerControl('cocktails-my', () => setActiveTab('my'));
    return () => unregister();
  }, [registerControl]);

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
        returnToParams: {
          ...getReturnToParamsWithScroll(),
          focusCocktail: String(candidateId),
        },
      });
    },
    [getReturnToParamsWithScroll],
  );

  const handleSelectIngredient = useCallback(
    (ingredientId: number) => {
      if (ingredientId >= 0) {
        navigateToDetailsWithReturnTo({
          pathname: '/ingredients/[ingredientId]',
          params: { ingredientId: String(ingredientId) },
          returnToPath: '/cocktails',
          returnToParams: getReturnToParamsWithScroll(),
        });
      }
    },
    [getReturnToParamsWithScroll],
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

  const partySelectionCount = effectivePartySelectedCocktailKeys.size;

  const handlePartySelectionToggle = useCallback((cocktail: Cocktail) => {
    const cocktailKey = String(cocktail.id ?? cocktail.name);
    if (!cocktailKey) {
      return;
    }

    setOptimisticPartySelection((previous) => {
      const next = new Map(previous);
      const current = next.has(cocktailKey)
        ? next.get(cocktailKey) ?? partySelectedCocktailKeys.has(cocktailKey)
        : partySelectedCocktailKeys.has(cocktailKey);
      next.set(cocktailKey, !current);
      return next;
    });

    startPartySelectionTransition(() => {
      togglePartyCocktailSelection(cocktailKey);
    });
  }, [partySelectedCocktailKeys, startPartySelectionTransition, togglePartyCocktailSelection]);

  useEffect(() => {
    if (optimisticPartySelection.size === 0) {
      return;
    }

    setOptimisticPartySelection((previous) => {
      if (previous.size === 0) {
        return previous;
      }

      let didChange = false;
      const next = new Map(previous);
      previous.forEach((value, key) => {
        if (partySelectedCocktailKeys.has(key) === value) {
          next.delete(key);
          didChange = true;
        }
      });

      return didChange ? next : previous;
    });
  }, [optimisticPartySelection, partySelectedCocktailKeys]);

  const handleAddPartyIngredientsToShopping = useCallback(() => {
    if (effectivePartySelectedCocktailKeys.size === 0) {
      return;
    }

    const ingredientIdsToAdd = new Set<number>();

    sortedCocktails.forEach((cocktail) => {
      const cocktailKey = String(cocktail.id ?? cocktail.name);
      if (!effectivePartySelectedCocktailKeys.has(cocktailKey)) {
        return;
      }

      (cocktail.ingredients ?? []).forEach((recipeIngredient) => {
        const ingredientId = Number(recipeIngredient.ingredientId);
        if (!Number.isFinite(ingredientId) || ingredientId < 0) {
          return;
        }

        ingredientIdsToAdd.add(Math.trunc(ingredientId));
      });
    });

    ingredientIdsToAdd.forEach((ingredientId) => {
      if (!shoppingIngredientIds.has(ingredientId)) {
        toggleIngredientShopping(ingredientId);
      }
    });

    router.push({ pathname: '/ingredients', params: { tab: 'shopping' } });
  }, [effectivePartySelectedCocktailKeys, router, shoppingIngredientIds, sortedCocktails, toggleIngredientShopping]);

  const renderItem = useCallback(
    ({ item }: { item: Cocktail }) => {
      const isPartyView = activeTab === 'party';
      const availability = getAvailabilitySummary(item);

      const isPartyCocktail = isPartySelected(String(item.id ?? item.name));

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
          hasComment={Boolean(getCocktailComment(item).trim())}
          hasBrandFallback={availability.hasBrandFallback}
          hasStyleFallback={availability.hasStyleFallback}
          isPartySelected={isPartyCocktail}
          showPartySelectionControl={isPartyView}
          onPartySelectionToggle={isPartyView ? () => handlePartySelectionToggle(item) : undefined}
        />
      );
    },
    [
      activeTab,
      getAvailabilitySummary,
      getCocktailComment,
      getCocktailRating,
      handlePartySelectionToggle,
      handleSelectCocktail,
      ingredients,
      isPartySelected,
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
          ? Colors.secondary
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
      const isPartyCocktail = isPartySelected(String(item.cocktail.id ?? item.cocktail.name));

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
          hasComment={Boolean(getCocktailComment(item.cocktail).trim())}
          hasBrandFallback={availability.hasBrandFallback}
          hasStyleFallback={availability.hasStyleFallback}
          isPartySelected={isPartyCocktail}
        />
      );
    },
    [
      getAvailabilitySummary,
      getCocktailComment,
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
      isPartySelected,
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
  const isPartyTab = activeTab === 'party';
  const emptyMessage = useMemo(() => {
    switch (activeTab) {
      case 'my':
        return t('cocktails.emptyMy');
      case 'party':
        return t('cocktails.emptyParty');
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
      case 'party':
        return {
          title: t('cocktails.helpPartyTitle'),
          text: t('cocktails.helpPartyText'),
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


  const showRatingFilters = availableStarRatings.length > 0;

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
                filterSectionLabel={t('common.filterBy')}
                sortOptions={buildCocktailSortOptions({
                  selectedSortOption,
                  isSortDescending,
                  onSortOptionChange: handleSortOptionChange,
                  tintColor: Colors.tint,
                  surfaceColor: Colors.surface,
                  showRequiredCountOption: false,
                  showPartySelectedOption: true,
                  getAccessibilityLabel: (option) => {
                    switch (option) {
                      case 'alphabetical':
                        return t('cocktails.sortOptionAlphabeticalAccessibility');
                      case 'partySelected':
                        return t('cocktails.sortOptionPartySelectedAccessibility');
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
            onScrollToIndexFailed={handleScrollToIndexFailed}
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
            onScrollToIndexFailed={handleScrollToIndexFailed}
            scrollEventThrottle={16}
            ListEmptyComponent={
              <Text style={[styles.emptyLabel, { color: Colors.onSurfaceVariant }]}>
                {emptyMessage}
              </Text>
            }
          />
        )}
      </View>
      {isPartyTab ? (
        <View style={[styles.partyFabContainer, { shadowColor: Colors.shadow }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('cocktails.addPartyIngredientsToShopping')}
            onPress={handleAddPartyIngredientsToShopping}
            disabled={partySelectionCount === 0}
            style={({ pressed }) => [
              styles.partyFab,
              {
                backgroundColor: partySelectionCount === 0 ? Colors.surface : Colors.primary,
                opacity: partySelectionCount === 0 ? 1 : pressed ? 0.85 : 1,
              },
            ]}>
            <MaterialIcons
              name="add-shopping-cart"
              size={24}
              color={partySelectionCount === 0 ? Colors.onSurfaceDisabled : Colors.onPrimary}
            />
          </Pressable>
        </View>
      ) : (
        <FabAdd
          label={t("cocktails.addCocktail")}
          onPress={() =>
            router.push({
              pathname: '/cocktails/create',
              params: {
                source: 'cocktails',
                ...buildReturnToParams('/cocktails', listReturnToParams),
              },
            })
          }
        />
      )}
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
    fontWeight: '400',
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
  muddleIcon: {
    transform: [{ scaleX: 2 }],
  },
  partyFabContainer: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    zIndex: 10,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 6,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
  partyFab: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
