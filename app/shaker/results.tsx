import React, { useCallback, useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { CocktailListRow } from '@/components/CocktailListRow';
import { Colors } from '@/constants/theme';
import { isCocktailReady } from '@/libs/cocktail-availability';
import { createIngredientLookup } from '@/libs/ingredient-availability';
import { useInventory, type Cocktail } from '@/providers/inventory-provider';

function parseIdList(value?: string | string[]) {
  if (!value) {
    return [];
  }

  const source = Array.isArray(value) ? value.join(',') : value;
  return source
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export default function ShakerResultsScreen() {
  const paletteColors = Colors;
  const { cocktails, availableIngredientIds, ingredients, ignoreGarnish, allowAllSubstitutes } =
    useInventory();
  const params = useLocalSearchParams<{ matched?: string; available?: string }>();
  const matchedKeys = useMemo(() => new Set(parseIdList(params.matched)), [params.matched]);
  const availableKeysFromParams = useMemo(
    () => new Set(parseIdList(params.available)),
    [params.available],
  );
  const ingredientLookup = useMemo(() => createIngredientLookup(ingredients), [ingredients]);

  const resolveCocktailKey = useCallback((cocktail: Cocktail) => {
    if (cocktail.id != null) {
      return String(cocktail.id);
    }

    if (cocktail.name) {
      return cocktail.name.trim().toLowerCase();
    }

    return undefined;
  }, []);

  const matchedCocktails = useMemo(() => {
    if (matchedKeys.size === 0) {
      return [] as Cocktail[];
    }

    return cocktails.filter((cocktail) => {
      const key = resolveCocktailKey(cocktail);
      return key ? matchedKeys.has(key) : false;
    });
  }, [cocktails, matchedKeys, resolveCocktailKey]);

  const recomputedAvailableKeys = useMemo(() => {
    if (matchedCocktails.length === 0) {
      return new Set<string>();
    }

    const keys = new Set<string>();
    matchedCocktails.forEach((cocktail) => {
      const key = resolveCocktailKey(cocktail);
      if (!key) {
        return;
      }

      if (
        isCocktailReady(cocktail, availableIngredientIds, ingredientLookup, undefined, {
          ignoreGarnish,
          allowAllSubstitutes,
        })
      ) {
        keys.add(key);
      }
    });

    return keys;
  }, [allowAllSubstitutes, availableIngredientIds, ignoreGarnish, ingredientLookup, matchedCocktails, resolveCocktailKey]);

  const availableKeys = availableKeysFromParams.size > 0 ? availableKeysFromParams : recomputedAvailableKeys;

  const availableCocktails = useMemo(() => {
    if (availableKeys.size === 0) {
      return [] as Cocktail[];
    }

    return matchedCocktails.filter((cocktail) => {
      const key = resolveCocktailKey(cocktail);
      return key ? availableKeys.has(key) : false;
    });
  }, [availableKeys, matchedCocktails, resolveCocktailKey]);

  const otherRecipes = useMemo(() => {
    if (matchedCocktails.length === 0) {
      return [] as Cocktail[];
    }

    return matchedCocktails.filter((cocktail) => {
      const key = resolveCocktailKey(cocktail);
      return key ? !availableKeys.has(key) : false;
    });
  }, [availableKeys, matchedCocktails, resolveCocktailKey]);

  const sections = useMemo(() => {
    const data: { key: string; title: string; data: Cocktail[] }[] = [];

    if (availableCocktails.length > 0) {
      data.push({
        key: 'available',
        title: `Cocktails available (${availableCocktails.length})`,
        data: availableCocktails,
      });
    }

    if (otherRecipes.length > 0) {
      data.push({
        key: 'others',
        title: `More recipes (${otherRecipes.length})`,
        data: otherRecipes,
      });
    }

    return data;
  }, [availableCocktails, otherRecipes]);

  const renderItem = useCallback(
    ({ item }: { item: Cocktail }) => (
      <CocktailListRow
        cocktail={item}
        availableIngredientIds={availableIngredientIds}
        ingredientLookup={ingredientLookup}
        ignoreGarnish={ignoreGarnish}
        allowAllSubstitutes={allowAllSubstitutes}
      />
    ),
    [allowAllSubstitutes, availableIngredientIds, ignoreGarnish, ingredientLookup],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: paletteColors.onSurface }]}>{section.title}</Text>
      </View>
    ),
    [paletteColors.onSurface],
  );

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: paletteColors.background }]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: paletteColors.onSurface }]}>Shaker results</Text>
          <Text style={[styles.caption, { color: paletteColors.onSurfaceVariant }]}>
            Showing {matchedCocktails.length} recipe{matchedCocktails.length === 1 ? '' : 's'} · {availableCocktails.length}{' '}
            available now
          </Text>
        </View>
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id ?? item.name)}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => (
            <View style={[styles.divider, { backgroundColor: paletteColors.outlineVariant }]} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: paletteColors.onSurfaceVariant }]}>
                No cocktail matches yet
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 8,
    gap: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  caption: {
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 32,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  sectionHeader: {
    paddingTop: 12,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 14,
  },
});
