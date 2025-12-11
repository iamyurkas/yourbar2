import { MaterialIcons } from '@expo/vector-icons';
import React, { memo, useCallback, useEffect, useMemo, useState, useTransition } from 'react';
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

import { CollectionHeader } from '@/components/CollectionHeader';
import { FabAdd } from '@/components/FabAdd';
import { ListRow, PresenceCheck, Thumb } from '@/components/RowParts';
import { TagPill } from '@/components/TagPill';
import type { SegmentTabOption } from '@/components/TopBars';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import { Colors } from '@/constants/theme';
import { useInventory, type Cocktail, type Ingredient } from '@/providers/inventory-provider';
import { palette } from '@/theme/theme';
import { useRouter } from 'expo-router';

type IngredientSection = {
  key: string;
  label: string;
  data: Ingredient[];
};

type IngredientTabKey = 'all' | 'my' | 'shopping';

const TAB_OPTIONS: SegmentTabOption[] = [
  { key: 'all', label: 'All' },
  { key: 'my', label: 'My' },
  { key: 'shopping', label: 'Shopping' },
];

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
  prev.onShoppingToggle === next.onShoppingToggle;

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
}: IngredientListItemProps) {
  const router = useRouter();
  const id = Number(ingredient.id ?? -1);
  const isAvailable = id >= 0 && availableIngredientIds.has(id);
  const tagColor = ingredient.tags?.[0]?.color ?? palette.tagYellow;

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

  const control = useMemo(() => {
    const shoppingLabel = onShoppingToggle ? 'Remove from shopping list' : 'On shopping list';
    const isShoppingTab = Boolean(onShoppingToggle);
    const shoppingIconName = isShoppingTab ? 'remove-shopping-cart' : 'shopping-cart';
    const shoppingIconColor = isShoppingTab ? Colors.error : Colors.tint;
    const shoppingIconContent = isOnShoppingList
      ? onShoppingToggle
        ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={shoppingLabel}
              onPress={handleShoppingToggle}
              hitSlop={8}
              style={({ pressed }) => [
                styles.shoppingButton,
                pressed ? styles.shoppingButtonPressed : null,
              ]}>
              <MaterialIcons
                name={shoppingIconName}
                size={16}
                color={shoppingIconColor}
                style={styles.shoppingIcon}
              />
            </Pressable>
          )
        : (
            <MaterialIcons
              name={shoppingIconName}
              size={16}
              color={shoppingIconColor}
              style={styles.shoppingIcon}
              accessibilityRole="image"
              accessibilityLabel={shoppingLabel}
            />
          )
      : null;

    return (
      <View
        style={[
          styles.controlContainer,
          showAvailabilityToggle
            ? styles.controlContainerWithToggle
            : styles.controlContainerShoppingOnly,
        ]}>
        <View style={styles.controlTopSpacer} />
        <View style={styles.presenceSlot}>
          {showAvailabilityToggle ? (
            <PresenceCheck checked={isAvailable} onToggle={handleToggleAvailability} />
          ) : (
            <View style={styles.presencePlaceholder} />
          )}
        </View>
        <View style={styles.shoppingSlot}>
          {shoppingIconContent ?? <View style={styles.shoppingIconPlaceholder} />}
        </View>
      </View>
    );
  }, [
    handleShoppingToggle,
    handleToggleAvailability,
    isAvailable,
    isOnShoppingList,
    onShoppingToggle,
    showAvailabilityToggle,
  ]);

  const handlePress = useCallback(() => {
    const routeParam = ingredient.id ?? ingredient.name;
    if (routeParam == null) {
      return;
    }

    router.push({
      pathname: '/ingredient/[ingredientId]',
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
      accessibilityState={
        showAvailabilityToggle && isAvailable ? { selected: true } : undefined
      }
      thumbnail={thumbnail}
      control={control}
      brandIndicatorColor={brandIndicatorColor}
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
  } = useInventory();
  const [activeTab, setActiveTab] = useState<IngredientTabKey>('all');
  const [query, setQuery] = useState('');
  const [isFilterMenuVisible, setFilterMenuVisible] = useState(false);
  const [selectedTagKeys, setSelectedTagKeys] = useState<Set<string>>(() => new Set());
  const [headerLayout, setHeaderLayout] = useState<LayoutRectangle | null>(null);
  const [filterAnchorLayout, setFilterAnchorLayout] = useState<LayoutRectangle | null>(null);
  const [optimisticAvailability, setOptimisticAvailability] = useState<Map<number, boolean>>(
    () => new Map(),
  );
  const [, startAvailabilityTransition] = useTransition();
  const paletteColors = Colors;
  const defaultTagColor = palette.tagYellow ?? palette.highlightSubtle;

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

  const ingredientById = useMemo(() => {
    const map = new Map<number, Ingredient>();
    ingredients.forEach((ingredient) => {
      const id = Number(ingredient.id ?? -1);
      if (!Number.isFinite(id) || id < 0) {
        return;
      }
      map.set(id, ingredient);
    });
    return map;
  }, [ingredients]);

  const ingredientsByBaseId = useMemo(() => {
    const map = new Map<number, Set<number>>();

    ingredients.forEach((ingredient) => {
      const id = Number(ingredient.id ?? -1);
      if (!Number.isFinite(id) || id < 0) {
        return;
      }

      const baseIdRaw =
        ingredient.baseIngredientId != null ? Number(ingredient.baseIngredientId) : id;
      if (!Number.isFinite(baseIdRaw) || baseIdRaw < 0) {
        return;
      }

      const baseId = baseIdRaw;
      let group = map.get(baseId);
      if (!group) {
        group = new Set<number>();
        map.set(baseId, group);
      }

      group.add(baseId);
      group.add(id);
    });

    return map;
  }, [ingredients]);

  const getBaseGroupId = useCallback(
    (rawId: number | string | null | undefined) => {
      if (rawId == null) {
        return undefined;
      }

      const id = Number(rawId);
      if (!Number.isFinite(id) || id < 0) {
        return undefined;
      }

      const ingredientRecord = ingredientById.get(id);
      if (ingredientRecord?.baseIngredientId != null) {
        const baseId = Number(ingredientRecord.baseIngredientId);
        if (Number.isFinite(baseId) && baseId >= 0) {
          return baseId;
        }
      }

      if (ingredientRecord?.id != null) {
        const normalizedId = Number(ingredientRecord.id);
        if (Number.isFinite(normalizedId) && normalizedId >= 0) {
          return normalizedId;
        }
      }

      return id;
    },
    [ingredientById],
  );

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

  const cocktailsByBaseGroup = useMemo(() => {
    const map = new Map<number, Set<string>>();

    cocktails.forEach((cocktail) => {
      const cocktailKey = resolveCocktailKey(cocktail);
      if (!cocktailKey) {
        return;
      }

      const seenBaseIds = new Set<number>();
      (cocktail.ingredients ?? []).forEach((item) => {
        const baseGroupId = getBaseGroupId(item.ingredientId);
        if (baseGroupId == null || seenBaseIds.has(baseGroupId)) {
          return;
        }

        seenBaseIds.add(baseGroupId);
        let set = map.get(baseGroupId);
        if (!set) {
          set = new Set<string>();
          map.set(baseGroupId, set);
        }

        set.add(cocktailKey);
      });
    });

    return map;
  }, [cocktails, getBaseGroupId, resolveCocktailKey]);

  const expandIngredientIds = useCallback(
    (rawId: number | string | null | undefined, target: Set<number>) => {
      if (rawId == null) {
        return;
      }

      const id = Number(rawId);
      if (!Number.isFinite(id) || id < 0) {
        return;
      }

      const baseGroupId = getBaseGroupId(id);
      if (baseGroupId == null) {
        return;
      }

      const candidates = ingredientsByBaseId.get(baseGroupId);
      if (candidates && candidates.size > 0) {
        candidates.forEach((candidateId) => target.add(candidateId));
        return;
      }

      target.add(baseGroupId);
    },
    [getBaseGroupId, ingredientsByBaseId],
  );

  const canMakeCocktail = useCallback(
    (cocktail: Cocktail) => {
      const recipe = cocktail.ingredients ?? [];
      const requiredIngredients = recipe.filter((ingredient) => !ingredient?.optional && !ingredient?.garnish);

      if (requiredIngredients.length === 0) {
        return false;
      }

      return requiredIngredients.every((ingredient) => {
        const candidateIds = new Set<number>();
        expandIngredientIds(ingredient.ingredientId, candidateIds);
        (ingredient.substitutes ?? []).forEach((substitute) => {
          expandIngredientIds(substitute.id, candidateIds);
        });

        if (candidateIds.size === 0) {
          return false;
        }

        for (const candidateId of candidateIds) {
          if (availableIngredientIds.has(candidateId)) {
            return true;
          }
        }

        return false;
      });
    },
    [availableIngredientIds, expandIngredientIds],
  );

  const makeableCocktailKeys = useMemo(() => {
    const keys = new Set<string>();

    cocktails.forEach((cocktail) => {
      const key = resolveCocktailKey(cocktail);
      if (!key) {
        return;
      }

      if (canMakeCocktail(cocktail)) {
        keys.add(key);
      }
    });

    return keys;
  }, [canMakeCocktail, cocktails, resolveCocktailKey]);

  const totalCocktailCounts = useMemo(() => {
    const counts = new Map<number, number>();
    cocktailsByBaseGroup.forEach((cocktailKeys, baseId) => {
      counts.set(baseId, cocktailKeys.size);
    });
    return counts;
  }, [cocktailsByBaseGroup]);

  const makeableCocktailCounts = useMemo(() => {
    const counts = new Map<number, number>();
    cocktailsByBaseGroup.forEach((cocktailKeys, baseId) => {
      let count = 0;
      cocktailKeys.forEach((key) => {
        if (makeableCocktailKeys.has(key)) {
          count += 1;
        }
      });
      counts.set(baseId, count);
    });
    return counts;
  }, [cocktailsByBaseGroup, makeableCocktailKeys]);

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
    const trimmed = query.trim().toLowerCase();
    const tokens = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    return { text: trimmed, tokens };
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

  const highlightColor = palette.highlightSubtle;
  const separatorColor = paletteColors.outline;
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
      const baseGroupId = ingredientId >= 0 ? getBaseGroupId(ingredientId) : undefined;
      const isOnShoppingList = ingredientId >= 0 && shoppingIngredientIds.has(ingredientId);

      const isMyTab = activeTab === 'my';
      const countsMap = isMyTab ? makeableCocktailCounts : totalCocktailCounts;
      const count = baseGroupId != null ? countsMap.get(baseGroupId) ?? 0 : 0;

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
          surfaceVariantColor={paletteColors.onSurfaceVariant ?? paletteColors.icon}
          isOnShoppingList={isOnShoppingList}
          showAvailabilityToggle={activeTab !== 'shopping'}
          onShoppingToggle={activeTab === 'shopping' ? handleShoppingToggle : undefined}
        />
      );
    },
    [
      activeTab,
      effectiveAvailableIngredientIds,
      getBaseGroupId,
      handleToggle,
      handleShoppingToggle,
      highlightColor,
      makeableCocktailCounts,
      paletteColors.icon,
      paletteColors.onSurfaceVariant,
      shoppingIngredientIds,
      totalCocktailCounts,
    ],
  );

  const renderSeparator = useCallback(
    () => <View style={[styles.divider, { backgroundColor: separatorColor }]} />,
    [separatorColor],
  );

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
                <Text style={[styles.filterMenuEmpty, { color: paletteColors.onSurfaceVariant }]}>No tags available</Text>
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
          data={filteredIngredients}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={renderSeparator}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={[styles.emptyLabel, { color: paletteColors.onSurfaceVariant }]}>No ingredients yet</Text>
          }
        />
      </View>
      <FabAdd label="Add ingredient" onPress={() => router.push('/ingredient/create')} />
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
  controlContainer: {
    alignItems: 'flex-end',
    alignSelf: 'stretch',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: 56,
    minWidth: 32,
    
  },
  controlContainerWithToggle: {},
  controlContainerShoppingOnly: {},
  controlTopSpacer: {
    height: 16,
    width: 24,
  },
  presenceSlot: {
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
  },
  presencePlaceholder: {
    height: 16,
    width: 16,
  },
  shoppingSlot: {
    height: 16,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    width: 24,
  },
  shoppingIcon: {
    width: 16,
    height: 16,
    alignSelf: 'flex-end',
  },
  shoppingIconPlaceholder: {
    width: 16,
    height: 16,
    alignSelf: 'flex-end',
  },
  shoppingButton: {
    borderRadius: 12,
    padding: 4,
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
    fontSize: 13,
    fontWeight: '600',
  },
});
