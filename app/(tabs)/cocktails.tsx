import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { FabAdd } from '@/components/FabAdd';
import { CocktailListRow } from '@/components/CocktailListRow';
import { CollectionHeader } from '@/components/CollectionHeader';
import type { SegmentTabOption } from '@/components/TopBars';
import { Colors } from '@/constants/theme';
import { palette } from '@/theme/theme';
import { useInventory, type Cocktail } from '@/providers/inventory-provider';

type CocktailSection = {
  key: string;
  label: string;
  data: Cocktail[];
};

type CocktailTabKey = 'all' | 'my' | 'favorites';

const TAB_OPTIONS: SegmentTabOption[] = [
  { key: 'all', label: 'All' },
  { key: 'my', label: 'My' },
  { key: 'favorites', label: 'Favorites' },
];

export default function CocktailsScreen() {
  const { cocktails, availableIngredientIds } = useInventory();
  const [activeTab, setActiveTab] = useState<CocktailTabKey>('all');
  const [query, setQuery] = useState('');
  const paletteColors = Colors;
  const router = useRouter();

  const readyToMix = useMemo(() => {
    return cocktails.filter((cocktail) => {
      const recipe = cocktail.ingredients ?? [];
      if (recipe.length === 0) {
        return false;
      }
      return recipe.every((item) => {
        if (item?.optional || item?.garnish) {
          return true;
        }

        const id = typeof item.ingredientId === 'number' ? item.ingredientId : undefined;
        if (id == null) {
          return false;
        }

        return availableIngredientIds.has(id);
      });
    });
  }, [cocktails, availableIngredientIds]);

  const ratedCocktails = useMemo(() => {
    return cocktails.filter((cocktail) => {
      const ratingValue = Number((cocktail as { userRating?: number }).userRating ?? 0);
      return ratingValue > 0;
    });
  }, [cocktails]);

  const sections = useMemo<Record<CocktailTabKey, CocktailSection>>(() => {
    return {
      all: { key: 'all', label: 'All', data: cocktails },
      my: { key: 'my', label: 'My', data: readyToMix },
      favorites: {
        key: 'favorites',
        label: 'Favorites',
        data: ratedCocktails,
      },
    };
  }, [cocktails, readyToMix, ratedCocktails]);

  const activeSection = sections[activeTab] ?? sections.all;

  const normalizedQuery = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const tokens = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    return { text: trimmed, tokens };
  }, [query]);

  const filteredCocktails = useMemo(() => {
    const base = activeSection.data;
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
  }, [activeSection.data, normalizedQuery]);

  const separatorColor = paletteColors.outline;

  const keyExtractor = useCallback((item: Cocktail) => String(item.id ?? item.name), []);

  const handleSelectCocktail = useCallback(
    (cocktail: Cocktail) => {
      const candidateId = cocktail.id ?? cocktail.name;
      if (!candidateId) {
        return;
      }

      router.push({ pathname: '/cocktail/[cocktailId]', params: { cocktailId: String(candidateId) } });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: Cocktail }) => (
      <CocktailListRow
        cocktail={item}
        availableIngredientIds={availableIngredientIds}
        onPress={() => handleSelectCocktail(item)}
      />
    ),
    [availableIngredientIds, handleSelectCocktail],
  );

  const renderSeparator = useCallback(
    () => <View style={[styles.divider, { backgroundColor: separatorColor }]} />,
    [separatorColor],
  );

  const handleAddCocktail = useCallback(() => {
    router.push('/modal');
  }, [router]);

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
          data={filteredCocktails}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={renderSeparator}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View
              style={[
                styles.emptyState,
                {
                  backgroundColor: paletteColors.surface,
                  borderColor: `${paletteColors.outline}66`,
                },
              ]}>
              <View
                style={[
                  styles.emptyIllustration,
                  {
                    backgroundColor: `${paletteColors.secondaryContainer}AA`,
                  },
                ]}>
                <MaterialCommunityIcons name="glass-cocktail" size={36} color={paletteColors.secondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: paletteColors.onSurface }]}>No cocktails yet</Text>
              <Text style={[styles.emptySubtitle, { color: paletteColors.onSurfaceVariant }]}>
                Start building your personal bar by adding a cocktail recipe.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add cocktail"
                onPress={handleAddCocktail}
                style={[styles.emptyCta, { backgroundColor: paletteColors.tint }]}
              >
                <Text style={[styles.emptyCtaLabel, { color: paletteColors.onPrimary }]}>Add cocktail</Text>
              </Pressable>
            </View>
          }
        />
      </View>
      <FabAdd label="Add cocktail" onPress={handleAddCocktail} />
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
  emptyState: {
    marginHorizontal: 24,
    marginTop: 80,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 32,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 16,
    elevation: 2,
    shadowColor: palette.shadow,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
  },
  emptyIllustration: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyCta: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    elevation: 1,
    shadowColor: palette.shadow,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  emptyCtaLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
