import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useScrollToTop } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type LayoutRectangle,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD_GAP, CARD_WIDTH } from '@/components/CardLayout';
import { CollectionHeader } from '@/components/CollectionHeader';
import { CollectionListSkeleton } from '@/components/CollectionListSkeleton';
import { FabAdd } from '@/components/FabAdd';
import { IngredientCard } from '@/components/IngredientCard';
import { ListRow, PresenceCheck, Thumb } from '@/components/RowParts';
import { SideMenuDrawer } from '@/components/SideMenuDrawer';
import { TagPill } from '@/components/TagPill';
import type { SegmentTabOption } from '@/components/TopBars';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import { useAppColors } from '@/constants/theme';
import { isCocktailReady } from '@/libs/cocktail-availability';
import { getLastIngredientTab, setLastIngredientTab, type IngredientTabKey } from '@/libs/collection-tabs';
import { compareOptionalGlobalAlphabet } from '@/libs/global-sort';
import { getPluralCategory } from '@/libs/i18n/plural';
import { useI18n } from '@/libs/i18n/use-i18n';
import {
  createIngredientLookup,
  getVisibleIngredientIdsForCocktail,
} from '@/libs/ingredient-availability';
import { getLastIngredientListState, setLastIngredientListState } from '@/libs/ingredient-list-state';
import { buildIngredientSortOptions, type IngredientSortOption } from '@/libs/ingredient-sort-options';
import { buildReturnToParams, navigateToDetailsWithReturnTo } from '@/libs/navigation';
import { normalizeSearchText } from '@/libs/search-normalization';
import { buildTagOptions, type TagOption } from '@/libs/tag-options';
import {
  useInventoryActions,
  useInventoryData,
  useInventorySettings,
  type Ingredient,
} from '@/providers/inventory-provider';
import { useOnboarding } from '@/providers/onboarding-provider';
import { tagColors } from '@/theme/theme';

type IngredientSection = {
  key: string;
  label: string;
  data: Ingredient[];
};

type IngredientListItemProps = {
  ingredient: Ingredient;
  highlightColor: string;
  isAvailable: boolean;
  hasStyledVariants: boolean;
  hasBrandedVariants: boolean;
  onToggleAvailability: (id: number) => void;
  subtitle?: string;
  surfaceVariantColor?: string;
  isOnShoppingList: boolean;
  showAvailabilityToggle?: boolean;
  onShoppingToggle?: (id: number) => void;
  returnToParams?: Record<string, string | undefined>;
};

type IngredientRowMeta = {
  isOnShoppingList: boolean;
  hasStyledVariants: boolean;
  hasBrandedVariants: boolean;
  subtitleText?: string;
};

const LIST_ROW_HEIGHT = 76;
const LIST_SEPARATOR_HEIGHT = StyleSheet.hairlineWidth;
const LIST_ITEM_LAYOUT_HEIGHT = LIST_ROW_HEIGHT + LIST_SEPARATOR_HEIGHT;

const areIngredientPropsEqual = (
  prev: Readonly<IngredientListItemProps>,
  next: Readonly<IngredientListItemProps>,
) =>
  prev.ingredient === next.ingredient &&
  prev.highlightColor === next.highlightColor &&
  prev.isAvailable === next.isAvailable &&
  prev.hasStyledVariants === next.hasStyledVariants &&
  prev.hasBrandedVariants === next.hasBrandedVariants &&
  prev.onToggleAvailability === next.onToggleAvailability &&
  prev.subtitle === next.subtitle &&
  prev.surfaceVariantColor === next.surfaceVariantColor &&
  prev.isOnShoppingList === next.isOnShoppingList &&
  prev.showAvailabilityToggle === next.showAvailabilityToggle &&
  prev.onShoppingToggle === next.onShoppingToggle &&
  prev.returnToParams === next.returnToParams;

