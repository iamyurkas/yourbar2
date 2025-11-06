import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FabAdd } from '@/components/FabAdd';
import { FavoriteStar, ListRow, Thumb } from '@/components/RowParts';
import { SearchTopBar, SegmentTabs } from '@/components/TopBars';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useInventory, type Cocktail } from '@/providers/inventory-provider';
import { palette } from '@/theme/theme';

type CocktailSection = {
  key: string;
  label: string;
  data: Cocktail[];
};

type CocktailTabKey = 'all' | 'my' | 'favorites';

const TAB_OPTIONS: { key: CocktailTabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'my', label: 'My' },
  { key: 'favorites', label: 'Favorites' },
];

export default function CocktailsScreen() {
  const { cocktails, availableIngredientIds } = useInventory();
  const [activeTab, setActiveTab] = useState<CocktailTabKey>('all');
  const [query, setQuery] = useState('');
  const colorScheme = useColorScheme();
  const paletteColors = Colors[colorScheme ?? 'light'];

  const readyToMix = useMemo(() => {
    return cocktails.filter((cocktail) => {
      const recipe = cocktail.ingredients ?? [];
      if (recipe.length === 0) {
        return false;
      }
      return recipe.every((item) => {
        if (typeof item.ingredientId !== 'number') {
          return false;
        }
        return availableIngredientIds.has(item.ingredientId);
      });
    });
  }, [cocktails, availableIngredientIds]);

  const favoriteCandidates = useMemo(() => {
    return cocktails.filter((cocktail) =>
      (cocktail.tags ?? []).some((tag) =>
        /signature|house|favorite|favourite|classic/i.test(tag.name ?? ''),
      ),
    );
  }, [cocktails]);

  const favoriteIds = useMemo(() => new Set(favoriteCandidates.map((item) => item.id)), [favoriteCandidates]);

  const sections = useMemo<Record<CocktailTabKey, CocktailSection>>(() => {
    return {
      all: { key: 'all', label: 'All', data: cocktails },
      my: { key: 'my', label: 'My', data: readyToMix },
      favorites: {
        key: 'favorites',
        label: 'Favorites',
        data: favoriteCandidates.length ? favoriteCandidates : cocktails.slice(0, 12),
      },
    };
  }, [cocktails, readyToMix, favoriteCandidates]);

  const activeSection = sections[activeTab] ?? sections.all;

  const filteredCocktails = useMemo(() => {
    const base = activeSection.data;
    if (!query.trim()) {
      return base;
    }
    const safeQuery = query.trim().toLowerCase();
    return base.filter((cocktail) => cocktail.name.toLowerCase().includes(safeQuery));
  }, [activeSection.data, query]);

  const highlightColor = colorScheme === 'dark' ? 'rgba(74,144,226,0.24)' : '#4A90E21A';
  const separatorColor = paletteColors.outline;

  const keyExtractor = useCallback((item: Cocktail) => String(item.id ?? item.name), []);

  const renderItem = useCallback(
    ({ item }: { item: Cocktail }) => {
      const recipe = item.ingredients ?? [];
      const totalIngredients = recipe.length;
      const availableCount = recipe.reduce((count, ingredient) => {
        if (typeof ingredient.ingredientId !== 'number') {
          return count;
        }
        return availableIngredientIds.has(ingredient.ingredientId) ? count + 1 : count;
      }, 0);
      const missingCount = Math.max(0, totalIngredients - availableCount);
      const missingIngredients = recipe
        .filter((ingredient) => typeof ingredient.ingredientId === 'number' && !availableIngredientIds.has(ingredient.ingredientId))
        .map((ingredient) => ingredient.name)
        .filter(Boolean);
      const baseIngredients = recipe
        .map((ingredient) => ingredient.name)
        .filter(Boolean)
        .slice(0, 3)
        .join(', ');

      const subtitle = missingCount
        ? missingCount === 1 && missingIngredients[0]
          ? `Missing: ${missingIngredients[0]}`
          : `Missing: ${missingCount} ingredient${missingCount === 1 ? '' : 's'}`
        : baseIngredients || 'All ingredients ready';

      const subtitleStyle = missingCount
        ? { color: paletteColors.onSurfaceVariant, fontStyle: 'italic' as const }
        : { color: paletteColors.onSurfaceVariant };

      const tagColor = item.tags?.[0]?.color ?? palette.tagPink;
      const isFavorite = favoriteIds.has(item.id);
      const isReady = missingCount === 0 && totalIngredients > 0;

      const thumbnail = (
        <View style={styles.thumbnailWrapper}>
          <Thumb label={item.name} uri={item.photoUri} />
          {isFavorite ? (
            <View style={[styles.favoriteBadge, { backgroundColor: palette.secondary }]}> 
              <MaterialCommunityIcons name="star" size={14} color={paletteColors.background} />
            </View>
          ) : null}
        </View>
      );

      return (
        <ListRow
          title={item.name}
          subtitle={subtitle}
          subtitleStyle={subtitleStyle}
          selected={isReady}
          highlightColor={highlightColor}
          tagColor={tagColor}
          thumbnail={thumbnail}
          control={<FavoriteStar active={isFavorite} />}
        />
      );
    },
    [
      availableIngredientIds,
      favoriteIds,
      highlightColor,
      paletteColors.background,
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
          data={filteredCocktails}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={renderSeparator}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={[styles.emptyLabel, { color: paletteColors.onSurfaceVariant }]}>No cocktails yet</Text>
          }
        />
      </View>
      <FabAdd label="Add cocktail" />
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
    paddingHorizontal: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 104,
  },
  emptyLabel: {
    textAlign: 'center',
    marginTop: 80,
    fontSize: 14,
  },
  thumbnailWrapper: {
    position: 'relative',
  },
  favoriteBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
