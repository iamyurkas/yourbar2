import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FabAdd } from '@/components/FabAdd';
import { ListRow, PresenceCheck, Thumb } from '@/components/RowParts';
import { SearchTopBar, SegmentTabs } from '@/components/TopBars';
import { Colors } from '@/constants/theme';
import { useInventory, type Ingredient } from '@/providers/inventory-provider';
import { palette } from '@/theme/theme';

type IngredientSection = {
  key: string;
  label: string;
  data: Ingredient[];
};

type IngredientTabKey = 'all' | 'my' | 'shopping';

const TAB_OPTIONS: { key: IngredientTabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'my', label: 'My' },
  { key: 'shopping', label: 'Shopping' },
];

type IngredientListItemProps = {
  ingredient: Ingredient;
  highlightColor: string;
  availableIngredientIds: Set<number>;
  onToggle: (id: number) => void;
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
  prev.surfaceVariantColor === next.surfaceVariantColor;

const IngredientListItem = memo(function IngredientListItemComponent({
  ingredient,
  highlightColor,
  availableIngredientIds,
  onToggle,
  surfaceVariantColor,
}: IngredientListItemProps) {
    const id = Number(ingredient.id ?? -1);
    const isAvailable = id >= 0 && availableIngredientIds.has(id);
    const usageCount = ingredient.usageCount ?? 0;
    const subtitle = useMemo(
      () => `${usageCount} cocktail${usageCount === 1 ? '' : 's'}`,
      [usageCount],
    );
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

    return (
      <ListRow
        title={ingredient.name}
        subtitle={subtitle}
        subtitleStyle={subtitleStyle}
        onPress={handleToggle}
        selected={isAvailable}
        highlightColor={highlightColor}
        tagColor={tagColor}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isAvailable }}
        thumbnail={thumbnail}
        control={control}
      />
    );
  }, areIngredientPropsEqual);

export default function IngredientsScreen() {
  const { ingredients, availableIngredientIds, toggleIngredientAvailability } = useInventory();
  const [activeTab, setActiveTab] = useState<IngredientTabKey>('all');
  const [query, setQuery] = useState('');
  const paletteColors = Colors.light;

  const sections = useMemo<Record<IngredientTabKey, IngredientSection>>(() => {
    const inStock = ingredients.filter((ingredient) => {
      const id = Number(ingredient.id ?? -1);
      return id >= 0 && availableIngredientIds.has(id);
    });

    const needsRestock = ingredients.filter((ingredient) => (ingredient.usageCount ?? 0) === 0);

    return {
      all: { key: 'all', label: 'All', data: ingredients },
      my: { key: 'my', label: 'My', data: inStock },
      shopping: {
        key: 'shopping',
        label: 'Shopping',
        data: needsRestock.length ? needsRestock : ingredients.slice(-12),
      },
    };
  }, [ingredients, availableIngredientIds]);

  const activeSection = sections[activeTab] ?? sections.all;

  const filteredIngredients = useMemo(() => {
    const base = activeSection.data;
    if (!query.trim()) {
      return base;
    }
    const safeQuery = query.trim().toLowerCase();
    return base.filter((ingredient) => ingredient.name.toLowerCase().includes(safeQuery));
  }, [activeSection.data, query]);

  const highlightColor = '#4A90E21F';
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
    ({ item }: { item: Ingredient }) => (
      <IngredientListItem
        ingredient={item}
        highlightColor={highlightColor}
        availableIngredientIds={availableIngredientIds}
        onToggle={handleToggle}
        surfaceVariantColor={paletteColors.onSurfaceVariant ?? paletteColors.icon}
      />
    ),
    [
      availableIngredientIds,
      handleToggle,
      highlightColor,
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
        <SearchTopBar value={query} onChangeText={setQuery} placeholder="Search" />
        <SegmentTabs options={TAB_OPTIONS} value={activeTab} onChange={setActiveTab} />
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
    paddingTop: 8,
    paddingBottom: 200,
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
