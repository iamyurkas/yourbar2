import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListRow, PresenceCheck, Thumb } from '@/components/RowParts';
import { SideMenuDrawer } from '@/components/SideMenuDrawer';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import { Colors } from '@/constants/theme';
import { isCocktailReady } from '@/libs/cocktail-availability';
import { createIngredientLookup, resolveIngredientAvailability } from '@/libs/ingredient-availability';
import { useInventory, type Cocktail, type Ingredient } from '@/providers/inventory-provider';
import { palette } from '@/theme/theme';

type IngredientGroup = {
  key: string;
  label: string;
  color: string;
  ingredients: Ingredient[];
};

type GroupListItem = { type: 'group'; group: IngredientGroup; expanded: boolean };
type IngredientListItem = { type: 'ingredient'; ingredient: Ingredient; groupColor: string };
type ListItem = GroupListItem | IngredientListItem;

type ShakerIngredientRowProps = {
  ingredient: Ingredient;
  groupColor: string;
  availableIngredientIds: Set<number>;
  highlightColor: string;
  onToggleAvailability: (id: number) => void;
  totalCocktailCounts: Map<number, number>;
  makeableCocktailCounts: Map<number, number>;
  getBaseGroupId: (id?: number | string | null) => number | undefined;
};

type ShakerHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onMenuPress: () => void;
  inStockOnly: boolean;
  onToggleInStockOnly: () => void;
};

type NormalizedQuery = { text: string; tokens: string[] };

const FALLBACK_TAG = { key: 'other', label: 'Other', color: palette.tagYellow ?? palette.highlightSubtle };

function resolveCocktailKey(cocktail: Cocktail) {
  const id = cocktail.id;
  if (id != null) {
    return String(id);
  }

  if (cocktail.name) {
    return cocktail.name.trim().toLowerCase();
  }

  return undefined;
}

function parseQuery(value: string): NormalizedQuery {
  const text = value.trim().toLowerCase();
  const tokens = text ? text.split(/\s+/).filter(Boolean) : [];
  return { text, tokens };
}

function ingredientMatchesQuery(ingredient: Ingredient, normalized: NormalizedQuery) {
  if (!normalized.text) {
    return true;
  }

  if (normalized.tokens.length <= 1) {
    const token = normalized.tokens[0] ?? normalized.text;
    return ingredient.searchNameNormalized.includes(token);
  }

  return normalized.tokens.every(
    (token) =>
      ingredient.searchTokensNormalized.includes(token) ||
      ingredient.searchNameNormalized.includes(token),
  );
}

