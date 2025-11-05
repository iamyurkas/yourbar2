import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MD3TopTabs } from '@/components/ui/md3-top-tabs';
import type { TabItem } from '@/components/ui/md3-top-tabs';
import { useInventory, type Ingredient } from '@/providers/inventory-provider';

type IngredientSection = {
  key: string;
  label: string;
  heading: string;
  description: string;
  data: Ingredient[];
};

export default function IngredientsScreen() {
  const { ingredients } = useInventory();
  const [activeTab, setActiveTab] = useState<string>('all');

  const sections = useMemo<Record<string, IngredientSection>>(() => {
    return {
      all: {
        key: 'all',
        label: 'All',
        heading: 'Inventory at a glance',
        description: 'Keep an eye on bottles, modifiers and prep essentials across the bar.',
        data: ingredients,
      },
    } satisfies Record<string, IngredientSection>;
  }, [ingredients]);

  const tabItems: TabItem[] = useMemo(() => Object.values(sections).map(({ key, label }) => ({ key, label })), [sections]);

  const activeSection = useMemo(() => sections[activeTab] ?? sections.all, [sections, activeTab]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText type="title">Ingredients</ThemedText>
          <ThemedText style={styles.subtitle}>
            Track your inventory, prep list and shopping runs without leaving the rail.
          </ThemedText>
        </View>

        <MD3TopTabs tabs={tabItems} activeKey={activeTab} onTabChange={setActiveTab} />

        <View style={styles.sectionIntro}>
          <ThemedText type="subtitle">{activeSection.heading}</ThemedText>
          <ThemedText style={styles.sectionDescription}>{activeSection.description}</ThemedText>
        </View>

        {activeSection.data.length > 0 ? (
          activeSection.data.map((ingredient) => (
            <IngredientRow key={String(ingredient.id ?? ingredient.name)} ingredient={ingredient} />
          ))
        ) : (
          <EmptyState message="Everything is stocked. Time to shake!" />
        )}
      </ScrollView>
    </ThemedView>
  );
}

function IngredientRow({ ingredient }: { ingredient: Ingredient }) {
  const description = ingredient.description?.trim();
  const tag = ingredient.tags?.[0];

  return (
    <ThemedView
      lightColor="rgba(10,126,164,0.06)"
      darkColor="rgba(255,255,255,0.06)"
      style={styles.row}>
      <View style={styles.rowText}>
        <ThemedText type="subtitle" style={styles.rowTitle}>
          {ingredient.name}
        </ThemedText>
        {description ? (
          <ThemedText style={styles.rowDetail} numberOfLines={3}>
            {description}
          </ThemedText>
        ) : null}
      </View>
      {tag ? <TagPill label={tag.name} color={tag.color} /> : null}
    </ThemedView>
  );
}

function TagPill({ label, color }: { label: string; color?: string }) {
  const lightColor = color ? `${color}33` : 'rgba(10,126,164,0.12)';
  const darkColor = color ? `${color}44` : 'rgba(255,255,255,0.16)';
  return (
    <ThemedView lightColor={lightColor} darkColor={darkColor} style={styles.pill}>
      <ThemedText style={styles.pillLabel} numberOfLines={1}>
        {label}
      </ThemedText>
    </ThemedView>
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
    paddingTop: 48,
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
    borderRadius: 18,
    padding: 20,
    gap: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: {
    flex: 1,
    gap: 6,
  },
  rowTitle: {
    letterSpacing: 0.2,
  },
  rowDetail: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.85,
  },
  pill: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyState: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
});
