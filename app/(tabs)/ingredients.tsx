import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MD3TopTabs } from '@/components/ui/md3-top-tabs';
import type { TabItem } from '@/components/ui/md3-top-tabs';
import { SearchBar } from '@/components/ui/search-bar';
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
    <ThemedView style={styles.container}>
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
}: {
  ingredient: Ingredient;
  isAvailable: boolean;
  onToggle: () => void;
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

  const lightColor = isAvailable ? 'rgba(10,126,164,0.16)' : 'rgba(10,126,164,0.05)';
  const darkColor = isAvailable ? 'rgba(10,126,164,0.22)' : 'rgba(255,255,255,0.05)';

  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: isAvailable }} onPress={onToggle}>
      <ThemedView lightColor={lightColor} darkColor={darkColor} style={styles.row}>
        <View style={[styles.thumbnail, { backgroundColor: `${badgeColor}22` }]}>
          <ThemedText style={[styles.thumbnailLabel, { color: badgeColor }]}>{initials}</ThemedText>
        </View>
        <View style={styles.rowText}>
          <ThemedText type="subtitle" style={styles.rowTitle} numberOfLines={1}>
            {ingredient.name}
          </ThemedText>
          <ThemedText style={styles.rowDetail} numberOfLines={1}>
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
          <View style={[styles.checkbox, { borderColor: badgeColor }]}>
            {isAvailable ? <View style={[styles.checkboxFill, { backgroundColor: badgeColor }]} /> : null}
          </View>
        </View>
      </ThemedView>
    </Pressable>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <ThemedView
      lightColor="rgba(10,126,164,0.05)"
      darkColor="rgba(255,255,255,0.04)"
      style={[styles.row, styles.emptyState]}>
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
    paddingBottom: 120,
    gap: 20,
  },
  header: {
    gap: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.8,
  },
  sectionIntro: {
    gap: 8,
  },
  sectionDescription: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.8,
  },
  row: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    letterSpacing: 0.2,
    fontSize: 17,
  },
  rowDetail: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.7,
  },
  rowDescription: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.7,
  },
  emptyState: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowMeta: {
    alignItems: 'flex-end',
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