export default function ShakerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    ingredients,
    cocktails,
    availableIngredientIds,
    ignoreGarnish,
    allowAllSubstitutes,
    toggleIngredientAvailability,
    clearAvailableIngredients,
  } = useInventory();
  const [query, setQuery] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [, startAvailabilityTransition] = useTransition();
  const paletteColors = Colors;
  const ingredientLookup = useMemo(() => createIngredientLookup(ingredients), [ingredients]);
  const normalizedQuery = useMemo(() => parseQuery(query), [query]);

  const builtinTagOrder = useMemo(() => {
    const orderMap = new Map<string, number>();
    BUILTIN_INGREDIENT_TAGS.forEach((tag, index) => {
      orderMap.set(String(tag.id), index);
      if (tag.name) {
        orderMap.set(tag.name.trim().toLowerCase(), index);
      }
    });
    return orderMap;
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

  const getBaseGroupId = useCallback(
    (rawId?: number | string | null) => {
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

  const cocktailsByBaseGroup = useMemo(() => {
    const map = new Map<number, Set<string>>();

    cocktails.forEach((cocktail) => {
      const cocktailKey = resolveCocktailKey(cocktail);
      if (!cocktailKey) {
        return;
      }

      const seen = new Set<number>();
      (cocktail.ingredients ?? []).forEach((item) => {
        const baseGroupId = getBaseGroupId(item?.ingredientId);
        if (baseGroupId == null || seen.has(baseGroupId)) {
          return;
        }

        seen.add(baseGroupId);
        let set = map.get(baseGroupId);
        if (!set) {
          set = new Set<string>();
          map.set(baseGroupId, set);
        }

        set.add(cocktailKey);
      });
    });

    return map;
  }, [cocktails, getBaseGroupId]);

  const totalCocktailCounts = useMemo(() => {
    const counts = new Map<number, number>();
    cocktailsByBaseGroup.forEach((cocktailKeys, baseId) => {
      counts.set(baseId, cocktailKeys.size);
    });
    return counts;
  }, [cocktailsByBaseGroup]);

  const { readyIds, readyKeys } = useMemo(() => {
    const readyCocktailIds = new Set<number>();
    const readyCocktailKeys = new Set<string>();

    cocktails.forEach((cocktail) => {
      const ready = isCocktailReady(cocktail, availableIngredientIds, ingredientLookup, ingredients, {
        ignoreGarnish,
        allowAllSubstitutes,
      });
      if (!ready) {
        return;
      }

      const id = Number(cocktail.id ?? -1);
      if (Number.isFinite(id) && id >= 0) {
        readyCocktailIds.add(id);
      }

      const cocktailKey = resolveCocktailKey(cocktail);
      if (cocktailKey) {
        readyCocktailKeys.add(cocktailKey);
      }
    });

    return { readyIds: readyCocktailIds, readyKeys: readyCocktailKeys };
  }, [
    allowAllSubstitutes,
    availableIngredientIds,
    cocktails,
    ignoreGarnish,
    ingredientLookup,
    ingredients,
  ]);

  const makeableCocktailCounts = useMemo(() => {
    const counts = new Map<number, number>();
    cocktailsByBaseGroup.forEach((cocktailKeys, baseId) => {
      let count = 0;
      cocktailKeys.forEach((key) => {
        if (readyKeys.has(key)) {
          count += 1;
        }
      });
      counts.set(baseId, count);
    });
    return counts;
  }, [cocktailsByBaseGroup, readyKeys]);

  const matchingCocktailIds = useMemo(() => {
    if (availableIngredientIds.size === 0) {
      return new Set<number>();
    }

    const matchingIds = new Set<number>();

    cocktails.forEach((cocktail) => {
      const requiredIngredients = (cocktail.ingredients ?? []).filter(
        (ingredient) => !ingredient?.optional && !(ignoreGarnish && ingredient?.garnish),
      );

      if (requiredIngredients.length === 0) {
        return;
      }

      const hasAnyAvailable = requiredIngredients.some((ingredient) => {
        const resolution = resolveIngredientAvailability(
          ingredient,
          availableIngredientIds,
          ingredientLookup,
          { ignoreGarnish, allowAllSubstitutes },
        );

        return resolution.isAvailable;
      });

      if (!hasAnyAvailable) {
        return;
      }

      const id = Number(cocktail.id ?? -1);
      if (Number.isFinite(id) && id >= 0) {
        matchingIds.add(id);
      }
    });

    return matchingIds;
  }, [
    allowAllSubstitutes,
    availableIngredientIds,
    cocktails,
    ignoreGarnish,
    ingredientLookup,
  ]);

  const groupedIngredients = useMemo<IngredientGroup[]>(() => {
    const groups = new Map<string, IngredientGroup>();

    ingredients.forEach((ingredient) => {
      const name = ingredient.name?.trim();
      if (!name) {
        return;
      }

      const id = Number(ingredient.id ?? -1);
      if (!Number.isFinite(id) || id < 0) {
        return;
      }

      if (inStockOnly && !availableIngredientIds.has(id)) {
        return;
      }

      if (!ingredientMatchesQuery(ingredient, normalizedQuery)) {
        return;
      }

      const primaryTag = ingredient.tags?.[0];
      const key =
        primaryTag?.id != null
          ? String(primaryTag.id)
          : primaryTag?.name?.toLowerCase() ?? FALLBACK_TAG.key;
      const label = primaryTag?.name ?? FALLBACK_TAG.label;
      const color = primaryTag?.color ?? FALLBACK_TAG.color;

      let group = groups.get(key);
      if (!group) {
        group = { key, label, color, ingredients: [] };
        groups.set(key, group);
      }

      group.ingredients.push(ingredient);
    });

    const sorted = Array.from(groups.values()).sort((a, b) => {
      const normalizedNameA = a.label.trim().toLowerCase();
      const normalizedNameB = b.label.trim().toLowerCase();
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

    sorted.forEach((group) => {
      group.ingredients.sort((a, b) => a.searchNameNormalized.localeCompare(b.searchNameNormalized));
    });

    return sorted;
  }, [
    ingredients,
    inStockOnly,
    availableIngredientIds,
    normalizedQuery,
    builtinTagOrder,
  ]);

  useEffect(() => {
    setExpandedGroups((previous) => {
      const validKeys = new Set(groupedIngredients.map((group) => group.key));
      if (validKeys.size === 0) {
        return previous;
      }

      const next = new Set(previous);
      let didChange = false;

      previous.forEach((key) => {
        if (!validKeys.has(key)) {
          next.delete(key);
          didChange = true;
        }
      });

      groupedIngredients.forEach((group) => {
        if (!next.has(group.key)) {
          next.add(group.key);
          didChange = true;
        }
      });

      if (previous.size === 0 && groupedIngredients.length > 0) {
        return next;
      }

      return didChange ? next : previous;
    });
  }, [groupedIngredients]);

  const listData = useMemo<ListItem[]>(() => {
    return groupedIngredients.flatMap<ListItem>((group) => {
      const expanded = expandedGroups.has(group.key);
      const header: GroupListItem = { type: 'group', group, expanded };

      if (!expanded) {
        return [header];
      }

      const items: ListItem[] = group.ingredients.map((ingredient) => ({
        type: 'ingredient',
        ingredient,
        groupColor: group.color,
      }));

      return [header, ...items];
    });
  }, [expandedGroups, groupedIngredients]);

  const handleToggleAvailability = useCallback(
    (id: number) => {
      startAvailabilityTransition(() => {
        toggleIngredientAvailability(id);
      });
    },
    [startAvailabilityTransition, toggleIngredientAvailability],
  );

  const handleToggleGroup = useCallback((key: string) => {
    setExpandedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    clearAvailableIngredients();
  }, [clearAvailableIngredients]);

  const handleShowResults = useCallback(() => {
    if (matchingCocktailIds.size === 0) {
      return;
    }

    const readyParam = Array.from(readyIds).join(',');
    const matchingParam = Array.from(matchingCocktailIds).join(',');

    router.push({
      pathname: '/shaker/results',
      params: {
        readyIds: readyParam,
        matchingIds: matchingParam,
      },
    });
  }, [matchingCocktailIds, readyIds, router]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ListItem>) => {
      if (item.type === 'group') {
        const { group, expanded } = item;
        const groupBackground = `${group.color}26`;
        const borderColor = `${group.color}55`;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={() => handleToggleGroup(group.key)}
            style={[
              styles.groupHeader,
              {
                backgroundColor: groupBackground,
                borderColor,
                marginBottom: expanded ? 8 : 12,
              },
            ]}>
            <Text style={[styles.groupTitle, { color: paletteColors.onSurface }]}>{group.label}</Text>
            <MaterialCommunityIcons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={paletteColors.onSurface}
            />
          </Pressable>
        );
      }

      return (
        <ShakerIngredientRow
          ingredient={item.ingredient}
          groupColor={item.groupColor}
          availableIngredientIds={availableIngredientIds}
          highlightColor={palette.highlightFaint}
          onToggleAvailability={handleToggleAvailability}
          totalCocktailCounts={totalCocktailCounts}
          makeableCocktailCounts={makeableCocktailCounts}
          getBaseGroupId={getBaseGroupId}
        />
      );
    },
    [
      availableIngredientIds,
      getBaseGroupId,
      handleToggleAvailability,
      handleToggleGroup,
      makeableCocktailCounts,
      paletteColors.onSurface,
      totalCocktailCounts,
    ],
  );

  const keyExtractor = useCallback((item: ListItem) => {
    if (item.type === 'group') {
      return `group-${item.group.key}`;
    }

    const id = item.ingredient.id ?? item.ingredient.name;
    return `ingredient-${id}`;
  }, []);

  const cocktailsAvailableCount = readyIds.size;
  const recipesAvailableCount = matchingCocktailIds.size;
  const showDisabled = recipesAvailableCount === 0;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: paletteColors.background }]}
      edges={['top', 'left', 'right']}>
      <View style={styles.screen}>
        <ShakerHeader
          query={query}
          onQueryChange={setQuery}
          onMenuPress={() => setIsMenuOpen(true)}
          inStockOnly={inStockOnly}
          onToggleInStockOnly={() => setInStockOnly((prev) => !prev)}
        />
        <FlatList
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom: 160 + Math.max(insets.bottom, 12),
            },
          ]}
          ListEmptyComponent={
            <Text style={[styles.emptyLabel, { color: paletteColors.onSurfaceVariant }]}>
              Mark which ingredients are in stock first
            </Text>
          }
          showsVerticalScrollIndicator={false}
        />
      </View>
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: paletteColors.surface,
            borderColor: paletteColors.outline,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear selected ingredients"
          onPress={handleClearSelection}
          style={[styles.clearButton, { borderColor: paletteColors.error }]}>
          <Text style={[styles.clearLabel, { color: paletteColors.error }]}>Clear</Text>
        </Pressable>
        <View style={styles.counterBlock}>
          <Text style={[styles.counterTitle, { color: paletteColors.onSurface }]} numberOfLines={1}>
            Cocktails available: {cocktailsAvailableCount}
          </Text>
          <Text style={[styles.counterSubtitle, { color: paletteColors.onSurfaceVariant }]} numberOfLines={1}>
            (recipes available: {recipesAvailableCount})
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show cocktail results"
          disabled={showDisabled}
          onPress={handleShowResults}
          style={({ pressed }) => [
            styles.showButton,
            {
              backgroundColor: showDisabled ? paletteColors.outlineVariant : paletteColors.tint,
              opacity: pressed && !showDisabled ? 0.9 : 1,
            },
          ]}>
          <Text
            style={[
              styles.showLabel,
              { color: showDisabled ? paletteColors.onSurfaceVariant : paletteColors.background },
            ]}>
            Show
          </Text>
        </Pressable>
      </View>
      <SideMenuDrawer visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </SafeAreaView>
  );
}

