import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { FabAdd } from '@/components/FabAdd';
import { CocktailListRow } from '@/components/CocktailListRow';
import { FavoriteStar } from '@/components/RowParts';
import { CollectionHeader } from '@/components/CollectionHeader';
import type { SegmentTabOption } from '@/components/TopBars';
import { Colors } from '@/constants/theme';
import { useInventory, type Cocktail } from '@/providers/inventory-provider';

type CocktailSection = {
  key: string;
  label: string;
  data: Cocktail[];
};

type CocktailTabKey = 'all' | 'my' | 'favorites';

const MAX_RATING = 5;

const TAB_OPTIONS: SegmentTabOption[] = [
  { key: 'all', label: 'All' },
  { key: 'my', label: 'My' },
  { key: 'favorites', label: 'Favorites' },
];

function getCocktailKey(cocktail: Cocktail): string | undefined {
  const candidate = cocktail.id ?? cocktail.name;
  if (candidate == null) {
    return undefined;
  }

  return String(candidate);
}

function getCocktailUserRating(cocktail: Cocktail): number {
  const ratingValueRaw = (cocktail as { userRating?: number }).userRating ?? 0;
  const ratingValue = Math.max(0, Math.min(MAX_RATING, Number(ratingValueRaw) || 0));
  return ratingValue;
}

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

  const favoriteFromTags = useMemo(() => {
    return cocktails.filter((cocktail) =>
      (cocktail.tags ?? []).some((tag) =>
        /signature|house|favorite|favourite|classic/i.test(tag.name ?? ''),
      ),
    );
  }, [cocktails]);

  const ratedCocktails = useMemo(
    () => cocktails.filter((cocktail) => getCocktailUserRating(cocktail) > 0),
    [cocktails],
  );

  const favoriteCandidates = useMemo(() => {
    const merged = new Map<string, Cocktail>();
    const register = (cocktail: Cocktail) => {
      const key = getCocktailKey(cocktail);
      if (!key || merged.has(key)) {
        return;
      }

      merged.set(key, cocktail);
    };

    favoriteFromTags.forEach(register);
    ratedCocktails.forEach(register);

    return Array.from(merged.values());
  }, [favoriteFromTags, ratedCocktails]);

  const favoriteKeys = useMemo(() => {
    const keys = new Set<string>();
    const register = (cocktail: Cocktail) => {
      const key = getCocktailKey(cocktail);
      if (key) {
        keys.add(key);
      }
    };

    favoriteCandidates.forEach(register);
    ratedCocktails.forEach(register);

    return keys;
  }, [favoriteCandidates, ratedCocktails]);

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
    ({ item }: { item: Cocktail }) => {
      const key = getCocktailKey(item);
      const isFavorite = key ? favoriteKeys.has(key) : false;

      return (
        <CocktailListRow
          cocktail={item}
          availableIngredientIds={availableIngredientIds}
          onPress={() => handleSelectCocktail(item)}
          control={<FavoriteStar active={isFavorite} />}
        />
      );
    },
    [availableIngredientIds, favoriteKeys, handleSelectCocktail],
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
