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
  type LayoutChangeEvent,
  type LayoutRectangle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollectionHeader } from '@/components/CollectionHeader';
import { FabAdd } from '@/components/FabAdd';
import { ListRow, PresenceCheck, Thumb } from '@/components/RowParts';
import { SideMenuDrawer } from '@/components/SideMenuDrawer';
import { TagPill } from '@/components/TagPill';
import type { SegmentTabOption } from '@/components/TopBars';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import { Colors } from '@/constants/theme';
import { isCocktailReady } from '@/libs/cocktail-availability';
import { getLastIngredientTab, setLastIngredientTab, type IngredientTabKey } from '@/libs/collection-tabs';
import {
  createIngredientLookup,
  getVisibleIngredientIdsForCocktail,
} from '@/libs/ingredient-availability';
import { normalizeSearchText } from '@/libs/search-normalization';
import { useInventory, type Cocktail, type Ingredient } from '@/providers/inventory-provider';
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

const ONBOARDING_TARGET_NAMES = ['champagne', 'peach'];
const ONBOARDING_SPOTLIGHT_RADIUS = 50;

type IngredientTagOption = {
  key: string;
  name: string;
  color: string;
};

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
  onPresenceLayout?: (ingredientId: number, layout: LayoutRectangle) => void;
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
  prev.onPresenceLayout === next.onPresenceLayout;

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
  onPresenceLayout,
}: IngredientListItemProps) {
  const router = useRouter();
  const id = Number(ingredient.id ?? -1);
  const isAvailable = id >= 0 && availableIngredientIds.has(id);
  const tagColor = ingredient.tags?.[0]?.color ?? tagColors.yellow;
  const presenceRef = useRef<View>(null);

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

  const handlePresenceLayout = useCallback(() => {
    if (!onPresenceLayout || !presenceRef.current || id < 0) {
      return;
    }

    presenceRef.current.measureInWindow((x, y, width, height) => {
      onPresenceLayout(id, { x, y, width, height });
    });
  }, [id, onPresenceLayout]);

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
  }, [handleShoppingToggle, isOnShoppingList, onShoppingToggle]);

  const control = useMemo(() => {
    if (onShoppingToggle) {
      return <View style={styles.presenceSlot}>{shoppingControl}</View>;
    }

    return (
      <View style={styles.presenceSlot}>
        {showAvailabilityToggle ? (
          <View ref={presenceRef} onLayout={handlePresenceLayout} collapsable={false}>
            <PresenceCheck checked={isAvailable} onToggle={handleToggleAvailability} />
          </View>
        ) : (
          <View style={styles.presencePlaceholder} />
        )}
      </View>
    );
  }, [
    handlePresenceLayout,
    handleToggleAvailability,
    isAvailable,
    onShoppingToggle,
    showAvailabilityToggle,
    shoppingControl,
  ]);

  const handlePress = useCallback(() => {
    const routeParam = ingredient.id ?? ingredient.name;
    if (routeParam == null) {
      return;
    }

    router.push({
      pathname: '/ingredients/[ingredientId]',
      params: { ingredientId: String(routeParam) },
    });
  }, [ingredient.id, ingredient.name, router]);

  return (
    <ListRow
      title={ingredient.name}
      subtitle={subtitle}
      subtitleStyle={subtitleStyle}
      onPress={handlePress}
      selected={isAvailable}
      highlightColor={highlightColor}
      tagColor={tagColor}
      accessibilityRole="button"
      accessibilityState={showAvailabilityToggle && isAvailable ? { selected: true } : undefined}
      thumbnail={thumbnail}
      control={control}
      metaFooter={onShoppingToggle ? undefined : shoppingControl}
      brandIndicatorColor={brandIndicatorColor}
      metaAlignment="center"
    />
  );
}, areIngredientPropsEqual);