function ShakerIngredientRow({
  ingredient,
  groupColor,
  availableIngredientIds,
  highlightColor,
  onToggleAvailability,
  totalCocktailCounts,
  makeableCocktailCounts,
  getBaseGroupId,
}: ShakerIngredientRowProps) {
  const ingredientId = Number(ingredient.id ?? -1);
  const isAvailable = ingredientId >= 0 && availableIngredientIds.has(ingredientId);
  const baseGroupId = ingredientId >= 0 ? getBaseGroupId(ingredientId) : undefined;
  const makeableCount = baseGroupId != null ? makeableCocktailCounts.get(baseGroupId) ?? 0 : 0;
  const totalCount = baseGroupId != null ? totalCocktailCounts.get(baseGroupId) ?? 0 : 0;

  const handleToggle = useCallback(() => {
    if (ingredientId >= 0) {
      onToggleAvailability(ingredientId);
    }
  }, [ingredientId, onToggleAvailability]);

  const subtitle = useMemo(() => {
    if (isAvailable && makeableCount > 0) {
      const label = makeableCount === 1 ? 'cocktail' : 'cocktails';
      return `Make ${makeableCount} ${label}`;
    }

    if (totalCount > 0) {
      const label = totalCount === 1 ? 'recipe' : 'recipes';
      return `${totalCount} ${label}`;
    }

    return undefined;
  }, [isAvailable, makeableCount, totalCount]);

  const thumbnail = useMemo(
    () => <Thumb label={ingredient.name} uri={ingredient.photoUri} />,
    [ingredient.name, ingredient.photoUri],
  );

  const control = useMemo(() => {
    return <PresenceCheck checked={isAvailable} onToggle={handleToggle} />;
  }, [handleToggle, isAvailable]);

  const brandIndicatorColor = ingredient.baseIngredientId != null ? Colors.primary : undefined;

  return (
    <ListRow
      title={ingredient.name ?? 'Unknown ingredient'}
      subtitle={subtitle}
      selected={isAvailable}
      highlightColor={highlightColor}
      tagColor={groupColor}
      thumbnail={thumbnail}
      control={control}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isAvailable }}
      metaAlignment="center"
      brandIndicatorColor={brandIndicatorColor}
    />
  );
}

