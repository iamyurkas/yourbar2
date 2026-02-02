import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useScrollToTop } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { CocktailListRow } from '@/components/CocktailListRow';
import { CollectionHeader } from '@/components/CollectionHeader';
import { FabAdd } from '@/components/FabAdd';
import { ListRow, Thumb } from '@/components/RowParts';
import { SideMenuDrawer } from '@/components/SideMenuDrawer';
import { TagPill } from '@/components/TagPill';
import type { SegmentTabOption } from '@/components/TopBars';
import { getCocktailMethods, METHOD_ICON_MAP, type CocktailMethod } from '@/constants/cocktail-methods';
import { BUILTIN_COCKTAIL_TAGS } from '@/constants/cocktail-tags';
import { Colors } from '@/constants/theme';
import { isCocktailReady } from '@/libs/cocktail-availability';
import { getLastCocktailTab, setLastCocktailTab, type CocktailTabKey } from '@/libs/collection-tabs';
import { createIngredientLookup } from '@/libs/ingredient-availability';
import { navigateToDetailsWithReturnTo } from '@/libs/navigation';
import { normalizeSearchText } from '@/libs/search-normalization';
import { buildTagOptions, type TagOption } from '@/libs/tag-options';
import { useThemedStyles } from '@/libs/use-themed-styles';
import { useInventory, type Cocktail } from '@/providers/inventory-provider';
import { useThemeSettings } from '@/providers/theme-provider';
import { tagColors } from '@/theme/theme';

type CocktailMethodOption = {
  id: CocktailMethod['id'];
  label: string;
};

type IngredientOption = {
  id: number;
  name: string;
};

const METHOD_ICON_SIZE = 16;

type MyTabListItem =
  | { type: 'cocktail'; key: string; cocktail: Cocktail }
  | { type: 'separator'; key: string }
  | {
      type: 'ingredient-header';
      key: string;
      ingredientId: number;
      name: string;
      photoUri?: string | null;
      tagColor?: string;
      cocktailCount: number;
      isBranded: boolean;
    };

const TAB_OPTIONS: SegmentTabOption[] = [
  { key: 'all', label: 'All' },
  { key: 'my', label: 'My' },
  { key: 'favorites', label: 'Favorites' },
];

const normalizeIngredientId = (value?: number | string | null): number | undefined => {
  if (value == null) {
    return undefined;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return undefined;
  }

  return Math.trunc(numeric);
};