const IngredientListItem = memo(function IngredientListItemComponent({
  ingredient,
  highlightColor,
  isAvailable,
  hasStyledVariants,
  hasBrandedVariants,
  onToggleAvailability,
  subtitle,
  surfaceVariantColor,
  isOnShoppingList,
  showAvailabilityToggle = true,
  onShoppingToggle,
  returnToParams,
}: IngredientListItemProps) {
  const Colors = useAppColors();
  const ingredientId = Number(ingredient.id ?? -1);
  const ingredientTagColors = (ingredient.tags ?? [])
    .map((tag) => tag?.color ?? tagColors.default)
    .filter(Boolean);

  const handleToggleAvailability = useCallback(() => {
    if (ingredientId >= 0) {
      onToggleAvailability(ingredientId);
    }
  }, [ingredientId, onToggleAvailability]);

  const handleShoppingToggle = useCallback(() => {
    if (ingredientId >= 0 && onShoppingToggle) {
      onShoppingToggle(ingredientId);
    }
  }, [ingredientId, onShoppingToggle]);

  const subtitleStyle = surfaceVariantColor ? { color: surfaceVariantColor } : undefined;

  const thumbnail = useMemo(
    () => <Thumb label={ingredient.name} uri={ingredient.photoUri} />,
    [ingredient.name, ingredient.photoUri],
  );

  const brandIndicatorColor = ingredient.styleIngredientId != null
    ? Colors.secondary
    : ingredient.baseIngredientId != null
      ? Colors.primary
      : undefined;
  const rightIndicatorColor = hasBrandedVariants
    ? Colors.primary
    : hasStyledVariants
      ? Colors.secondary
      : undefined;
  const rightIndicatorBottomColor = hasBrandedVariants && hasStyledVariants
    ? Colors.secondary
    : undefined;

  const { t } = useI18n();

  const shoppingControl = useMemo(() => {
    const shoppingLabel = onShoppingToggle ? t('ingredients.removeFromShoppingList') : t('ingredients.onShoppingList');
    const isShoppingTab = Boolean(onShoppingToggle);
    const shoppingIconName = isShoppingTab ? 'remove-shopping-cart' : 'shopping-cart';
    const shoppingIconColor = isShoppingTab ? Colors.error : Colors.tint;

    if (!isOnShoppingList) {
      return <View style={styles.shoppingIconPlaceholder} />;
    }

    if (onShoppingToggle) {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={shoppingLabel}
          onPress={handleShoppingToggle}
          hitSlop={16}
          style={({ pressed }) => [styles.shoppingButton, pressed ? styles.shoppingButtonPressed : null]}>
          <MaterialIcons
            name={shoppingIconName}
            size={20}
            color={shoppingIconColor}
            style={styles.shoppingIcon}
          />
        </Pressable>
      );
    }

    return (
      <MaterialIcons
        name={shoppingIconName}
        size={20}
        color={shoppingIconColor}
        style={styles.shoppingIcon}
        accessibilityRole="image"
        accessibilityLabel={shoppingLabel}
      />
    );
  }, [handleShoppingToggle, isOnShoppingList, onShoppingToggle, Colors, t]);

  const control = useMemo(() => {
    if (onShoppingToggle) {
      return <View style={styles.presenceSlot}>{shoppingControl}</View>;
    }

    return (
      <View style={styles.presenceSlot}>
        {showAvailabilityToggle ? (
          <PresenceCheck checked={isAvailable} onToggle={handleToggleAvailability} />
        ) : (
          <View style={styles.presencePlaceholder} />
        )}
      </View>
    );
  }, [handleToggleAvailability, isAvailable, onShoppingToggle, showAvailabilityToggle, shoppingControl]);

  const handlePress = useCallback(() => {
    const routeParam = ingredient.id ?? ingredient.name;
    if (routeParam == null) {
      return;
    }

    navigateToDetailsWithReturnTo({
      pathname: '/ingredients/[ingredientId]',
      params: { ingredientId: String(routeParam) },
      returnToPath: '/ingredients',
      returnToParams,
    });
  }, [ingredient.id, ingredient.name, returnToParams]);

  const row = (
    <ListRow
      title={ingredient.name}
      subtitle={subtitle}
      subtitleStyle={subtitleStyle}
      onPress={handlePress}
      selected={isAvailable}
      highlightColor={highlightColor}
      tagColors={ingredientTagColors}
      accessibilityRole="button"
      accessibilityState={showAvailabilityToggle && isAvailable ? { selected: true } : undefined}
      thumbnail={thumbnail}
      control={control}
      metaFooter={onShoppingToggle ? undefined : shoppingControl}
      brandIndicatorColor={brandIndicatorColor}
      rightIndicatorColor={rightIndicatorColor}
      rightIndicatorBottomColor={rightIndicatorBottomColor}
      metaAlignment="center"
    />
  );

  return row;
}, areIngredientPropsEqual);

