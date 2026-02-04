import { MaterialIcons } from '@expo/vector-icons';
import { useScrollToTop } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type LayoutChangeEvent,
  type LayoutRectangle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollectionHeader } from '@/components/CollectionHeader';
import { FabAdd } from '@/components/FabAdd';
import { OnboardingCard } from '@/components/OnboardingCard';
import { ListRow, PresenceCheck, Thumb } from '@/components/RowParts';
import { SideMenuDrawer } from '@/components/SideMenuDrawer';
import { TagPill } from '@/components/TagPill';
import type { SegmentTabOption } from '@/components/TopBars';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import { ONBOARDING_AVAILABLE_INGREDIENTS } from '@/constants/onboarding';
import { useAppColors } from '@/constants/theme';
import { isCocktailReady } from '@/libs/cocktail-availability';
import { getLastIngredientTab, setLastIngredientTab, type IngredientTabKey } from '@/libs/collection-tabs';
import {
  createIngredientLookup,
  getVisibleIngredientIdsForCocktail,
} from '@/libs/ingredient-availability';
import { navigateToDetailsWithReturnTo } from '@/libs/navigation';
import { normalizeSearchText } from '@/libs/search-normalization';
import { buildTagOptions, type TagOption } from '@/libs/tag-options';
import { useInventory, type Cocktail, type Ingredient } from '@/providers/inventory-provider';
import { ONBOARDING_STEP_ORDER, useOnboarding } from '@/providers/onboarding-provider';
import { tagColors } from '@/theme/theme';

type IngredientSection = {
  key: string;
  label: string;
  data: Ingredient[];
};

const TAB_OPTIONS: SegmentTabOption[] = [
  { key: 'all', label: 'All' },
  { key: 'my', label: 'My' },
  { key: 'shopping', label: 'Shopping' },
];

const normalizeName = (name: string) => name.trim().toLowerCase();

type IngredientListItemProps = {
  ingredient: Ingredient;
  highlightColor: string;
  availableIngredientIds: Set<number>;
  onToggleAvailability: (id: number) => void;
  subtitle?: string;
  surfaceVariantColor?: string;
  isOnShoppingList: boolean;
  showAvailabilityToggle?: boolean;
  onShoppingToggle?: (id: number) => void;
  isOnboardingActive: boolean;
  isOnboardingTarget: boolean;
};

const areIngredientPropsEqual = (
  prev: Readonly<IngredientListItemProps>,
  next: Readonly<IngredientListItemProps>,
) =>
  prev.ingredient === next.ingredient &&
  prev.highlightColor === next.highlightColor &&
  prev.availableIngredientIds === next.availableIngredientIds &&
  prev.onToggleAvailability === next.onToggleAvailability &&
  prev.subtitle === next.subtitle &&
  prev.surfaceVariantColor === next.surfaceVariantColor &&
  prev.isOnShoppingList === next.isOnShoppingList &&
  prev.showAvailabilityToggle === next.showAvailabilityToggle &&
  prev.onShoppingToggle === next.onShoppingToggle &&
  prev.isOnboardingActive === next.isOnboardingActive &&
  prev.isOnboardingTarget === next.isOnboardingTarget;

