import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CocktailListRow } from '@/components/CocktailListRow';
import { Colors } from '@/constants/theme';
import { createIngredientLookup } from '@/libs/ingredient-availability';
import { useInventory, type Cocktail } from '@/providers/inventory-provider';
import { palette } from '@/theme/theme';

type SearchParams = {
  readyIds?: string | string[];
  matchingIds?: string | string[];
};

function parseIdSet(value?: string | string[]) {
  if (!value) {
    return new Set<number>();
  }

  const raw = Array.isArray(value) ? value.join(',') : value;
  const parts = raw.split(',').map((item) => Number(item));
  const ids = parts.filter((id) => Number.isFinite(id) && id >= 0).map((id) => Math.trunc(id));
  return new Set(ids);
}

export default function ShakerResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<SearchParams>();
  const { cocktails, ingredients, availableIngredientIds, ignoreGarnish, allowAllSubstitutes } =
    useInventory();
  const readyIdSet = useMemo(() => parseIdSet(params.readyIds), [params.readyIds]);
  const matchingIdSet = useMemo(() => parseIdSet(params.matchingIds), [params.matchingIds]);
  const ingredientLookup = useMemo(() => createIngredientLookup(ingredients), [ingredients]);
  const paletteColors = Colors;

  const readyCocktails = useMemo(
    () =>
      cocktails.filter((cocktail) => {
        const id = Number(cocktail.id ?? -1);
        return Number.isFinite(id) && readyIdSet.has(Math.trunc(id));
      }),
    [cocktails, readyIdSet],
  );

  const matchingCocktails = useMemo(
    () =>
      cocktails.filter((cocktail) => {
        const id = Number(cocktail.id ?? -1);
        if (!Number.isFinite(id)) {
          return false;
        }

        const normalizedId = Math.trunc(id);
        if (readyIdSet.has(normalizedId)) {
          return false;
        }

        return matchingIdSet.has(normalizedId);
      }),
    [cocktails, matchingIdSet, readyIdSet],
  );

  const hasAnyResults = readyCocktails.length > 0 || matchingCocktails.length > 0;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: paletteColors.background }]}
      edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { borderColor: paletteColors.outline }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={paletteColors.onSurface} />
          <Text style={[styles.backLabel, { color: paletteColors.onSurface }]}>Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: paletteColors.onSurface }]}>Shaker results</Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}>
        <ResultSection
          title={`Ready to mix (${readyCocktails.length})`}
          data={readyCocktails}
          ingredientLookup={ingredientLookup}
          availableIngredientIds={availableIngredientIds}
          ignoreGarnish={ignoreGarnish}
          allowAllSubstitutes={allowAllSubstitutes}
        />
        <ResultSection
          title={`Matching recipes (${matchingCocktails.length})`}
          data={matchingCocktails}
          ingredientLookup={ingredientLookup}
          availableIngredientIds={availableIngredientIds}
          ignoreGarnish={ignoreGarnish}
          allowAllSubstitutes={allowAllSubstitutes}
        />
        {!hasAnyResults ? (
          <Text style={[styles.emptyLabel, { color: paletteColors.onSurfaceVariant }]}>
            No recipes match the selected ingredients yet.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

type ResultSectionProps = {
  title: string;
  data: Cocktail[];
  ingredientLookup: ReturnType<typeof createIngredientLookup>;
  availableIngredientIds: Set<number>;
  ignoreGarnish: boolean;
  allowAllSubstitutes: boolean;
};

function ResultSection({
  title,
  data,
  ingredientLookup,
  availableIngredientIds,
  ignoreGarnish,
  allowAllSubstitutes,
}: ResultSectionProps) {
  const paletteColors = Colors;
  const router = useRouter();

  if (data.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: paletteColors.onSurface }]}>{title}</Text>
      <View style={styles.sectionList}>
        {data.map((cocktail, index) => {
          const cocktailId = cocktail.id;
          const routeParam = cocktailId ?? cocktail.name;
          const key = routeParam ?? cocktail.name ?? `cocktail-${index}`;
          const handlePress = () => {
            if (routeParam == null) {
              return;
            }

            router.push({
              pathname: '/cocktail/[cocktailId]',
              params: { cocktailId: String(routeParam) },
            });
          };

          return (
            <CocktailListRow
              key={key}
              cocktail={cocktail}
              availableIngredientIds={availableIngredientIds}
              ingredientLookup={ingredientLookup}
              ignoreGarnish={ignoreGarnish}
              allowAllSubstitutes={allowAllSubstitutes}
              highlightColor={palette.highlightFaint}
              onPress={handlePress}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sectionList: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.outline,
  },
  emptyLabel: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
});