export default function CocktailsScreen() {
  const styles = useThemedStyles(createStyles);
  const { effectiveScheme } = useThemeSettings();
  const {
    cocktails,
    availableIngredientIds,
    ingredients,
    ignoreGarnish,
    allowAllSubstitutes,
    ratingFilterThreshold,
    shoppingIngredientIds,
    toggleIngredientShopping,
  } = useInventory();
  const [activeTab, setActiveTab] = useState<CocktailTabKey>(() => getLastCocktailTab());
  const [query, setQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFilterMenuVisible, setFilterMenuVisible] = useState(false);
  const [selectedTagKeys, setSelectedTagKeys] = useState<Set<string>>(() => new Set());
  const [selectedMethodIds, setSelectedMethodIds] = useState<Set<CocktailMethod['id']>>(
    () => new Set(),
  );
  const [headerLayout, setHeaderLayout] = useState<LayoutRectangle | null>(null);
  const [filterAnchorLayout, setFilterAnchorLayout] = useState<LayoutRectangle | null>(null);
  const listRef = useRef<FlatList<unknown>>(null);
  const lastScrollOffset = useRef(0);
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
  const ingredientLookup = useMemo(() => createIngredientLookup(ingredients), [ingredients]);
  const defaultTagColor = tagColors.yellow ?? Colors.highlightFaint;

  const availableTagOptions = useMemo<TagOption[]>(
    () => buildTagOptions(cocktails, (cocktail) => cocktail.tags ?? [], BUILTIN_COCKTAIL_TAGS, defaultTagColor),
    [cocktails, defaultTagColor],
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

  useEffect(() => {
    setLastCocktailTab(activeTab);
  }, [activeTab]);

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
    [Colors.surface, Colors.tint],
  );

  const ratedCocktails = useMemo(() => {
    return cocktails.filter((cocktail) => {
      const ratingValue = Number((cocktail as { userRating?: number }).userRating ?? 0);
      return ratingValue >= ratingFilterThreshold;
    });
  }, [cocktails, ratingFilterThreshold]);

  const baseTabCocktails = useMemo(() => {
    if (activeTab === 'favorites') {
      return ratedCocktails;
    }

    return cocktails;
  }, [activeTab, cocktails, ratedCocktails]);

  const availableMethodOptions = useMemo<CocktailMethodOption[]>(() => {
    const methodOrder = getCocktailMethods();
    const methodMap = new Map(methodOrder.map((method) => [method.id, method]));
    const usedMethods = new Set<CocktailMethodOption['id']>();

    baseTabCocktails.forEach((cocktail) => {
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

    return methodOrder
      .filter((method) => usedMethods.has(method.id))
      .map((method) => ({ id: method.id, label: method.label }));
  }, [baseTabCocktails]);

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

  const filteredByMethods = useMemo(() => {
    const base = baseTabCocktails;
    if (selectedMethodIds.size === 0) {
      return base;
    }

    return base.filter((cocktail) => {
      const legacyMethodId = (cocktail as { methodId?: CocktailMethod['id'] | null }).methodId ?? null;
      const methodIds = cocktail.methodIds?.length ? cocktail.methodIds : legacyMethodId ? [legacyMethodId] : [];
      if (methodIds.length === 0) {
        return false;
      }

      return methodIds.some((methodId) => selectedMethodIds.has(methodId));
    });
  }, [baseTabCocktails, selectedMethodIds]);

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

  const sortedFavorites = useMemo(() => {
    if (activeTab !== 'favorites') {
      return filteredCocktails;
    }

    return [...filteredCocktails].sort((a, b) => {
      const ratingA = Number((a as { userRating?: number }).userRating ?? 0);
      const ratingB = Number((b as { userRating?: number }).userRating ?? 0);

      if (ratingA !== ratingB) {
        return ratingB - ratingA;
      }

      return (a.name ?? '').localeCompare(b.name ?? '');
    });
  }, [activeTab, filteredCocktails]);

  const myTabListData = useMemo(() => {
    if (activeTab !== 'my') {
      return null;
    }

    const resolveNameFromId = (id?: number, fallback?: string): string => {
      if (id == null) {
        return (fallback ?? '').trim();
      }

      const record = ingredientLookup.ingredientById.get(id);
      return (record?.name ?? fallback ?? '').trim();
    };

    const collectIngredientOptions = (
      ingredientId: number | undefined,
      fallbackName: string | undefined,
      allowBase: boolean,
      allowBrand: boolean,
      map: Map<number, string>,
    ) => {
      if (ingredientId == null) {
        return;
      }

      const resolvedName = resolveNameFromId(ingredientId, fallbackName) || 'Unknown ingredient';
      if (!map.has(ingredientId)) {
        map.set(ingredientId, resolvedName);
      }

      const record = ingredientLookup.ingredientById.get(ingredientId);
      const baseId = normalizeIngredientId(record?.baseIngredientId);
      const allowBrandedForBase = allowBrand || baseId == null;

      if (baseId == null) {
        if (allowBrandedForBase) {
          ingredientLookup.brandsByBaseId.get(ingredientId)?.forEach((brandId) => {
            const brandName = resolveNameFromId(brandId);
            if (brandName) {
              map.set(brandId, brandName);
            }
          });
        }
        return;
      }

      if (allowBase) {
        const baseName = resolveNameFromId(baseId);
        if (baseName) {
          map.set(baseId, baseName);
        }
      }

      if (allowBrandedForBase) {
        ingredientLookup.brandsByBaseId.get(baseId)?.forEach((brandId) => {
          const brandName = resolveNameFromId(brandId);
          if (brandName) {
            map.set(brandId, brandName);
          }
        });
      }
    };

    const groups = new Map<
      number,
      {
        name: string;
        photoUri?: string | null;
        tagColor?: string;
        cocktails: Cocktail[];
        keys: Set<string>;
      }
    >();
    const available: Cocktail[] = [];
    const availabilityMap = new Map<string, boolean>();

    filteredCocktails.forEach((cocktail) => {
      const recipe = cocktail.ingredients ?? [];
      const requiredIngredients = recipe.filter(
        (item) => item && !item.optional && !(ignoreGarnish && item.garnish),
      );

      if (requiredIngredients.length === 0) {
        return;
      }

      let missingCount = 0;
      let missingOptions: IngredientOption[] = [];

      requiredIngredients.forEach((ingredient) => {
        const allowBase = Boolean(ingredient.allowBaseSubstitution || allowAllSubstitutes);
        const allowBrand = Boolean(ingredient.allowBrandSubstitution || allowAllSubstitutes);
        const candidateMap = new Map<number, string>();
        const requestedId = normalizeIngredientId(ingredient.ingredientId);
        const requestedName = resolveNameFromId(requestedId, ingredient.name ?? undefined);

        collectIngredientOptions(
          requestedId,
          requestedName,
          allowBase,
          allowBrand,
          candidateMap,
        );

        (ingredient.substitutes ?? []).forEach((substitute) => {
          const substituteId = normalizeIngredientId(substitute.ingredientId);
          const substituteName = substitute.name ?? requestedName;
          collectIngredientOptions(
            substituteId,
            substituteName,
            allowBase,
            allowBrand,
            candidateMap,
          );
        });

        const candidateOptions = Array.from(candidateMap.entries()).map(([id, name]) => ({
          id,
          name,
        }));

        const isSatisfied = candidateOptions.some((option) =>
          availableIngredientIds.has(option.id),
        );

        if (!isSatisfied) {
          missingCount += 1;
          if (missingCount === 1) {
            missingOptions = candidateOptions;
          }
        }
      });

      const cocktailKey = String(cocktail.id ?? cocktail.name);
      if (missingCount === 0) {
        available.push(cocktail);
        availabilityMap.set(cocktailKey, true);
        return;
      }

      availabilityMap.set(cocktailKey, false);

      if (missingCount !== 1) {
        return;
      }

      missingOptions.forEach((option) => {
        if (option.id == null) {
          return;
        }

        const ingredientRecord = ingredientLookup.ingredientById.get(option.id);
        const group = groups.get(option.id) ?? {
          name: option.name,
          photoUri: ingredientRecord?.photoUri ?? null,
          tagColor: ingredientRecord?.tags?.[0]?.color ?? tagColors.yellow,
          isBranded: ingredientRecord?.baseIngredientId != null,
          cocktails: [],
          keys: new Set<string>(),
        };

        if (!group.keys.has(cocktailKey)) {
          group.cocktails.push(cocktail);
          group.keys.add(cocktailKey);
        }

        groups.set(option.id, group);
      });
    });

    const sortedGroups = Array.from(groups.entries())
      .map(([ingredientId, group]) => ({
        ingredientId,
        name: group.name,
        photoUri: group.photoUri,
        tagColor: group.tagColor,
        isBranded: group.isBranded,
        cocktails: group.cocktails.sort((a, b) =>
          (a.name ?? '').localeCompare(b.name ?? ''),
        ),
      }))
      .sort((a, b) => {
        if (a.cocktails.length !== b.cocktails.length) {
          return b.cocktails.length - a.cocktails.length;
        }
        return a.name.localeCompare(b.name);
      });

    const items: MyTabListItem[] = [];
    available.forEach((cocktail) => {
      items.push({
        type: 'cocktail',
        key: `cocktail-${cocktail.id ?? cocktail.name}`,
        cocktail,
      });
    });

    if (sortedGroups.length > 0) {
      items.push({ type: 'separator', key: 'more-ingredients-needed' });
      sortedGroups.forEach((group) => {
        items.push({
          type: 'ingredient-header',
          key: `ingredient-${group.ingredientId}`,
          ingredientId: group.ingredientId,
          name: group.name,
          photoUri: group.photoUri,
          tagColor: group.tagColor,
          cocktailCount: group.cocktails.length,
          isBranded: group.isBranded,
        });
        group.cocktails.forEach((cocktail) => {
          items.push({
            type: 'cocktail',
            key: `cocktail-${cocktail.id ?? cocktail.name}-missing-${group.ingredientId}`,
            cocktail,
          });
        });
      });
    }

    return { items, availabilityMap };
  }, [
    activeTab,
    allowAllSubstitutes,
    availableIngredientIds,
    filteredCocktails,
    ignoreGarnish,
    ingredientLookup,
  ]);

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

  const renderItem = useCallback(
    ({ item }: { item: Cocktail }) => (
      <CocktailListRow
        cocktail={item}
        availableIngredientIds={availableIngredientIds}
        ingredientLookup={ingredientLookup}
        ignoreGarnish={ignoreGarnish}
        allowAllSubstitutes={allowAllSubstitutes}
        showMethodIcons
        onPress={() => handleSelectCocktail(item)}
      />
    ),
    [
      availableIngredientIds,
      allowAllSubstitutes,
      effectiveScheme,
      handleSelectCocktail,
      ignoreGarnish,
      ingredientLookup,
    ],
  );

  const renderMyItem = useCallback(
    ({ item }: { item: MyTabListItem }) => {
      if (item.type === 'separator') {
        return (
          <View style={styles.moreIngredientsWrapper}>
            <Text style={[styles.moreIngredientsLabel, { color: Colors.onSurfaceVariant }]}>
              More ingredients needed
            </Text>
          </View>
        );
      }

      if (item.type === 'ingredient-header') {
        const isOnShoppingList = shoppingIngredientIds.has(item.ingredientId);
        const accessibilityLabel = isOnShoppingList
          ? 'Remove ingredient from shopping list'
          : 'Add ingredient to shopping list';
        const subtitleLabel = `Make ${item.cocktailCount} ${
          item.cocktailCount === 1 ? 'cocktail' : 'cocktails'
        }`;
        const thumbnail = <Thumb label={item.name} uri={item.photoUri ?? undefined} />;
        const brandIndicatorColor = item.isBranded ? Colors.primary : undefined;

        return (
          <ListRow
            title={item.name}
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

      return (
        <CocktailListRow
          cocktail={item.cocktail}
          availableIngredientIds={availableIngredientIds}
          ingredientLookup={ingredientLookup}
          ignoreGarnish={ignoreGarnish}
          allowAllSubstitutes={allowAllSubstitutes}
          showMethodIcons
          onPress={() => handleSelectCocktail(item.cocktail)}
        />
      );
    },
    [
      allowAllSubstitutes,
      availableIngredientIds,
      effectiveScheme,
      handleSelectCocktail,
      handleSelectIngredient,
      handleShoppingToggle,
      ignoreGarnish,
      ingredientLookup,
      Colors.onSurface,
      Colors.onSurfaceVariant,
      Colors.outlineVariant,
      Colors.tint,
      shoppingIngredientIds,
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
      availableIngredientIds,
      allowAllSubstitutes,
      effectiveScheme,
      ignoreGarnish,
      ingredientLookup,
      Colors.outline,
      Colors.outlineVariant,
    ],
  );

  const renderMySeparator = useCallback(
    ({ leadingItem }: { leadingItem?: MyTabListItem | null }) => {
      if (!leadingItem || leadingItem.type !== 'cocktail') {
        return null;
      }

      const cocktailKey = String(leadingItem.cocktail.id ?? leadingItem.cocktail.name);
      const isReady = myTabListData?.availabilityMap.get(cocktailKey) ?? false;
      const backgroundColor = isReady ? Colors.outline : Colors.outlineVariant;

      return <View style={[styles.divider, { backgroundColor }]} />;
    },
    [myTabListData, effectiveScheme, Colors.outline, Colors.outlineVariant],
  );

  const isFilterActive = selectedTagKeys.size > 0 || selectedMethodIds.size > 0;
  const isMyTab = activeTab === 'my';
  const listData = isMyTab ? myTabListData?.items ?? [] : sortedFavorites;
  const emptyMessage = useMemo(() => {
      switch (activeTab) {
        case 'my':
          return 'Mark ingredients you have to see available cocktails here.';
        case 'favorites':
          return 'Rate cocktails and/or adjust the rating threshold in the menu.';
        default:
          return 'No cocktails yet';
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
              {/* Allow filter taps to work even if the search input keeps focus/keyboard open. */}
              <ScrollView
                style={styles.filterMenuScroll}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled">
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
                    <Text style={[styles.filterMenuClearLabel, { color: Colors.tint }]}>Clear filters</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>
          </>
        ) : null}
        <FlatList
          ref={listRef}
          data={listData}
          extraData={effectiveScheme}
          keyExtractor={isMyTab ? myTabKeyExtractor : keyExtractor}
          renderItem={isMyTab ? renderMyItem : renderItem}
          ItemSeparatorComponent={isMyTab ? renderMySeparator : renderSeparator}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator
          keyboardDismissMode="on-drag"
          // Ensure first tap triggers row actions while dismissing the keyboard.
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <Text style={[styles.emptyLabel, { color: Colors.onSurfaceVariant }]}>
              {emptyMessage}
            </Text>
          }
        />
      </View>
      <FabAdd
        label="Add cocktail"
        onPress={() =>
          router.push({ pathname: '/cocktails/create', params: { source: 'cocktails' } })
        }
      />
      <SideMenuDrawer visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </SafeAreaView>
  );
}

const createStyles = () =>
  StyleSheet.create({
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
    paddingVertical: 12,
  },
  moreIngredientsLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
  methodIconWrapper: {
    width: METHOD_ICON_SIZE,
    height: METHOD_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muddleIcon: {
    transform: [{ scaleX: 2 }],
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
  });