const IngredientListItem = memo(function IngredientListItemComponent({
  ingredient,
  highlightColor,
  availableIngredientIds,
  onToggleAvailability,
  subtitle,
  surfaceVariantColor,
  isOnShoppingList,
  showAvailabilityToggle = true,
  onShoppingToggle,
  isOnboardingActive,
  isOnboardingTarget,
}: IngredientListItemProps) {
  const Colors = useAppColors();
  const id = Number(ingredient.id ?? -1);
  const isAvailable = id >= 0 && availableIngredientIds.has(id);
  const ingredientTagColors = (ingredient.tags ?? [])
    .map((tag) => tag?.color ?? tagColors.yellow)
    .filter(Boolean);

  const handleToggleAvailability = useCallback(() => {
    if (id >= 0) {
      onToggleAvailability(id);
    }
  }, [id, onToggleAvailability]);

  const handleShoppingToggle = useCallback(() => {
    if (id >= 0 && onShoppingToggle) {
      onShoppingToggle(id);
    }
  }, [id, onShoppingToggle]);

  const subtitleStyle = surfaceVariantColor ? { color: surfaceVariantColor } : undefined;

  const thumbnail = useMemo(
    () => <Thumb label={ingredient.name} uri={ingredient.photoUri} />,
    [ingredient.name, ingredient.photoUri],
  );

  const brandIndicatorColor = ingredient.baseIngredientId != null ? Colors.primary : undefined;

  const shoppingControl = useMemo(() => {
    const shoppingLabel = onShoppingToggle ? 'Remove from shopping list' : 'On shopping list';
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
          hitSlop={8}
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
  }, [handleShoppingToggle, isOnShoppingList, onShoppingToggle, Colors]);

  const canToggleAvailability = !isOnboardingActive || isOnboardingTarget;
  const control = useMemo(() => {
    if (onShoppingToggle) {
      return <View style={styles.presenceSlot}>{shoppingControl}</View>;
    }

    return (
      <View style={styles.presenceSlot}>
        {showAvailabilityToggle ? (
          <View
            style={
              isOnboardingTarget
                ? [styles.onboardingCheckboxHighlight, { backgroundColor: Colors.highlightSubtle }]
                : null
            }>
            <PresenceCheck checked={isAvailable} onToggle={canToggleAvailability ? handleToggleAvailability : undefined} />
          </View>
        ) : (
          <View style={styles.presencePlaceholder} />
        )}
      </View>
    );
  }, [
    Colors.highlightSubtle,
    canToggleAvailability,
    handleToggleAvailability,
    isAvailable,
    isOnboardingTarget,
    onShoppingToggle,
    showAvailabilityToggle,
    shoppingControl,
  ]);

  const handlePress = useCallback(() => {
    const routeParam = ingredient.id ?? ingredient.name;
    if (routeParam == null) {
      return;
    }

    navigateToDetailsWithReturnTo({
      pathname: '/ingredients/[ingredientId]',
      params: { ingredientId: String(routeParam) },
      returnToPath: '/ingredients',
    });
  }, [ingredient.id, ingredient.name]);

  return (
    <View style={isOnboardingTarget ? styles.onboardingRowHighlight : null}>
      <ListRow
        title={ingredient.name}
        subtitle={subtitle}
        subtitleStyle={subtitleStyle}
        onPress={isOnboardingActive ? undefined : handlePress}
        selected={isAvailable}
        highlightColor={highlightColor}
        tagColors={ingredientTagColors}
        accessibilityRole="button"
        accessibilityState={showAvailabilityToggle && isAvailable ? { selected: true } : undefined}
        thumbnail={thumbnail}
        control={control}
        metaFooter={onShoppingToggle ? undefined : shoppingControl}
        brandIndicatorColor={brandIndicatorColor}
        metaAlignment="center"
      />
    </View>
  );
}, areIngredientPropsEqual);

