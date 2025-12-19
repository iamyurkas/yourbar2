import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resolveGlasswareUriFromId } from '@/assets/image-manifest';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { ListRow, Thumb } from '@/components/RowParts';
import { Colors } from '@/constants/theme';
import { useInventory, type Cocktail } from '@/providers/inventory-provider';
import { palette } from '@/theme/theme';

type ResultsSection = {
  title: string;
  subtitle: string;
  highlight: boolean;
  data: Cocktail[];
};

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
  const { cocktails } = useInventory();
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

  const sections = useMemo<ResultsSection[]>(() => {
    const result: ResultsSection[] = [];

    if (availableCocktails.length > 0) {
      result.push({
        title: 'Available',
        subtitle: 'Ready to mix',
        highlight: true,
        data: availableCocktails,
      });
    }

    if (unavailableCocktails.length > 0) {
      result.push({
        title: 'Missing ingredients',
        subtitle: 'Needs more stock',
        highlight: false,
        data: unavailableCocktails,
      });
    }

    return result;
  }, [availableCocktails, unavailableCocktails]);

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
    ({ item, section }: { item: Cocktail; section: ResultsSection }) => {
      const thumbnail = (
        <Thumb
          label={item.name}
          uri={item.photoUri}
          fallbackUri={resolveGlasswareUriFromId(item.glassId)}
        />
      );

      return (
        <ListRow
          title={item.name}
          subtitle={section.subtitle}
          onPress={() => handlePressCocktail(item)}
          selected={section.highlight}
          highlightColor={palette.highlightFaint}
          tagColor={item.tags?.[0]?.color}
          thumbnail={thumbnail}
          accessibilityRole="button"
          metaAlignment="center"
        />
      );
    },
    [handlePressCocktail],
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
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id ?? item.name)}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: paletteColors.surface }]}
          >
            <Text style={[styles.sectionTitle, { color: paletteColors.onSurface }]}>{section.title}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={[styles.emptyLabel, { color: paletteColors.onSurfaceVariant }]}
          >
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
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  emptyLabel: {
    textAlign: 'center',
    marginTop: 80,
    fontSize: 14,
  },
});
