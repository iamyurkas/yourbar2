import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HeaderIconButton } from '@/components/HeaderIconButton';
import { CocktailListRow } from '@/components/CocktailListRow';
import { Colors } from '@/constants/theme';
import { isCocktailReady } from '@/libs/cocktail-availability';
import { createIngredientLookup } from '@/libs/ingredient-availability';
import { useInventory, type Cocktail } from '@/providers/inventory-provider';

function parseListParam(param?: string | string[]) {
  if (!param) {
    return [] as string[];
  }

  if (Array.isArray(param)) {
    return param.flatMap((value) => parseListParam(value));
  }

  try {
    const parsed = JSON.parse(param);
    if (Array.isArray(parsed)) {
      return parsed.map((value) => String(value));
    }
  } catch {
    return [param];
  }

  return [param];
}

function resolveCocktailByKey(key: string, cocktails: Cocktail[]) {
  const numericId = Number(key);
  if (!Number.isNaN(numericId)) {
    const byId = cocktails.find((item) => Number(item.id ?? -1) === numericId);
    if (byId) {
      return byId;
    }
  }

  const normalized = key.trim().toLowerCase();
  return cocktails.find((item) => item.name?.toLowerCase() === normalized);
}

export default function ShakerResultsScreen() {
  const router = useRouter();
  const paletteColors = Colors;
  const {
    cocktails,
    availableIngredientIds,
    ingredients,
    ignoreGarnish,
    allowAllSubstitutes,
  } = useInventory();
  const params = useLocalSearchParams();

  const availableIds = useMemo(() => parseListParam(params.available), [params.available]);
  const unavailableIds = useMemo(() => parseListParam(params.unavailable), [params.unavailable]);

  const availableCocktails = useMemo(() => {
    const items: Cocktail[] = [];
    const seen = new Set<string>();

    availableIds.forEach((id) => {
      const cocktail = resolveCocktailByKey(id, cocktails);
      if (!cocktail) {
        return;
      }

      const key = String(cocktail.id ?? cocktail.name ?? id);
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      items.push(cocktail);
    });

    return items;
  }, [availableIds, cocktails]);

  const unavailableCocktails = useMemo(() => {
    const items: Cocktail[] = [];
    const seen = new Set<string>();

    unavailableIds.forEach((id) => {
      const cocktail = resolveCocktailByKey(id, cocktails);
      if (!cocktail) {
        return;
      }

      const key = String(cocktail.id ?? cocktail.name ?? id);
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      items.push(cocktail);
    });

    return items;
  }, [cocktails, unavailableIds]);

  const listData = useMemo(
    () => [...availableCocktails, ...unavailableCocktails],
    [availableCocktails, unavailableCocktails],
  );

  const ingredientLookup = useMemo(() => createIngredientLookup(ingredients), [ingredients]);

  const handlePressCocktail = useCallback(
    (cocktail: Cocktail) => {
      const targetId = cocktail.id ?? cocktail.name;
      if (!targetId) {
        return;
      }

      router.push({
        pathname: '/cocktail/[cocktailId]',
        params: { cocktailId: String(targetId) },
      });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: Cocktail }) => (
      <CocktailListRow
        cocktail={item}
        availableIngredientIds={availableIngredientIds}
        ingredientLookup={ingredientLookup}
        ignoreGarnish={ignoreGarnish}
        allowAllSubstitutes={allowAllSubstitutes}
        onPress={() => handlePressCocktail(item)}
      />
    ),
    [
      allowAllSubstitutes,
      availableIngredientIds,
      handlePressCocktail,
      ignoreGarnish,
      ingredientLookup,
    ],
  );

  const renderSeparator = useCallback(
    ({ leadingItem }: { leadingItem?: Cocktail | null }) => {
      const isReady = leadingItem
        ? isCocktailReady(leadingItem, availableIngredientIds, ingredientLookup, undefined, {
            ignoreGarnish,
            allowAllSubstitutes,
          })
        : false;
      const backgroundColor = isReady ? paletteColors.outline : paletteColors.outlineVariant;

      return <View style={[styles.divider, { backgroundColor }]} />;
    },
    [
      allowAllSubstitutes,
      availableIngredientIds,
      ignoreGarnish,
      ingredientLookup,
      paletteColors.outline,
      paletteColors.outlineVariant,
    ],
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: paletteColors.background }]} edges={['left', 'right']}>
      <Stack.Screen
        options={{
          title: 'Results',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: paletteColors.surface },
          headerTitleStyle: { color: paletteColors.onSurface, fontSize: 16, fontWeight: '600' },
          headerShadowVisible: false,
          headerLeft: () => (
            <HeaderIconButton onPress={() => router.back()} accessibilityLabel="Go back">
              <MaterialCommunityIcons name="arrow-left" size={22} color={paletteColors.onSurface} />
            </HeaderIconButton>
          ),
        }}
      />
      <FlatList
        data={listData}
        keyExtractor={(item) => String(item.id ?? item.name)}
        renderItem={renderItem}
        ItemSeparatorComponent={renderSeparator}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={[styles.emptyLabel, { color: paletteColors.onSurfaceVariant }]}>
            No matching recipes
          </Text>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  listContent: {
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