export default function IngredientsScreen() {
  const router = useRouter();
  const Colors = useAppColors();
  const {
    cocktails,
    ingredients,
    availableIngredientIds,
    shoppingIngredientIds,
    toggleIngredientShopping,
    toggleIngredientAvailability,
    ignoreGarnish,
    allowAllSubstitutes,
  } = useInventory();
  const { activeStep, isActive, goToStep } = useOnboarding();
  const [activeTab, setActiveTab] = useState<IngredientTabKey>(() => getLastIngredientTab());
  const [query, setQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFilterMenuVisible, setFilterMenuVisible] = useState(false);
  const [selectedTagKeys, setSelectedTagKeys] = useState<Set<string>>(() => new Set());
  const [headerLayout, setHeaderLayout] = useState<LayoutRectangle | null>(null);
  const [filterAnchorLayout, setFilterAnchorLayout] = useState<LayoutRectangle | null>(null);
  const listRef = useRef<FlatList<unknown>>(null);
  const lastScrollOffset = useRef(0);
  const searchStartOffset = useRef<number | null>(null);
  const previousQuery = useRef(query);
  const [optimisticAvailability, setOptimisticAvailability] = useState<Map<number, boolean>>(
    () => new Map(),
  );
  const [, startAvailabilityTransition] = useTransition();
  const defaultTagColor = tagColors.yellow ?? Colors.highlightFaint;
  const isOnboardingIngredients = isActive && activeStep === 'ingredients';
  const requiredNameSet = useMemo(
    () => new Set(ONBOARDING_AVAILABLE_INGREDIENTS.map(normalizeName)),
    [],
  );
  const onboardingStepIndex = useMemo(
    () => ONBOARDING_STEP_ORDER.indexOf('ingredients') + 1,
    [],
  );
  const onboardingStepCount = ONBOARDING_STEP_ORDER.length;
  const requiredIngredientIds = useMemo(
    () =>
      ingredients
        .filter((ingredient) => requiredNameSet.has(normalizeName(ingredient.name ?? '')))
        .map((ingredient) => Number(ingredient.id ?? -1))
        .filter((id) => Number.isFinite(id) && id >= 0)
        .map((id) => Math.trunc(id)),
    [ingredients, requiredNameSet],
  );
  const hasAllRequiredIngredients = useMemo(() => {
    if (requiredIngredientIds.length === 0) {
      return false;
    }

    return requiredIngredientIds.every((id) => availableIngredientIds.has(id));
  }, [availableIngredientIds, requiredIngredientIds]);

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

  useEffect(() => {
    setLastIngredientTab(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (isOnboardingIngredients && activeTab !== 'all') {
      setActiveTab('all');
    }
  }, [activeTab, isOnboardingIngredients]);

  useEffect(() => {
    if (isOnboardingIngredients) {
      setIsMenuOpen(false);
      setFilterMenuVisible(false);
    }
  }, [isOnboardingIngredients]);

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

  const handleClearTagFilters = useCallback(() => {
    setSelectedTagKeys((previous) => {
      if (previous.size === 0) {
        return previous;
      }

      return new Set<string>();
    });
  }, []);

  const ingredientLookup = useMemo(() => createIngredientLookup(ingredients), [ingredients]);

  const resolveCocktailKey = useCallback((cocktail: Cocktail) => {
    const id = cocktail.id;
    if (id != null) {
      return String(id);
    }

    if (cocktail.name) {
      return cocktail.name.trim().toLowerCase();
    }

    return undefined;
  }, []);

  const visibleCocktailsByIngredientId = useMemo(() => {
    const map = new Map<number, Set<string>>();

    cocktails.forEach((cocktail) => {
      const cocktailKey = resolveCocktailKey(cocktail);
      if (!cocktailKey) {
        return;
      }

      const visibleIds = getVisibleIngredientIdsForCocktail(cocktail, ingredientLookup, {
        allowAllSubstitutes,
      });

      visibleIds.forEach((ingredientId) => {
        let set = map.get(ingredientId);
        if (!set) {
          set = new Set<string>();
          map.set(ingredientId, set);
        }

        set.add(cocktailKey);
      });
    });

    return map;
  }, [allowAllSubstitutes, cocktails, ingredientLookup, resolveCocktailKey]);

  const makeableCocktailKeys = useMemo(() => {
    const keys = new Set<string>();

    cocktails.forEach((cocktail) => {
      const key = resolveCocktailKey(cocktail);
      if (!key) {
        return;
      }

      if (isCocktailReady(cocktail, availableIngredientIds, ingredientLookup, ingredients, {
        ignoreGarnish,
        allowAllSubstitutes,
      })) {
        keys.add(key);
      }
    });

    return keys;
  }, [
    allowAllSubstitutes,
    availableIngredientIds,
    cocktails,
    ignoreGarnish,
    ingredientLookup,
    ingredients,
    resolveCocktailKey,
  ]);

  const totalCocktailCounts = useMemo(() => {
    const counts = new Map<number, number>();
    visibleCocktailsByIngredientId.forEach((cocktailKeys, ingredientId) => {
      counts.set(ingredientId, cocktailKeys.size);
    });
    return counts;
  }, [visibleCocktailsByIngredientId]);

  const makeableCocktailCounts = useMemo(() => {
    const counts = new Map<number, number>();
    visibleCocktailsByIngredientId.forEach((cocktailKeys, ingredientId) => {
      let count = 0;
      cocktailKeys.forEach((key) => {
        if (makeableCocktailKeys.has(key)) {
          count += 1;
        }
      });
      counts.set(ingredientId, count);
    });
    return counts;
  }, [makeableCocktailKeys, visibleCocktailsByIngredientId]);

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
      all: { key: 'all', label: 'All', data: ingredients },
      my: { key: 'my', label: 'My', data: inStock },
      shopping: {
        key: 'shopping',
        label: 'Shopping',
        data: shoppingList,
      },
    };
  }, [ingredients, availableIngredientIds, shoppingIngredientIds]);

  const activeSection = sections[activeTab] ?? sections.all;

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

  const highlightColor = Colors.highlightFaint;
  const isFilterActive = selectedTagKeys.size > 0;
  const emptyMessage = useMemo(() => {
    switch (activeTab) {
      case 'my':
        return 'Mark ingredients you have to see them here.';
      case 'shopping':
        return 'There are no ingredients in your\nshopping list yet.';
      default:
        return 'No ingredients in the list';
    }
  }, [activeTab]);
  const filterMenuTop = useMemo(() => {
    if (headerLayout && filterAnchorLayout) {
      return headerLayout.y + filterAnchorLayout.y + filterAnchorLayout.height + 6;
    }

    if (headerLayout) {
      return headerLayout.y + headerLayout.height;
    }

    return 0;
  }, [filterAnchorLayout, headerLayout]);

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

  const renderItem = useCallback(
    ({ item }: { item: Ingredient }) => {
      const ingredientId = Number(item.id ?? -1);
      const isOnShoppingList = ingredientId >= 0 && shoppingIngredientIds.has(ingredientId);
      const isOnboardingTarget =
        isOnboardingIngredients && requiredNameSet.has(normalizeName(item.name ?? ''));
      const rowHighlightColor = isOnboardingTarget ? Colors.highlightSubtle : highlightColor;

      const isMyTab = activeTab === 'my';
      const countsMap = isMyTab ? makeableCocktailCounts : totalCocktailCounts;
      const count = ingredientId >= 0 ? countsMap.get(ingredientId) ?? 0 : 0;

      let subtitleText: string | undefined;
      if (count > 0) {
        if (isMyTab) {
          const label = count === 1 ? 'cocktail' : 'cocktails';
          subtitleText = `Make ${count} ${label}`;
        } else {
          const label = count === 1 ? 'recipe' : 'recipes';
          subtitleText = `${count} ${label}`;
        }
      }

      return (
        <IngredientListItem
          ingredient={item}
          highlightColor={rowHighlightColor}
          availableIngredientIds={effectiveAvailableIngredientIds}
          onToggleAvailability={handleToggle}
          subtitle={subtitleText}
          surfaceVariantColor={Colors.onSurfaceVariant ?? Colors.icon}
          isOnShoppingList={isOnShoppingList}
          showAvailabilityToggle={activeTab !== 'shopping'}
          onShoppingToggle={activeTab === 'shopping' ? handleShoppingToggle : undefined}
          isOnboardingActive={isOnboardingIngredients}
          isOnboardingTarget={isOnboardingTarget}
        />
      );
    },
    [
      activeTab,
      effectiveAvailableIngredientIds,
      handleToggle,
      handleShoppingToggle,
      highlightColor,
      isOnboardingIngredients,
      makeableCocktailCounts,
      Colors,
      requiredNameSet,
      shoppingIngredientIds,
      totalCocktailCounts,
    ],
  );

  const renderSeparator = useCallback(
    ({ leadingItem }: { leadingItem?: Ingredient | null }) => {
      const ingredientId = Number(leadingItem?.id ?? -1);
      const isAvailable = ingredientId >= 0 && effectiveAvailableIngredientIds.has(ingredientId);
      const backgroundColor = isAvailable ? Colors.outline : Colors.outlineVariant;

      return <View style={[styles.divider, { backgroundColor }]} />;
    },
    [effectiveAvailableIngredientIds, Colors],
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors.background }]}
      edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View
          style={styles.headerWrapper}
          onLayout={handleHeaderLayout}
          pointerEvents={isOnboardingIngredients ? 'none' : 'auto'}>
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
                          androidRippleColor={`${Colors.surfaceVariant}33`}
                        />
                      );
                    })}
                  </View>
                ) : (
                  <Text style={[styles.filterMenuEmpty, { color: Colors.onSurfaceVariant }]}>
                    No tags available
                  </Text>
                )}
                {selectedTagKeys.size > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear selected tag filters"
                    onPress={handleClearTagFilters}
                    style={styles.filterMenuClearButton}>
                    <Text style={[styles.filterMenuClearLabel, { color: Colors.tint }]}>Clear filters</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>
          </>
        ) : null}
        <FlatList
          ref={listRef}
          data={filteredIngredients}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={renderSeparator}
          contentContainerStyle={styles.listContent}
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
        {isOnboardingIngredients ? (
          <View style={[styles.onboardingDim, { backgroundColor: Colors.backdrop }]} pointerEvents="none" />
        ) : null}
        {isOnboardingIngredients ? (
          <View style={styles.onboardingCardWrapper} pointerEvents="box-none">
            <OnboardingCard
              title="Step 1: Mark what you have"
              message="Add Cola, Ice, Spiced Rum, Gin, and Tonic to your inventory. Tap the checkmarks next to each ingredient."
              actionLabel="Go to My Cocktails"
              actionDisabled={!hasAllRequiredIngredients}
              stepIndex={onboardingStepIndex}
              stepCount={onboardingStepCount}
              onAction={() => {
                goToStep('cocktails');
                router.push('/cocktails');
              }}
            />
          </View>
        ) : null}
      </View>
      <View pointerEvents={isOnboardingIngredients ? 'none' : 'auto'}>
        <FabAdd label="Add ingredient" onPress={() => router.push('/ingredients/create')} />
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
  onboardingDim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
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
  onboardingCardWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
    zIndex: 3,
  },
  onboardingRowHighlight: {
    position: 'relative',
    zIndex: 2,
  },
  onboardingCheckboxHighlight: {
    padding: 4,
    borderRadius: 12,
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
  filterMenuScroll: {
    maxHeight: 540,
    paddingBottom: 2,
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
