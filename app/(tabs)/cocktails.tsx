import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { FabAdd } from '@/components/FabAdd';
import { CocktailListRow } from '@/components/CocktailListRow';
import { CollectionHeader } from '@/components/CollectionHeader';
import { SideMenu, type SideMenuItem } from '@/components/SideMenu';
import { FlashList } from '@/components/ui/flash-list';
import type { SegmentTabOption } from '@/components/TopBars';
import { Colors } from '@/constants/theme';
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
  const [menuVisible, setMenuVisible] = useState(false);
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

  const menuItems = useMemo<SideMenuItem[]>(
    () => [
      {
        key: 'cocktails',
        label: 'Cocktails',
        icon: 'glass-cocktail',
        badgeColorKey: 'pink',
        onPress: () => router.push('/(tabs)/cocktails'),
      },
      {
        key: 'shaker',
        label: 'Shaker',
        icon: 'shaker-outline',
        badgeColorKey: 'teal',
        onPress: () => router.push('/(tabs)/shaker'),
      },
      {
        key: 'ingredients',
        label: 'Ingredients',
        icon: 'basket-outline',
        badgeColorKey: 'orange',
        onPress: () => router.push('/(tabs)/ingredients'),
      },
      {
        key: 'settings',
        label: 'Settings',
        icon: 'cog-outline',
        badgeColorKey: 'purple',
      },
    ],
    [router],
  );

  const handleMenuPress = useCallback(() => {
    setMenuVisible(true);
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuVisible(false);
  }, []);

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
          onMenuPress={handleMenuPress}
        />
        <FlashList
          data={filteredCocktails}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          estimatedItemSize={96}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyLabel, { color: paletteColors.onSurfaceVariant }]}>No cocktails yet</Text>
            </View>
          }
        />
      </View>
      <FabAdd label="Add cocktail" />
      <SideMenu visible={menuVisible} onClose={handleMenuClose} items={menuItems} />
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
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 120,
  },
  emptyLabel: {
    textAlign: 'center',
    fontSize: 14,
  },
  emptyState: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
