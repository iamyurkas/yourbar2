import React, { memo, useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FabAdd } from '@/components/FabAdd';
import { ListRow, PresenceCheck, Thumb } from '@/components/RowParts';
import { CollectionHeader } from '@/components/CollectionHeader';
import type { SegmentTabOption } from '@/components/TopBars';
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

type IngredientListItemProps = {
  ingredient: Ingredient;
  highlightColor: string;
  availableIngredientIds: Set<number>;
  onToggle: (id: number) => void;
  subtitle?: string;
  surfaceVariantColor?: string;
};

const areIngredientPropsEqual = (
  prev: Readonly<IngredientListItemProps>,
  next: Readonly<IngredientListItemProps>,
) =>
  prev.ingredient === next.ingredient &&
  prev.highlightColor === next.highlightColor &&
  prev.availableIngredientIds === next.availableIngredientIds &&
  prev.onToggle === next.onToggle &&
  prev.subtitle === next.subtitle &&
  prev.surfaceVariantColor === next.surfaceVariantColor;

const IngredientListItem = memo(function IngredientListItemComponent({
  ingredient,
  highlightColor,
  availableIngredientIds,
  onToggle,
  subtitle,
  surfaceVariantColor,
}: IngredientListItemProps) {
  const router = useRouter();
  const id = Number(ingredient.id ?? -1);
  const isAvailable = id >= 0 && availableIngredientIds.has(id);
  const tagColor = ingredient.tags?.[0]?.color ?? palette.tagYellow;

  const handleToggle = useCallback(() => {
    if (id >= 0) {
      onToggle(id);
    }
  }, [id, onToggle]);

  const subtitleStyle = surfaceVariantColor ? { color: surfaceVariantColor } : undefined;

  const thumbnail = useMemo(
    () => <Thumb label={ingredient.name} uri={ingredient.photoUri} />,
    [ingredient.name, ingredient.photoUri],
  );

  const control = useMemo(
    () => <PresenceCheck checked={isAvailable} onToggle={handleToggle} />,
    [handleToggle, isAvailable],
  );

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
      accessibilityState={isAvailable ? { selected: true } : undefined}
      thumbnail={thumbnail}
      control={control}
    />
  );
}, areIngredientPropsEqual);

export default function IngredientsScreen() {
  const {
    cocktails,
    ingredients,
    availableIngredientIds,
    shoppingIngredientIds,
    toggleIngredientAvailability,
  } = useInventory();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<IngredientTabKey>('all');
  const [query, setQuery] = useState('');
  const [optimisticAvailability, setOptimisticAvailability] = useState<Map<number, boolean>>(
    () => new Map(),
  );
  const [, startAvailabilityTransition] = useTransition();
  const paletteColors = Colors;

  const handleAddIngredient = useCallback(() => {
    router.push('/ingredient/create');
  }, [router]);

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

  const filteredIngredients = useMemo(() => {
    const base = activeSection.data;
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
  }, [activeSection.data, normalizedQuery]);

  const highlightColor = palette.highlightSubtle;
  const separatorColor = paletteColors.outline;

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

  const keyExtractor = useCallback((item: Ingredient) => String(item.id ?? item.name), []);

  const renderItem = useCallback(
    ({ item }: { item: Ingredient }) => {
      const ingredientId = Number(item.id ?? -1);
      const baseGroupId = ingredientId >= 0 ? getBaseGroupId(ingredientId) : undefined;

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
          onToggle={handleToggle}
          subtitle={subtitleText}
          surfaceVariantColor={paletteColors.onSurfaceVariant ?? paletteColors.icon}
        />
      );
    },
    [
      activeTab,
      effectiveAvailableIngredientIds,
      getBaseGroupId,
      handleToggle,
      highlightColor,
      makeableCocktailCounts,
      paletteColors.icon,
      paletteColors.onSurfaceVariant,
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
        <CollectionHeader
          searchValue={query}
          onSearchChange={setQuery}
          placeholder="Search"
          tabs={TAB_OPTIONS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
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
      <FabAdd label="Add ingredient" onPress={handleAddIngredient} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
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
});