function ShakerHeader({
  query,
  onQueryChange,
  onMenuPress,
  inStockOnly,
  onToggleInStockOnly,
}: ShakerHeaderProps) {
  const paletteColors = Colors;

  return (
    <View
      style={[
        styles.topBar,
        {
          backgroundColor: paletteColors.background,
          borderBottomColor: paletteColors.outline,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open navigation"
        onPress={onMenuPress}
        style={styles.iconButton}>
        <MaterialCommunityIcons name="menu" size={24} color={paletteColors.onSurface} />
      </Pressable>
      <View style={[styles.searchContainer, { backgroundColor: paletteColors.surface, borderColor: paletteColors.background }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={paletteColors.onSurface} style={styles.searchIcon} />
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search ingredients"
          placeholderTextColor={`${paletteColors.onSurfaceVariant}99`}
          returnKeyType="search"
          style={[styles.searchInput, { color: paletteColors.text, fontWeight: '400' }]}
        />
        {query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search query"
            onPress={() => onQueryChange('')}
            style={styles.searchClearButton}>
            <MaterialCommunityIcons name="close" size={18} color={paletteColors.onSurface} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: inStockOnly }}
        accessibilityLabel="Show in-stock ingredients only"
        onPress={onToggleInStockOnly}
        style={[
          styles.filterToggle,
          {
            backgroundColor: inStockOnly ? `${paletteColors.tint}1A` : paletteColors.surface,
            borderColor: inStockOnly ? `${paletteColors.tint}66` : paletteColors.outlineVariant,
          },
        ]}>
        <MaterialCommunityIcons
          name={inStockOnly ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
          size={20}
          color={inStockOnly ? paletteColors.tint : paletteColors.icon}
        />
        <Text style={[styles.filterToggleLabel, { color: paletteColors.onSurface }]}>In stock only</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 0,
  },
  itemSeparator: {
    height: 8,
  },
  groupHeader: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  emptyLabel: {
    textAlign: 'center',
    fontSize: 14,
    marginTop: 80,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  clearButton: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  clearLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  counterBlock: {
    flex: 1,
    alignItems: 'center',
  },
  counterTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  counterSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  showButton: {
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  showLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  searchClearButton: {
    width: 28,
    height: 28,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterToggleLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
});
