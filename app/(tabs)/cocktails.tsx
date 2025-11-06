import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MD3TopTabs } from '@/components/ui/md3-top-tabs';
import type { TabItem } from '@/components/ui/md3-top-tabs';
import { SearchBar } from '@/components/ui/search-bar';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useInventory, type Cocktail } from '@/providers/inventory-provider';

type CocktailSection = {
  key: string;
  label: string;
  heading: string;
  description: string;
  data: Cocktail[];
};

export default function CocktailsScreen() {
  const { cocktails, availableIngredientIds } = useInventory();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [query, setQuery] = useState('');
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];

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

  const sections = useMemo<Record<string, CocktailSection>>(() => {
    const signature = cocktails.filter((cocktail) =>
      (cocktail.tags ?? []).some((tag) => /signature|house|favorite|favourite|classic/i.test(tag.name)),
    );

    return {
      all: {
        key: 'all',
        label: 'All',
        heading: 'Explore every pour',
        description: 'Browse the full catalogue of signature and classic recipes ready for service.',
        data: cocktails,
      },
      my: {
        key: 'my',
        label: 'My',
        heading: 'Shift-ready builds',
        description: 'Keep the recipes you can shake with what you have on hand.',
        data: readyToMix,
      },
      favorites: {
        key: 'favorites',
        label: 'Favorites',
        heading: 'Signature highlights',
        description: 'House signatures and classic crowd-pleasers to feature on the menu.',
        data: signature.length > 0 ? signature : cocktails.slice(0, 12),
      },
    } satisfies Record<string, CocktailSection>;
  }, [cocktails, readyToMix]);

  const tabItems: TabItem[] = useMemo(() => Object.values(sections).map(({ key, label }) => ({ key, label })), [sections]);

  const activeSection = useMemo(() => sections[activeTab] ?? sections.all, [sections, activeTab]);

  const filteredCocktails = useMemo(() => {
    const base = activeSection.data;
    if (!query.trim()) {
      return base;
    }
    const safeQuery = query.trim().toLowerCase();
    return base.filter((cocktail) => cocktail.name.toLowerCase().includes(safeQuery));
  }, [activeSection.data, query]);

  return (
    <ThemedView style={[styles.container, { backgroundColor: palette.background }]}> 
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText type="title">Cocktails</ThemedText>
          <ThemedText style={styles.subtitle}>
            Curate your menu, tweak your specs and keep the classics within reach.
          </ThemedText>
        </View>

        <SearchBar placeholder="Search cocktails" value={query} onChange={setQuery} trailingActionLabel="sort" />

        <MD3TopTabs tabs={tabItems} activeKey={activeTab} onTabChange={setActiveTab} />

        <View style={styles.sectionIntro}>
          <ThemedText type="subtitle">{activeSection.heading}</ThemedText>
          <ThemedText style={styles.sectionDescription}>{activeSection.description}</ThemedText>
        </View>

        {filteredCocktails.length > 0 ? (
          filteredCocktails.map((cocktail) => (
            <CocktailRow
              key={String(cocktail.id ?? cocktail.name)}
              cocktail={cocktail}
              availableIngredientIds={availableIngredientIds}
              palette={palette}
              colorScheme={colorScheme}
            />
          ))
        ) : activeSection.key === 'my' ? (
          <EmptyState message="Add more ingredients to unlock ready-to-mix recipes." />
        ) : (
          <EmptyState message="Add a recipe to get started shaking." />
        )}
      </ScrollView>
    </ThemedView>
  );
}

function CocktailRow({
  cocktail,
  availableIngredientIds,
  palette,
  colorScheme,
}: {
  cocktail: Cocktail;
  availableIngredientIds: Set<number>;
  palette: (typeof Colors)['light'] | (typeof Colors)['dark'];
  colorScheme: ReturnType<typeof useColorScheme>;
}) {
  const profile = cocktail.description?.trim() || cocktail.instructions?.trim();
  const ingredients = cocktail.ingredients
    .map((item) => item.name)
    .filter(Boolean)
    .join(' • ');
  const tag = cocktail.tags?.[0];
  const badgeColor = tag?.color ?? '#FFD54F';
  const totalIngredients = cocktail.ingredients?.length ?? 0;
  const availableCount = (cocktail.ingredients ?? []).reduce((count, item) => {
    if (typeof item.ingredientId !== 'number') {
      return count;
    }
    return availableIngredientIds.has(item.ingredientId) ? count + 1 : count;
  }, 0);
  const missingCount = Math.max(0, totalIngredients - availableCount);
  const missingLabel =
    totalIngredients === 0
      ? 'No ingredients tracked yet'
      : missingCount === 0
        ? 'All ingredients ready'
        : `Missing: ${missingCount} ingredient${missingCount === 1 ? '' : 's'}`;
  const initials = cocktail.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const isReady = missingCount === 0 && totalIngredients > 0;
  const rowBackground = colorScheme === 'dark' ? '#182330' : '#FFFFFF';
  const activeBackground = colorScheme === 'dark' ? 'rgba(77,171,247,0.25)' : `${palette.tint}14`;
  const borderColor = isReady ? `${palette.tint}66` : palette.outlineVariant;

  return (
    <Pressable accessibilityRole="button" onPress={() => {}}>
      <ThemedView
        style={[
          styles.row,
          {
            backgroundColor: isReady ? activeBackground : rowBackground,
            borderColor,
            shadowOpacity: colorScheme === 'dark' ? 0 : 0.06,
            elevation: colorScheme === 'dark' ? 0 : 2,
          },
        ]}>
        <View style={[styles.thumbnail, { backgroundColor: `${badgeColor}1A`, borderColor: `${badgeColor}55` }]}> 
          <ThemedText style={[styles.thumbnailLabel, { color: badgeColor }]}>{initials}</ThemedText>
        </View>
        <View style={styles.rowContent}>
          <ThemedText type="subtitle" style={styles.rowTitle} numberOfLines={1}>
            {cocktail.name}
          </ThemedText>
          <ThemedText style={styles.rowMissing} numberOfLines={1}>
            {missingLabel}
          </ThemedText>
          <ThemedText style={styles.rowIngredients} numberOfLines={1}>
            {ingredients || 'No ingredients listed yet.'}
          </ThemedText>
          {profile ? (
            <ThemedText style={styles.rowProfile} numberOfLines={2}>
              {profile}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.rowMeta}>
          <View style={[styles.tagDot, { backgroundColor: badgeColor }]} />
        </View>
      </ThemedView>
    </Pressable>
  );
}

function EmptyState({ message }: { message: string }) {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const backgroundColor = colorScheme === 'dark' ? '#17222D' : palette.surfaceVariant;

  return (
    <ThemedView
      style={[
        styles.row,
        styles.emptyCard,
        {
          backgroundColor,
          borderColor: palette.outlineVariant,
        },
      ]}>
      <ThemedText style={styles.emptyTitle}>Nothing here yet</ThemedText>
      <ThemedText style={styles.rowProfile}>{message}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 32,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 140,
    gap: 24,
  },
  header: {
    gap: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.72,
  },
  sectionIntro: {
    gap: 8,
  },
  sectionDescription: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.75,
  },
  row: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    shadowOpacity: 0.06,
    elevation: 2,
  },
  rowContent: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    letterSpacing: 0.2,
    fontSize: 16,
  },
  rowMissing: {
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  rowIngredients: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.72,
  },
  rowProfile: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.68,
  },
  rowMeta: {
    alignItems: 'center',
    gap: 12,
  },
  tagDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  thumbnailLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyCard: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
    shadowOpacity: 0,
    elevation: 0,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
});
