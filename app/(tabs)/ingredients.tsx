import React, { memo, useCallback, useMemo, useState } from 'react';
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

const REQUIRED_INGREDIENT_FILTER = (item: Cocktail['ingredients'][number]) =>
  !item?.optional && !item?.garnish;

function toNumericId(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function resolveCocktailKey(cocktail: Cocktail): string | undefined {
  const id = toNumericId(cocktail.id);
  if (id != null) {
    return `id:${id}`;
  }

  if (cocktail.name) {
    const trimmed = cocktail.name.trim().toLowerCase();
    if (trimmed) {
      return `name:${trimmed}`;
    }
  }

  return undefined;
}

type IngredientListItemProps = {
  ingredient: Ingredient;
  highlightColor: string;
  availableIngredientIds: Set<number>;
  onToggle: (id: number) => void;
  surfaceVariantColor?: string;
  subtitle: string;
};

const areIngredientPropsEqual = (
  prev: Readonly<IngredientListItemProps>,
  next: Readonly<IngredientListItemProps>,
) =>
  prev.ingredient === next.ingredient &&
  prev.highlightColor === next.highlightColor &&
  prev.availableIngredientIds === next.availableIngredientIds &&
  prev.onToggle === next.onToggle &&
  prev.surfaceVariantColor === next.surfaceVariantColor &&
  prev.subtitle === next.subtitle;

const IngredientListItem = memo(function IngredientListItemComponent({
  ingredient,
  highlightColor,
  availableIngredientIds,
  onToggle,
  surfaceVariantColor,
  subtitle,
}: IngredientListItemProps) {
  const router = useRouter();
  const numericId = toNumericId(ingredient.id);
  const id = numericId ?? -1;
  const isAvailable = numericId != null && availableIngredientIds.has(numericId);
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
  const [activeTab, setActiveTab] = useState<IngredientTabKey>('all');
  const [query, setQuery] = useState('');
  const paletteColors = Colors;

  const ingredientById = useMemo(() => {
    const map = new Map<number, Ingredient>();

    ingredients.forEach((ingredientItem) => {
      const numericId = toNumericId(ingredientItem.id);
      if (numericId != null && numericId >= 0) {
        map.set(numericId, ingredientItem);
      }
    });

    return map;
  }, [ingredients]);

  const brandIdsByBaseId = useMemo(() => {
    const map = new Map<number, number[]>();

    ingredients.forEach((ingredientItem) => {
      const id = toNumericId(ingredientItem.id);
      const baseId = toNumericId(ingredientItem.baseIngredientId);

      if (id == null || id < 0 || baseId == null || baseId < 0) {
        return;
      }

      const existing = map.get(baseId);
      if (existing) {
        existing.push(id);
      } else {
        map.set(baseId, [id]);
      }
    });

    return map;
  }, [ingredients]);

  const relatedIngredientIdsMap = useMemo(() => {
    const map = new Map<number, Set<number>>();

    const computeRelatedIds = (startId: number) => {
      const related = new Set<number>();
      const queue: number[] = [startId];

      while (queue.length) {
        const current = queue.pop();
        if (current == null || related.has(current)) {
          continue;
        }

        related.add(current);

        const ingredientRecord = ingredientById.get(current);
        const baseId = toNumericId(ingredientRecord?.baseIngredientId);

        if (baseId != null && baseId >= 0 && !related.has(baseId)) {
          queue.push(baseId);
        }

        const directBrands = brandIdsByBaseId.get(current);
        if (directBrands) {
          directBrands.forEach((brandId) => {
            if (!related.has(brandId)) {
              queue.push(brandId);
            }
          });
        }

        if (baseId != null && baseId >= 0) {
          const siblingBrands = brandIdsByBaseId.get(baseId);
          if (siblingBrands) {
            siblingBrands.forEach((brandId) => {
              if (!related.has(brandId)) {
                queue.push(brandId);
              }
            });
          }
        }
      }

      return related;
    };

    ingredientById.forEach((_, id) => {
      map.set(id, computeRelatedIds(id));
    });

    return map;
  }, [brandIdsByBaseId, ingredientById]);

  const cocktailIdsByIngredientId = useMemo(() => {
    const map = new Map<number, Set<string>>();

    cocktails.forEach((cocktail) => {
      const cocktailKey = resolveCocktailKey(cocktail);
      if (!cocktailKey) {
        return;
      }

      const recipe = cocktail.ingredients ?? [];
      recipe.forEach((item) => {
        const ingredientId = toNumericId(item.ingredientId);
        if (ingredientId == null || ingredientId < 0) {
          return;
        }

        const existing = map.get(ingredientId);
        if (existing) {
          existing.add(cocktailKey);
        } else {
          map.set(ingredientId, new Set([cocktailKey]));
        }
      });
    });

    return map;
  }, [cocktails]);

  const expandIngredientIds = useCallback(
    (ids: Iterable<number>) => {
      const expanded = new Set<number>();

      for (const id of ids) {
        if (id == null || !Number.isFinite(id) || id < 0) {
          continue;
        }

        expanded.add(id);

        const related = relatedIngredientIdsMap.get(id);
        if (related) {
          related.forEach((relatedId) => {
            if (relatedId != null && Number.isFinite(relatedId) && relatedId >= 0) {
              expanded.add(relatedId);
            }
          });
        }
      }

      return expanded;
    },
    [relatedIngredientIdsMap],
  );

  const makeableCocktailKeys = useMemo(() => {
    const ready = new Set<string>();

    cocktails.forEach((cocktail) => {
      const cocktailKey = resolveCocktailKey(cocktail);
      if (!cocktailKey) {
        return;
      }

      const requiredIngredients = (cocktail.ingredients ?? []).filter(REQUIRED_INGREDIENT_FILTER);
      if (!requiredIngredients.length) {
        return;
      }

      const canMake = requiredIngredients.every((recipeIngredient) => {
        const directIds = new Set<number>();
        const ingredientId = toNumericId(recipeIngredient.ingredientId);
        if (ingredientId != null) {
          directIds.add(ingredientId);
        }

        (recipeIngredient.substitutes ?? []).forEach((substitute) => {
          const substituteId = toNumericId(substitute?.id);
          if (substituteId != null) {
            directIds.add(substituteId);
          }
        });

        if (!directIds.size) {
          return false;
        }

        const expandedIds = expandIngredientIds(directIds);
        for (const candidateId of expandedIds) {
          if (availableIngredientIds.has(candidateId)) {
            return true;
          }
        }

        return false;
      });

      if (canMake) {
        ready.add(cocktailKey);
      }
    });

    return ready;
  }, [availableIngredientIds, cocktails, expandIngredientIds]);

  const cocktailCountByIngredient = useMemo(() => {
    const map = new Map<number, number>();

    ingredientById.forEach((_, id) => {
      const relatedIds = relatedIngredientIdsMap.get(id) ?? new Set([id]);
      const cocktailKeys = new Set<string>();

      relatedIds.forEach((relatedId) => {
        const usage = cocktailIdsByIngredientId.get(relatedId);
        if (usage) {
          usage.forEach((key) => {
            cocktailKeys.add(key);
          });
        }
      });

      map.set(id, cocktailKeys.size);
    });

    return map;
  }, [cocktailIdsByIngredientId, ingredientById, relatedIngredientIdsMap]);

  const makeableCocktailCountByIngredient = useMemo(() => {
    const map = new Map<number, number>();

    ingredientById.forEach((_, id) => {
      const relatedIds = relatedIngredientIdsMap.get(id) ?? new Set([id]);
      const cocktailKeys = new Set<string>();

      relatedIds.forEach((relatedId) => {
        const usage = cocktailIdsByIngredientId.get(relatedId);
        if (usage) {
          usage.forEach((key) => {
            if (makeableCocktailKeys.has(key)) {
              cocktailKeys.add(key);
            }
          });
        }
      });

      map.set(id, cocktailKeys.size);
    });

    return map;
  }, [
    cocktailIdsByIngredientId,
    ingredientById,
    makeableCocktailKeys,
    relatedIngredientIdsMap,
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

  const handleToggle = useCallback(
    (id: number) => {
      if (id >= 0) {
        toggleIngredientAvailability(id);
      }
    },
    [toggleIngredientAvailability],
  );

  const keyExtractor = useCallback((item: Ingredient) => String(item.id ?? item.name), []);

  const renderItem = useCallback(
    ({ item }: { item: Ingredient }) => {
      const ingredientId = toNumericId(item.id);
      const totalCount =
        ingredientId != null ? cocktailCountByIngredient.get(ingredientId) ?? 0 : 0;
      const makeableCount =
        ingredientId != null ? makeableCocktailCountByIngredient.get(ingredientId) ?? 0 : 0;

      const subtitleCount = activeTab === 'my' ? makeableCount : totalCount;
      const subtitle =
        activeTab === 'my'
          ? `Make ${subtitleCount} cocktail${subtitleCount === 1 ? '' : 's'}`
          : `${subtitleCount} cocktail${subtitleCount === 1 ? '' : 's'}`;

      return (
        <IngredientListItem
          ingredient={item}
          highlightColor={highlightColor}
          availableIngredientIds={availableIngredientIds}
          onToggle={handleToggle}
          surfaceVariantColor={paletteColors.onSurfaceVariant ?? paletteColors.icon}
          subtitle={subtitle}
        />
      );
    },
    [
      activeTab,
      availableIngredientIds,
      cocktailCountByIngredient,
      handleToggle,
      highlightColor,
      makeableCocktailCountByIngredient,
      paletteColors.icon,
      paletteColors.onSurfaceVariant,
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
      <FabAdd label="Add ingredient" />
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
