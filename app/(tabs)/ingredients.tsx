import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MD3TopTabs } from '@/components/ui/md3-top-tabs';
import type { TabItem } from '@/components/ui/md3-top-tabs';
import { SearchBar } from '@/components/ui/search-bar';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useInventory, type Ingredient } from '@/providers/inventory-provider';

type IngredientSection = {
  key: string;
  label: string;
  heading: string;
  description: string;
  data: Ingredient[];
};

export default function IngredientsScreen() {
  const { ingredients, availableIngredientIds, toggleIngredientAvailability } = useInventory();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [query, setQuery] = useState('');
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];

  const sections = useMemo<Record<string, IngredientSection>>(() => {
    const needsRestock = ingredients.filter((ingredient) => (ingredient.usageCount ?? 0) === 0);
    const inStock = ingredients.filter((ingredient) => {
      const id = Number(ingredient.id ?? -1);
      return id >= 0 && availableIngredientIds.has(id);
    });

    return {
      all: {
        key: 'all',
        label: 'All',
        heading: 'Inventory at a glance',
        description: 'Keep an eye on bottles, modifiers and prep essentials across the bar.',
        data: ingredients,
      },
      my: {
        key: 'my',
        label: 'My',
        heading: "What's on your rail",
        description: 'Frequently used bottles and everyday essentials curated for fast service.',
        data: inStock,
      },
      shopping: {
        key: 'shopping',
        label: 'Shopping',
        heading: 'Restock list',
        description: 'Ingredients that need attention before the next service or prep run.',
        data: needsRestock.length > 0 ? needsRestock : ingredients.slice(-12),
      },
    } satisfies Record<string, IngredientSection>;
  }, [ingredients, availableIngredientIds]);

  const tabItems: TabItem[] = useMemo(() => Object.values(sections).map(({ key, label }) => ({ key, label })), [sections]);

  const activeSection = useMemo(() => sections[activeTab] ?? sections.all, [sections, activeTab]);

  const filteredIngredients = useMemo(() => {
    const base = activeSection.data;
    if (!query.trim()) {
      return base;
    }
    const safeQuery = query.trim().toLowerCase();
    return base.filter((ingredient) => ingredient.name.toLowerCase().includes(safeQuery));
  }, [activeSection.data, query]);

  return (
    <ThemedView style={[styles.container, { backgroundColor: palette.background }]}> 
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText type="title">Ingredients</ThemedText>
          <ThemedText style={styles.subtitle}>
            Track your inventory, prep list and shopping runs without leaving the rail.
          </ThemedText>
        </View>

        <SearchBar placeholder="Search ingredients" value={query} onChange={setQuery} trailingActionLabel="filter" />

        <MD3TopTabs tabs={tabItems} activeKey={activeTab} onTabChange={setActiveTab} />

        <View style={styles.sectionIntro}>
          <ThemedText type="subtitle">{activeSection.heading}</ThemedText>
          <ThemedText style={styles.sectionDescription}>{activeSection.description}</ThemedText>
        </View>

        {filteredIngredients.length > 0 ? (
          filteredIngredients.map((ingredient) => {
            const id = Number(ingredient.id ?? -1);
            const isAvailable = id >= 0 && availableIngredientIds.has(id);

            const handleToggle = () => {
              if (id >= 0) {
                toggleIngredientAvailability(id);
              }
            };

            return (
              <IngredientRow
                key={String(ingredient.id ?? ingredient.name)}
                ingredient={ingredient}
                isAvailable={isAvailable}
                onToggle={handleToggle}
                palette={palette}
                colorScheme={colorScheme}
              />
            );
          })
        ) : activeSection.key === 'my' ? (
          <EmptyState message="Mark an ingredient as in stock to see it here." />
        ) : (
          <EmptyState message="Everything is stocked. Time to shake!" />
        )}
      </ScrollView>
    </ThemedView>
  );
}

function IngredientRow({
  ingredient,
  isAvailable,
  onToggle,
  palette,
  colorScheme,
}: {
  ingredient: Ingredient;
  isAvailable: boolean;
  onToggle: () => void;
  palette: (typeof Colors)['light'] | (typeof Colors)['dark'];
  colorScheme: ReturnType<typeof useColorScheme>;
}) {
  const description = ingredient.description?.trim();
  const tag = ingredient.tags?.[0];
  const usageCount = ingredient.usageCount ?? 0;
  const usageLabel = usageCount > 0 ? `${usageCount} cocktail${usageCount === 1 ? '' : 's'}` : 'No cocktails yet';
  const badgeColor = tag?.color ?? '#C5CAE9';
  const initials = ingredient.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const rowBackground = colorScheme === 'dark' ? '#17222D' : '#FFFFFF';
  const activeBackground = colorScheme === 'dark' ? 'rgba(77,171,247,0.2)' : `${palette.tint}12`;
  const checkboxBorder = isAvailable ? palette.tint : palette.outlineVariant;
  const textAccent = isAvailable ? palette.tint : '#6F7A86';
  const borderColor = isAvailable ? `${palette.tint}55` : palette.outlineVariant;

  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: isAvailable }} onPress={onToggle}>
      <ThemedView
        style={[
          styles.row,
          {
            backgroundColor: isAvailable ? activeBackground : rowBackground,
            borderColor,
            shadowOpacity: colorScheme === 'dark' ? 0 : 0.06,
            elevation: colorScheme === 'dark' ? 0 : 2,
          },
        ]}>
        <View style={[styles.thumbnail, { backgroundColor: `${badgeColor}12`, borderColor: `${badgeColor}44` }]}> 
          <ThemedText style={[styles.thumbnailLabel, { color: badgeColor }]}>{initials}</ThemedText>
        </View>
        <View style={styles.rowText}>
          <ThemedText type="subtitle" style={styles.rowTitle} numberOfLines={1}>
            {ingredient.name}
          </ThemedText>
          <ThemedText style={[styles.rowDetail, { color: textAccent }]} numberOfLines={1}>
            {usageLabel}
          </ThemedText>
          {description ? (
            <ThemedText style={styles.rowDescription} numberOfLines={1}>
              {description}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.rowMeta}>
          <View style={[styles.tagDot, { backgroundColor: badgeColor }]} />
          <View style={[styles.checkbox, { borderColor: checkboxBorder }]}> 
            {isAvailable ? <View style={[styles.checkboxFill, { backgroundColor: palette.tint }]} /> : null}
          </View>
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
        styles.emptyState,
        {
          backgroundColor,
          borderColor: palette.outlineVariant,
        },
      ]}>
      <ThemedText style={styles.emptyTitle}>All clear</ThemedText>
      <ThemedText style={styles.rowDetail}>{message}</ThemedText>
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
    justifyContent: 'space-between',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    shadowOpacity: 0.06,
    elevation: 2,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    letterSpacing: 0.2,
    fontSize: 16,
  },
  rowDetail: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.7,
  },
  rowDescription: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.68,
  },
  emptyState: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    shadowOpacity: 0,
    elevation: 0,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
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
  rowMeta: {
    alignItems: 'center',
    gap: 12,
  },
  tagDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxFill: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