export default function IngredientsScreen() {
  const router = useRouter();
  const {
    cocktails,
    ingredients,
    availableIngredientIds,
    shoppingIngredientIds,
    toggleIngredientShopping,
    toggleIngredientAvailability,
    setIngredientAvailability,
    ignoreGarnish,
    allowAllSubstitutes,
    hasSeenIngredientsOnboarding,
    setHasSeenIngredientsOnboarding,
    startScreen,
    setStartScreen,
  } = useInventory();
  const [activeTab, setActiveTab] = useState<IngredientTabKey>(() => getLastIngredientTab());
  const [query, setQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFilterMenuVisible, setFilterMenuVisible] = useState(false);
  const [selectedTagKeys, setSelectedTagKeys] = useState<Set<string>>(() => new Set());
  const [headerLayout, setHeaderLayout] = useState<LayoutRectangle | null>(null);
  const [filterAnchorLayout, setFilterAnchorLayout] = useState<LayoutRectangle | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null);
  const [onboardingHasScrolled, setOnboardingHasScrolled] = useState(false);
  const [presenceLayouts, setPresenceLayouts] = useState<Record<number, LayoutRectangle>>({});
  const listRef = useRef<FlatList<unknown>>(null);
  const [optimisticAvailability, setOptimisticAvailability] = useState<Map<number, boolean>>(
    () => new Map(),
  );
  const [, startAvailabilityTransition] = useTransition();
  const defaultTagColor = tagColors.yellow ?? Colors.highlightFaint;

  useScrollToTop(listRef);

  useEffect(() => {
    if (!hasSeenIngredientsOnboarding) {
      setOnboardingStep((previous) => previous ?? 0);
      setOnboardingHasScrolled(false);
      return;
    }

    setOnboardingStep(null);
    setOnboardingHasScrolled(false);
  }, [hasSeenIngredientsOnboarding]);

  useEffect(() => {
    setLastIngredientTab(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!hasSeenIngredientsOnboarding && activeTab !== 'all') {
      setActiveTab('all');
    }
  }, [activeTab, hasSeenIngredientsOnboarding]);

  const availableTagOptions = useMemo<IngredientTagOption[]>(() => {
    const map = new Map<string, IngredientTagOption>();
    const builtinTagOrder = new Map<string, number>();

    BUILTIN_INGREDIENT_TAGS.forEach((tag, index) => {
      builtinTagOrder.set(String(tag.id), index);
      if (tag.name) {
        builtinTagOrder.set(tag.name.trim().toLowerCase(), index);
      }
    });

    ingredients.forEach((ingredient) => {
      (ingredient.tags ?? []).forEach((tag) => {
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
  }, [defaultTagColor, ingredients]);

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

  const handlePresenceLayout = useCallback((ingredientId: number, layout: LayoutRectangle) => {
    setPresenceLayouts((previous) => {
      const current = previous[ingredientId];
      if (
        current &&
        Math.abs(current.x - layout.x) < 0.5 &&
        Math.abs(current.y - layout.y) < 0.5 &&
        Math.abs(current.width - layout.width) < 0.5 &&
        Math.abs(current.height - layout.height) < 0.5
      ) {
        return previous;
      }

      return { ...previous, [ingredientId]: layout };
    });
  }, []);

  const ingredientLookup = useMemo(() => createIngredientLookup(ingredients), [ingredients]);
  const onboardingTargetIds = useMemo(() => {
    const targets = new Set(ONBOARDING_TARGET_NAMES);
    return ingredients
      .map((ingredient) => {
        const name = normalizeSearchText(ingredient.name ?? '');
        if (!targets.has(name)) {
          return undefined;
        }

        const id = Number(ingredient.id ?? -1);
        return Number.isFinite(id) && id >= 0 ? Math.trunc(id) : undefined;
      })
      .filter((id): id is number => id != null);
  }, [ingredients]);
  const onboardingTargetSet = useMemo(() => new Set(onboardingTargetIds), [onboardingTargetIds]);

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

  const onboardingActive = onboardingStep != null;
  const onboardingTargetIndices = useMemo(() => {
    if (onboardingTargetSet.size === 0) {
      return [];
    }

    const indices: number[] = [];
    filteredIngredients.forEach((ingredient, index) => {
      const id = Number(ingredient.id ?? -1);
      if (id >= 0 && onboardingTargetSet.has(id)) {
        indices.push(index);
      }
    });
    return indices;
  }, [filteredIngredients, onboardingTargetSet]);

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

  useEffect(() => {
    if (!onboardingActive || onboardingStep !== 0) {
      return;
    }

    if (onboardingTargetIndices.length === 0) {
      return;
    }

    const targetIndex = Math.min(...onboardingTargetIndices);
    listRef.current?.scrollToIndex({ index: targetIndex, animated: true, viewPosition: 0.3 });
    const timeout = setTimeout(() => {
      setOnboardingHasScrolled(true);
    }, 350);

    return () => clearTimeout(timeout);
  }, [onboardingActive, onboardingStep, onboardingTargetIndices]);

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

  const handleOnboardingPress = useCallback(() => {
    if (onboardingStep == null) {
      return;
    }

    if (onboardingStep === 0) {
      if (!onboardingHasScrolled && onboardingTargetIndices.length > 0) {
        const targetIndex = Math.min(...onboardingTargetIndices);
        listRef.current?.scrollToIndex({ index: targetIndex, animated: true, viewPosition: 0.3 });
        setOnboardingHasScrolled(true);
        return;
      }
      onboardingTargetIds.forEach((id) => {
        setIngredientAvailability(id, true);
      });
      setOnboardingStep(1);
      return;
    }

    setHasSeenIngredientsOnboarding(true);
    if (startScreen === 'ingredients_all') {
      setStartScreen('cocktails_all');
    }
    setOnboardingStep(null);
  }, [
    onboardingStep,
    onboardingHasScrolled,
    onboardingTargetIndices,
    onboardingTargetIds,
    setHasSeenIngredientsOnboarding,
    setIngredientAvailability,
    setStartScreen,
    startScreen,
  ]);

  const handleScrollToIndexFailed = useCallback((info: { index: number; averageItemLength: number }) => {
    const offset = info.averageItemLength * info.index;
    listRef.current?.scrollToOffset({ offset, animated: true });
  }, []);

  const keyExtractor = useCallback((item: Ingredient) => String(item.id ?? item.name), []);

  const renderItem = useCallback(
    ({ item }: { item: Ingredient }) => {
      const ingredientId = Number(item.id ?? -1);
      const isOnShoppingList = ingredientId >= 0 && shoppingIngredientIds.has(ingredientId);
      const shouldTrackPresenceLayout =
        onboardingActive && activeTab === 'all' && ingredientId >= 0 && onboardingTargetSet.has(ingredientId);

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
          highlightColor={highlightColor}
          availableIngredientIds={effectiveAvailableIngredientIds}
          onToggleAvailability={handleToggle}
          subtitle={subtitleText}
          surfaceVariantColor={Colors.onSurfaceVariant ?? Colors.icon}
          isOnShoppingList={isOnShoppingList}
          showAvailabilityToggle={activeTab !== 'shopping'}
          onShoppingToggle={activeTab === 'shopping' ? handleShoppingToggle : undefined}
          onPresenceLayout={shouldTrackPresenceLayout ? handlePresenceLayout : undefined}
        />
      );
    },
    [
      activeTab,
      effectiveAvailableIngredientIds,
      handleToggle,
      handleShoppingToggle,
      handlePresenceLayout,
      highlightColor,
      makeableCocktailCounts,
      onboardingActive,
      onboardingTargetSet,
      Colors.icon,
      Colors.onSurfaceVariant,
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
    [effectiveAvailableIngredientIds, Colors.outline, Colors.outlineVariant],
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors.background }]}
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
                  backgroundColor: Colors.surface,
                  borderColor: Colors.outline,
                  shadowColor: Colors.shadow,
                },
              ]}>
              <ScrollView style={styles.filterMenuScroll} showsVerticalScrollIndicator>
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
          onScrollToIndexFailed={handleScrollToIndexFailed}
          ListEmptyComponent={
            <Text style={[styles.emptyLabel, { color: Colors.onSurfaceVariant }]}>{emptyMessage}</Text>
          }
        />
      </View>
      <FabAdd label="Add ingredient" onPress={() => router.push('/ingredients/create')} />
      <SideMenuDrawer visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      {onboardingActive ? (
        <Pressable style={styles.onboardingOverlay} onPress={handleOnboardingPress}>
          <View style={styles.onboardingScrim} />
          {onboardingStep === 0 ? (
            <View
              style={[
                styles.onboardingCard,
                {
                  backgroundColor: Colors.surface,
                  shadowColor: Colors.shadow,
                },
              ]}>
              <Text style={[styles.onboardingTitle, { color: Colors.onSurface }]}>
                Ingredients: What do you have?
              </Text>
              <Text style={[styles.onboardingBody, { color: Colors.onSurfaceVariant }]}>
                Mark what do you have to see what cocktails are available.
              </Text>
            </View>
          ) : null}
          {onboardingStep === 1
            ? onboardingTargetIds.map((id) => {
                const layout = presenceLayouts[id];
                if (!layout) {
                  return null;
                }

                const left = layout.x + layout.width / 2 - ONBOARDING_SPOTLIGHT_RADIUS;
                const top = layout.y + layout.height / 2 - ONBOARDING_SPOTLIGHT_RADIUS;
                return (
                  <View
                    key={`onboarding-spotlight-${id}`}
                    style={[
                      styles.onboardingSpotlight,
                      {
                        left,
                        top,
                        width: ONBOARDING_SPOTLIGHT_RADIUS * 2,
                        height: ONBOARDING_SPOTLIGHT_RADIUS * 2,
                        borderRadius: ONBOARDING_SPOTLIGHT_RADIUS,
                      },
                    ]}
                  />
                );
              })
            : null}
        </Pressable>
      ) : null}
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
  onboardingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onboardingScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  onboardingCard: {
    width: '80%',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  onboardingTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  onboardingBody: {
    fontSize: 14,
    textAlign: 'center',
  },
  onboardingSpotlight: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});