export default function IngredientsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    query?: string | string[];
    tab?: string | string[];
    tags?: string | string[];
    sort?: string | string[];
    desc?: string | string[];
  }>();
  const Colors = useAppColors();
  const { t, locale } = useI18n();
  const { cocktails, ingredients, availableIngredientIds, shoppingIngredientIds, loading } = useInventoryData();
  const { ignoreGarnish, allowAllSubstitutes, showTabCounters, showCardsInCollections } = useInventorySettings();
  const { toggleIngredientShopping, toggleIngredientAvailability, setShowCardsInCollections } = useInventoryActions();
  const initialListState = useMemo(() => getLastIngredientListState(), []);
  const [activeTab, setActiveTab] = useState<IngredientTabKey>(() => initialListState.tab ?? getLastIngredientTab());
  const { width: viewportWidth } = useWindowDimensions();

  const [query, setQuery] = useState(initialListState.query);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFilterMenuVisible, setFilterMenuVisible] = useState(false);
  const [selectedTagKeys, setSelectedTagKeys] = useState<Set<string>>(() => new Set(initialListState.tagKeys));
  const [selectedSortOption, setSelectedSortOption] = useState<IngredientSortOption>(initialListState.sort);
  const [isSortDescending, setSortDescending] = useState(initialListState.isSortDescending);
  const [headerLayout, setHeaderLayout] = useState<LayoutRectangle | null>(null);
  const [filterAnchorLayout, setFilterAnchorLayout] = useState<LayoutRectangle | null>(null);
  const listRef = useRef<FlatList<Ingredient>>(null);
  const lastScrollOffset = useRef(0);
  const searchStartOffset = useRef<number | null>(null);
  const previousQuery = useRef(query);
  const [optimisticAvailability, setOptimisticAvailability] = useState<Map<number, boolean>>(
    () => new Map(),
  );
  const [, startAvailabilityTransition] = useTransition();
  const defaultTagColor = tagColors.default ?? Colors.highlightFaint;
  const { registerControl } = useOnboarding();

  useScrollToTop(listRef);


  const getParamValue = useCallback((value?: string | string[]) => {
    if (Array.isArray(value)) {
      return value[0] ?? '';
    }

    return value ?? '';
  }, []);

  useEffect(() => {
    const rawQuery = getParamValue(params.query);
    const rawTab = getParamValue(params.tab);
    const rawTags = getParamValue(params.tags);
    const rawSort = getParamValue(params.sort);
    const rawDesc = getParamValue(params.desc);
    const hasListParams = [rawQuery, rawTab, rawTags, rawSort, rawDesc].some((value) => value.length > 0);

    if (!hasListParams) {
      return;
    }

    setQuery((previous) => (previous === rawQuery ? previous : rawQuery));

    const nextTab: IngredientTabKey = rawTab === 'my' || rawTab === 'shopping' ? rawTab : 'all';
    setActiveTab((previous) => (previous === nextTab ? previous : nextTab));

    const parsedTagKeys = rawTags
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    setSelectedTagKeys(() => new Set(parsedTagKeys));

    const nextSortOption: IngredientSortOption =
      rawSort === 'unlocksMostCocktails' || rawSort === 'mostUsed' || rawSort === 'recentlyAdded'
        ? rawSort
        : 'alphabetical';
    setSelectedSortOption((previous) => (previous === nextSortOption ? previous : nextSortOption));

    const nextSortDescending = rawDesc === '1';
    setSortDescending((previous) => (previous === nextSortDescending ? previous : nextSortDescending));
  }, [getParamValue, params.desc, params.query, params.sort, params.tab, params.tags]);

  const listReturnToParams = useMemo<Record<string, string | undefined>>(
    () => ({
      query: query.length > 0 ? query : undefined,
      tab: activeTab,
      tags: selectedTagKeys.size > 0 ? [...selectedTagKeys].sort().join(',') : undefined,
      sort: selectedSortOption,
      desc: isSortDescending ? '1' : undefined,
    }),
    [activeTab, isSortDescending, query, selectedSortOption, selectedTagKeys],
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

  useEffect(() => {
    setLastIngredientTab(activeTab);
  }, [activeTab, t]);


  useEffect(() => {
    setLastIngredientListState({
      query,
      tab: activeTab,
      tagKeys: [...selectedTagKeys],
      sort: selectedSortOption,
      isSortDescending,
    });
  }, [activeTab, isSortDescending, query, selectedSortOption, selectedTagKeys]);

  const availableTagOptions = useMemo<TagOption[]>(
    () =>
      buildTagOptions(ingredients, (ingredient) => ingredient.tags ?? [], BUILTIN_INGREDIENT_TAGS, defaultTagColor),
    [defaultTagColor, ingredients],
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

  const handleSortOptionChange = useCallback((option: IngredientSortOption) => {
    setSelectedSortOption((previous) => {
      if (previous === option) {
        setSortDescending((current) => !current);
        return previous;
      }

      setSortDescending(false);
      return option;
    });
  }, []);

  const handleClearTagFilters = useCallback(() => {
    setSelectedTagKeys((previous) => (previous.size === 0 ? previous : new Set<string>()));
    setSelectedSortOption('alphabetical');
    setSortDescending(false);
  }, []);

  const ingredientLookup = useMemo(() => createIngredientLookup(ingredients), [ingredients]);
  const styleBaseIngredientIds = useMemo(() => {
    return new Set(
      Array.from(ingredientLookup.stylesByBaseId.entries())
        .filter(([, styleIds]) => styleIds.length > 0)
        .map(([baseId]) => baseId),
    );
  }, [ingredientLookup.stylesByBaseId]);
  const brandedBaseIngredientIds = useMemo(() => {
    return new Set(
      Array.from(ingredientLookup.brandsByBaseId.entries())
        .filter(([, brandIds]) => brandIds.length > 0)
        .map(([baseId]) => baseId),
    );
  }, [ingredientLookup.brandsByBaseId]);

  const deferredAvailableIngredientIds = useDeferredValue(availableIngredientIds);

  const ingredientCocktailStats = useMemo(() => {
    const totalCounts = new Map<number, number>();
    const makeableCounts = new Map<number, number>();

    cocktails.forEach((cocktail) => {
      const visibleIds = getVisibleIngredientIdsForCocktail(cocktail, ingredientLookup, {
        allowAllSubstitutes,
      });
      if (visibleIds.size === 0) {
        return;
      }

      const isMakeable = isCocktailReady(cocktail, deferredAvailableIngredientIds, ingredientLookup, ingredients, {
        ignoreGarnish,
        allowAllSubstitutes,
      });

      visibleIds.forEach((ingredientId) => {
        totalCounts.set(ingredientId, (totalCounts.get(ingredientId) ?? 0) + 1);
        if (isMakeable) {
          makeableCounts.set(ingredientId, (makeableCounts.get(ingredientId) ?? 0) + 1);
        }
      });
    });

    return { totalCounts, makeableCounts };
  }, [
    allowAllSubstitutes,
    deferredAvailableIngredientIds,
    cocktails,
    ignoreGarnish,
    ingredientLookup,
    ingredients,
  ]);

  const sections = useMemo<Record<IngredientTabKey, IngredientSection>>(() => {
    const inStock = ingredients.filter((ingredient) => {
      const id = Number(ingredient.id ?? -1);
      return id >= 0 && availableIngredientIds.has(id);
    });

    const shoppingList = ingredients.filter((ingredient) => {
      const id = Number(ingredient.id ?? -1);
      return id >= 0 && shoppingIngredientIds.has(id);
    });

    return {
      all: { key: 'all', label: t('common.tabAll'), data: ingredients },
      my: { key: 'my', label: t('common.tabMy'), data: inStock },
      shopping: {
        key: 'shopping',
        label: t('common.tabShopping'),
        data: shoppingList,
      },
    };
  }, [ingredients, availableIngredientIds, shoppingIngredientIds, t]);


  const tabOptions = useMemo<SegmentTabOption[]>(() => [
    {
      key: 'all',
      label: t('common.tabAll'),
      onboardingTargetId: 'ingredients-tab-all',
      counter: showTabCounters ? `(${sections.all.data.length})` : undefined,
    },
    {
      key: 'my',
      label: t('common.tabMy'),
      onboardingTargetId: 'ingredients-tab-my',
      counter: showTabCounters ? `(${sections.my.data.length})` : undefined,
    },
    {
      key: 'shopping',
      label: t('common.tabShopping'),
      counter: showTabCounters ? `(${sections.shopping.data.length})` : undefined,
    },
  ], [sections.all.data.length, sections.my.data.length, sections.shopping.data.length, showTabCounters, t]);

  const activeSection = sections[activeTab] ?? sections.all;

  useEffect(() => {
    const unregisterAll = registerControl('ingredients-all', () => setActiveTab('all'));
    const unregisterMy = registerControl('ingredients-my', () => setActiveTab('my'));

    return () => {
      unregisterAll();
      unregisterMy();
    };
  }, [registerControl]);

  const normalizedQuery = useMemo(() => {
    const normalized = normalizeSearchText(query);
    const tokens = normalized ? normalized.split(/\s+/).filter(Boolean) : [];
    return { text: normalized, tokens };
  }, [query]);

  const filteredByTags = useMemo(() => {
    const base = activeSection.data;
    if (selectedTagKeys.size === 0) {
      return base;
    }

    return base.filter((ingredient) => {
      const tags = ingredient.tags ?? [];
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

  const filteredIngredients = useMemo(() => {
    const base = filteredByTags;
    if (!normalizedQuery.text) {
      return base;
    }

    const { text, tokens } = normalizedQuery;
    if (tokens.length <= 1) {
      const token = tokens[0] ?? text;
      return base.filter((ingredient) => ingredient.searchNameNormalized.includes(token));
    }

    return base.filter((ingredient) =>
      tokens.every(
        (token) =>
          ingredient.searchTokensNormalized.includes(token) ||
          ingredient.searchNameNormalized.includes(token),
      ),
    );
  }, [filteredByTags, normalizedQuery]);


  const effectiveAvailableIngredientIds = useMemo(() => {
    if (optimisticAvailability.size === 0) {
      return availableIngredientIds;
    }

    const next = new Set(availableIngredientIds);
    optimisticAvailability.forEach((value, id) => {
      if (value) {
        next.add(id);
      } else {
        next.delete(id);
      }
    });

    return next;
  }, [availableIngredientIds, optimisticAvailability]);

  const deferredEffectiveAvailableIngredientIds = useDeferredValue(effectiveAvailableIngredientIds);

  const getEffectiveAvailability = useCallback(
    (id: number) => {
      if (id < 0) {
        return false;
      }

      if (optimisticAvailability.has(id)) {
        return optimisticAvailability.get(id) ?? availableIngredientIds.has(id);
      }

      return availableIngredientIds.has(id);
    },
    [availableIngredientIds, optimisticAvailability],
  );

  const unlocksMostCocktailsByIngredientId = useMemo(() => {
    const unlockCounts = new Map<number, number>();

    cocktails.forEach((cocktail) => {
      const visibleIds = getVisibleIngredientIdsForCocktail(cocktail, ingredientLookup, {
        allowAllSubstitutes,
      });

      if (visibleIds.size === 0) {
        return;
      }

      const missingRequiredIds = new Set<number>();
      visibleIds.forEach((ingredientId) => {
        if (!deferredEffectiveAvailableIngredientIds.has(ingredientId)) {
          missingRequiredIds.add(ingredientId);
        }
      });

      if (missingRequiredIds.size !== 1) {
        return;
      }

      const [onlyMissingIngredientId] = Array.from(missingRequiredIds);
      unlockCounts.set(
        onlyMissingIngredientId,
        (unlockCounts.get(onlyMissingIngredientId) ?? 0) + 1,
      );
    });

    return unlockCounts;
  }, [allowAllSubstitutes, cocktails, deferredEffectiveAvailableIngredientIds, ingredientLookup]);

  const compareIngredientsBySelectedSort = useCallback(
    (left: Ingredient, right: Ingredient) => {
      const leftName = left.name ?? '';
      const rightName = right.name ?? '';
      const leftId = Number(left.id ?? -1);
      const rightId = Number(right.id ?? -1);

      if (selectedSortOption === 'alphabetical') {
        const result = compareOptionalGlobalAlphabet(leftName, rightName);
        return isSortDescending ? -result : result;
      }

      let result = 0;

      if (selectedSortOption === 'unlocksMostCocktails') {
        const leftUnlockCount = leftId >= 0 ? unlocksMostCocktailsByIngredientId.get(leftId) ?? 0 : 0;
        const rightUnlockCount = rightId >= 0 ? unlocksMostCocktailsByIngredientId.get(rightId) ?? 0 : 0;
        result = rightUnlockCount - leftUnlockCount;
      } else if (selectedSortOption === 'mostUsed') {
        const leftUseCount = leftId >= 0 ? ingredientCocktailStats.totalCounts.get(leftId) ?? 0 : 0;
        const rightUseCount = rightId >= 0 ? ingredientCocktailStats.totalCounts.get(rightId) ?? 0 : 0;
        result = rightUseCount - leftUseCount;
      } else {
        result = rightId - leftId;
      }

      if (result === 0) {
        result = compareOptionalGlobalAlphabet(leftName, rightName);
      }

      return isSortDescending ? -result : result;
    },
    [ingredientCocktailStats.totalCounts, isSortDescending, selectedSortOption, unlocksMostCocktailsByIngredientId],
  );

  const sortedIngredients = useMemo(
    () => [...filteredIngredients].sort(compareIngredientsBySelectedSort),
    [compareIngredientsBySelectedSort, filteredIngredients],
  );

  const highlightColor = Colors.highlightFaint ?? Colors.tint;
  const isFilterActive =
    selectedTagKeys.size > 0 || selectedSortOption !== 'alphabetical' || isSortDescending;
  const emptyMessage = useMemo(() => {
    switch (activeTab) {
      case 'my':
        return t('ingredients.emptyMy');
      case 'shopping':
        return t('ingredients.emptyShopping');
      default:
        return t('ingredients.emptyList');
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

  useEffect(() => {
    if (optimisticAvailability.size === 0) {
      return;
    }

    setOptimisticAvailability((previous) => {
      if (previous.size === 0) {
        return previous;
      }

      let didChange = false;
      const next = new Map(previous);
      previous.forEach((value, id) => {
        if (availableIngredientIds.has(id) === value) {
          next.delete(id);
          didChange = true;
        }
      });

      return didChange ? next : previous;
    });
  }, [availableIngredientIds, optimisticAvailability]);

  const handleToggle = useCallback(
    (id: number) => {
      if (id >= 0) {
        setOptimisticAvailability((previous) => {
          const next = new Map(previous);
          const current = next.has(id)
            ? next.get(id) ?? availableIngredientIds.has(id)
            : availableIngredientIds.has(id);
          next.set(id, !current);
          return next;
        });

        startAvailabilityTransition(() => {
          toggleIngredientAvailability(id);
        });
      }
    },
    [availableIngredientIds, startAvailabilityTransition, toggleIngredientAvailability],
  );

  const handleShoppingToggle = useCallback(
    (id: number) => {
      if (id >= 0) {
        toggleIngredientShopping(id);
      }
    },
    [toggleIngredientShopping],
  );

  const keyExtractor = useCallback((item: Ingredient) => String(item.id ?? item.name), []);
  const getItemLayout = useCallback((_: ArrayLike<Ingredient> | null | undefined, index: number) => ({
    length: LIST_ITEM_LAYOUT_HEIGHT,
    offset: LIST_ITEM_LAYOUT_HEIGHT * index,
    index,
  }), []);


  const ingredientRowMetaByKey = useMemo(() => {
    const rowMetaMap = new Map<string, IngredientRowMeta>();
    const isMyTab = activeTab === 'my';
    const countsMap = isMyTab ? ingredientCocktailStats.makeableCounts : ingredientCocktailStats.totalCounts;

    sortedIngredients.forEach((ingredient) => {
      const ingredientId = Number(ingredient.id ?? -1);
      const isValidId = ingredientId >= 0;
      const isOnShoppingList = isValidId && shoppingIngredientIds.has(ingredientId);
      const count = isValidId ? countsMap.get(ingredientId) ?? 0 : 0;

      let subtitleText: string | undefined;
      if (count > 0) {
        const pluralCategory = getPluralCategory(locale, count);
        subtitleText = isMyTab
          ? t(`ingredients.makeCount.${pluralCategory}`, { count })
          : t(`ingredients.recipeCount.${pluralCategory}`, { count });
      }

      rowMetaMap.set(String(ingredient.id ?? ingredient.name), {
        isOnShoppingList,
        hasStyledVariants: isValidId && styleBaseIngredientIds.has(ingredientId),
        hasBrandedVariants: isValidId && brandedBaseIngredientIds.has(ingredientId),
        subtitleText,
      });
    });

    return rowMetaMap;
  }, [
    activeTab,
    brandedBaseIngredientIds,
    ingredientCocktailStats.makeableCounts,
    ingredientCocktailStats.totalCounts,
    locale,
    shoppingIngredientIds,
    sortedIngredients,
    styleBaseIngredientIds,
    t,
  ]);

  const renderItem = useCallback(
    ({ item }: { item: Ingredient }) => {
      const itemKey = String(item.id ?? item.name);
      const ingredientId = Number(item.id ?? -1);
      const isValidId = ingredientId >= 0;
      const meta = ingredientRowMetaByKey.get(itemKey);

      const isOnShoppingList = meta?.isOnShoppingList ?? (isValidId && shoppingIngredientIds.has(ingredientId));
      const isAvailable = isValidId && getEffectiveAvailability(ingredientId);
      const hasStyledVariants = meta?.hasStyledVariants ?? (isValidId && styleBaseIngredientIds.has(ingredientId));
      const hasBrandedVariants = meta?.hasBrandedVariants ?? (isValidId && brandedBaseIngredientIds.has(ingredientId));
      if (showCardsInCollections) {
        return (
          <View style={styles.cardItem}>
            <IngredientCard
              ingredient={item}
              isAvailable={isAvailable}
              isOnShoppingList={isOnShoppingList}
              showRemoveShoppingIcon={activeTab === 'shopping'}
              subtitle={meta?.subtitleText}
              onAvailabilityToggle={isValidId ? () => handleToggle(ingredientId) : undefined}
              onShoppingToggle={isValidId ? () => handleShoppingToggle(ingredientId) : undefined}
              onPress={() => {
                const routeParam = item.id ?? item.name;
                if (routeParam == null) {
                  return;
                }
                navigateToDetailsWithReturnTo({
                  pathname: '/ingredients/[ingredientId]',
                  params: { ingredientId: String(routeParam) },
                  returnToPath: '/ingredients',
                  returnToParams: listReturnToParams,
                });
              }}
            />
          </View>
        );
      }

      return (
        <IngredientListItem
          ingredient={item}
          highlightColor={highlightColor}
          isAvailable={isAvailable}
          hasStyledVariants={hasStyledVariants}
          hasBrandedVariants={hasBrandedVariants}
          onToggleAvailability={handleToggle}
          subtitle={meta?.subtitleText}
          surfaceVariantColor={Colors.onSurfaceVariant ?? Colors.icon}
          isOnShoppingList={isOnShoppingList}
          showAvailabilityToggle={activeTab !== 'shopping'}
          onShoppingToggle={activeTab === 'shopping' ? handleShoppingToggle : undefined}
          returnToParams={listReturnToParams}
        />
      );
    },
    [
      activeTab,
      getEffectiveAvailability,
      handleToggle,
      handleShoppingToggle,
      highlightColor,
      ingredientRowMetaByKey,
      Colors,
      shoppingIngredientIds,
      styleBaseIngredientIds,
      brandedBaseIngredientIds,
      listReturnToParams,
      showCardsInCollections,
    ],
  );

  const renderSeparator = useCallback(
    ({ leadingItem }: { leadingItem?: Ingredient | null }) => {
      if (showCardsInCollections) {
        return null;
      }
      const ingredientId = Number(leadingItem?.id ?? -1);
      const isAvailable = getEffectiveAvailability(ingredientId);
      const backgroundColor = isAvailable ? Colors.outline : Colors.outlineVariant;

      return <View style={[styles.divider, { backgroundColor }]} />;
    },
    [Colors, getEffectiveAvailability, showCardsInCollections],
  );
  const cardColumns = Math.max(1, Math.floor((viewportWidth - 32 + CARD_GAP) / (CARD_WIDTH + CARD_GAP)));

  const handleTabChange = useCallback((key: string) => {
    if (key === 'all' || key === 'my' || key === 'shopping') {
      setActiveTab(key);
    }
  }, []);

  const helpContent = useMemo(() => {
    switch (activeTab) {
      case 'my':
        return {
          title: t('ingredients.helpMyTitle'),
          text: t('ingredients.helpMyText'),
        };
      case 'shopping':
        return {
          title: t('ingredients.helpShoppingTitle'),
          text: t('ingredients.helpShoppingText'),
        };
      case 'all':
      default:
        return {
          title: t('ingredients.helpAllTitle'),
          text: t('ingredients.helpAllFullText'),
        };
    }
  }, [activeTab, t]);

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
            onTabChange={handleTabChange}
            anchorPrefix="ingredients-tab"
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
              {/* Keep filter chip taps responsive when the search field has focus. */}
              <ScrollView
                style={styles.filterMenuScroll}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled">

                <View style={styles.filterSortSection}>
                  <View style={styles.filterSortHeaderRow}>
                    <Text style={[styles.filterSortLabel, { color: Colors.onSurfaceVariant }]}>
                      {t('ingredients.sortBy')}
                    </Text>
                    <View style={styles.sortViewToggle}>
                      <TagPill
                        label=""
                        color={Colors.tint}
                        selected={showCardsInCollections}
                        icon={<MaterialCommunityIcons name="view-grid" size={16} color={showCardsInCollections ? Colors.background : Colors.tint} />}
                        onPress={() => setShowCardsInCollections(true)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: showCardsInCollections }}
                        accessibilityLabel={t('sideMenu.showCardsInCollections')}
                        androidRippleColor={`${Colors.surfaceVariant}33`}
                        style={styles.iconOnlyPill}
                      />
                      <TagPill
                        label=""
                        color={Colors.tint}
                        selected={!showCardsInCollections}
                        icon={<MaterialCommunityIcons name="view-list" size={16} color={!showCardsInCollections ? Colors.background : Colors.tint} />}
                        onPress={() => setShowCardsInCollections(false)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: !showCardsInCollections }}
                        accessibilityLabel={t('ingredients.sortBy')}
                        androidRippleColor={`${Colors.surfaceVariant}33`}
                        style={styles.iconOnlyPill}
                      />
                    </View>
                  </View>
                  <ScrollView
                    horizontal
                    style={styles.filterSortScroll}
                    contentContainerStyle={styles.filterSortRow}
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled">
                    {buildIngredientSortOptions({
                      selectedSortOption,
                      isSortDescending,
                      onSortOptionChange: handleSortOptionChange,
                      tintColor: Colors.tint,
                      surfaceColor: Colors.surface,
                      getAccessibilityLabel: (option) => {
                        switch (option) {
                          case 'alphabetical':
                            return t('ingredients.sortOptionAlphabeticalAccessibility');
                          case 'unlocksMostCocktails':
                            return t('ingredients.sortOptionUnlocksMostCocktailsAccessibility');
                          case 'mostUsed':
                            return t('ingredients.sortOptionMostUsedAccessibility');
                          default:
                            return t('ingredients.sortOptionRecentlyAddedAccessibility');
                        }
                      },
                    }).map((option) => (
                      <TagPill
                        key={option.key}
                        label={option.label}
                        color={Colors.tint}
                        selected={option.selected}
                        icon={option.icon}
                        onPress={option.onPress}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: option.selected }}
                        accessibilityLabel={option.accessibilityLabel}
                        androidRippleColor={`${Colors.surfaceVariant}33`}
                        style={option.label ? undefined : styles.iconOnlyPill}
                      />
                    ))}
                  </ScrollView>
                </View>
                <Text style={[styles.filterSortLabel, styles.filterByLabel, { color: Colors.onSurfaceVariant }]}>
                  {t('common.filterBy')}
                </Text>
                {availableTagOptions.length > 0 ? (
                  <View style={styles.filterTagList}>
                    {availableTagOptions.map((tag) => {
                      const selected = selectedTagKeys.has(tag.key);
                      const isBuiltin = !isNaN(Number(tag.key)) && Number(tag.key) < 10;
                      const translatedName = isBuiltin ? t(`ingredientTag.${tag.key}`) : tag.name;
                      const finalName = (isBuiltin && translatedName !== `ingredientTag.${tag.key}`) ? translatedName : (tag.name ?? t('tags.unnamed'));

                      return (
                        <TagPill
                          key={tag.key}
                          label={finalName}
                          color={tag.color}
                          selected={selected}
                          onPress={() => handleTagFilterToggle(tag.key)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected }}
                          androidRippleColor={`${Colors.surfaceVariant}33`}
                        />
                      );
                    })}
                  </View>
                ) : (
                  <Text style={[styles.filterMenuEmpty, { color: Colors.onSurfaceVariant }]}>
                    {t("common.noTagsAvailable")}
                  </Text>
                )}
                {isFilterActive ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('ingredients.clearSelectedTagFilters')}
                    onPress={handleClearTagFilters}
                    style={styles.filterMenuClearButton}>
                    <Text style={[styles.filterMenuClearLabel, { color: Colors.tint }]}>{t("common.clearFilters")}</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>
          </>
        ) : null}
        {loading ? (
          <CollectionListSkeleton />
        ) : (
          <FlatList
            ref={listRef}
            data={sortedIngredients}
            keyExtractor={keyExtractor}
            getItemLayout={showCardsInCollections ? undefined : getItemLayout}
            renderItem={renderItem}
            ItemSeparatorComponent={renderSeparator}
            contentContainerStyle={showCardsInCollections ? styles.cardListContent : styles.listContent}
            numColumns={showCardsInCollections ? cardColumns : 1}
            columnWrapperStyle={showCardsInCollections && cardColumns > 1 ? styles.cardRow : undefined}
            initialNumToRender={16}
            maxToRenderPerBatch={16}
            windowSize={7}
            removeClippedSubviews
            showsVerticalScrollIndicator
            keyboardDismissMode="on-drag"
            // Let the first tap both dismiss the keyboard and activate the row.
            keyboardShouldPersistTaps="handled"
            onScroll={handleScroll}
            scrollEventThrottle={16}
            ListEmptyComponent={
              <Text style={[styles.emptyLabel, { color: Colors.onSurfaceVariant }]}>{emptyMessage}</Text>
            }
          />
        )}
      </View>
      <FabAdd
        label={t('ingredients.addIngredient')}
        onPress={() => router.push({ pathname: '/ingredients/create', params: buildReturnToParams('/ingredients', listReturnToParams) })}
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
  presenceSlot: {
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 24,
  },
  presencePlaceholder: {
    height: 16,
    width: 16,
  },
  shoppingIcon: {
    width: 20,
    height: 20,
    alignSelf: 'flex-end',
  },
  shoppingIconPlaceholder: {
    width: 20,
    height: 20,
    alignSelf: 'flex-end',
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
  listContent: {
    paddingTop: 0,
    paddingBottom: 80,
  },
  cardListContent: {
    paddingTop: 8,
    paddingBottom: 80,
    paddingHorizontal: 16,
    gap: CARD_GAP,
  },
  cardRow: {
    justifyContent: 'space-evenly',
    gap: CARD_GAP,
    width: '100%',
  },
  cardItem: {
    width: CARD_WIDTH,
    marginBottom: CARD_GAP,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
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
  filterMenuScroll: {
    maxHeight: 540,
    paddingBottom: 2,
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
    alignSelf: 'flex-start',
  },
  filterSortHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sortViewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  filterByLabel: {
    marginBottom: 12,
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
