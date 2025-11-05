import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MD3TopTabs } from '@/components/ui/md3-top-tabs';
import type { TabItem } from '@/components/ui/md3-top-tabs';

type Ingredient = {
  name: string;
  detail: string;
  status: 'stocked' | 'low' | 'order';
};

const ALL_INGREDIENTS: Ingredient[] = [
  { name: 'Tequila Reposado', detail: 'Agave spirit · 750ml · NOM 1414', status: 'stocked' },
  { name: 'Sweet Vermouth', detail: 'Fortified wine · keep refrigerated', status: 'low' },
  { name: 'Lime Juice', detail: 'Fresh pressed · nightly prep', status: 'order' },
  { name: 'Angostura Bitters', detail: '4oz dasher bottle · aromatic', status: 'stocked' },
  { name: 'Orgeat Syrup', detail: 'Almond · housemade weekly', status: 'low' },
];

const PERSONAL_STAPLES = new Set(['Tequila Reposado', 'Orgeat Syrup', 'Angostura Bitters']);
const SHOPPING_NEEDS = new Set(['Sweet Vermouth', 'Lime Juice']);

const INGREDIENT_SECTIONS = {
  all: {
    key: 'all',
    label: 'All',
    heading: 'Inventory at a glance',
    description: 'Keep an eye on bottles, modifiers and prep essentials across the bar.',
    data: ALL_INGREDIENTS,
  },
  my: {
    key: 'my',
    label: 'My',
    heading: 'Your station staples',
    description: 'The bottles you reach for every shift, highlighted for faster setup.',
    data: ALL_INGREDIENTS.filter((item) => PERSONAL_STAPLES.has(item.name)),
  },
  shopping: {
    key: 'shopping',
    label: 'Shopping',
    heading: 'Restock before service',
    description: 'Flag low inventory items so the next order sheet writes itself.',
    data: ALL_INGREDIENTS.filter((item) => SHOPPING_NEEDS.has(item.name)),
  },
} satisfies Record<string, {
  key: string;
  label: string;
  heading: string;
  description: string;
  data: Ingredient[];
}>;

const TAB_ITEMS: TabItem[] = Object.values(INGREDIENT_SECTIONS).map(({ key, label }) => ({ key, label }));

export default function IngredientsScreen() {
  const [activeTab, setActiveTab] = useState<string>('all');

  const activeSection = useMemo(() => INGREDIENT_SECTIONS[activeTab], [activeTab]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText type="title">Ingredients</ThemedText>
          <ThemedText style={styles.subtitle}>
            Track your inventory, prep list and shopping runs without leaving the rail.
          </ThemedText>
        </View>

        <MD3TopTabs tabs={TAB_ITEMS} activeKey={activeTab} onTabChange={setActiveTab} />

        <View style={styles.sectionIntro}>
          <ThemedText type="subtitle">{activeSection.heading}</ThemedText>
          <ThemedText style={styles.sectionDescription}>{activeSection.description}</ThemedText>
        </View>

        {activeSection.data.length > 0 ? (
          activeSection.data.map((ingredient) => <IngredientRow key={ingredient.name} ingredient={ingredient} />)
        ) : (
          <EmptyState message="Everything is stocked. Time to shake!" />
        )}
      </ScrollView>
    </ThemedView>
  );
}

function IngredientRow({ ingredient }: { ingredient: Ingredient }) {
  return (
    <ThemedView
      lightColor="rgba(10,126,164,0.06)"
      darkColor="rgba(255,255,255,0.06)"
      style={styles.row}>
      <View style={styles.rowText}>
        <ThemedText type="subtitle" style={styles.rowTitle}>
          {ingredient.name}
        </ThemedText>
        <ThemedText style={styles.rowDetail}>{ingredient.detail}</ThemedText>
      </View>
      <StatusPill status={ingredient.status} />
    </ThemedView>
  );
}

function StatusPill({ status }: { status: Ingredient['status'] }) {
  const labelMap: Record<Ingredient['status'], { label: string; light: string; dark: string }> = {
    stocked: { label: 'Stocked', light: 'rgba(46,125,50,0.16)', dark: 'rgba(129,199,132,0.24)' },
    low: { label: 'Running low', light: 'rgba(255,143,0,0.16)', dark: 'rgba(255,183,77,0.28)' },
    order: { label: 'Order now', light: 'rgba(211,47,47,0.16)', dark: 'rgba(229,115,115,0.28)' },
  };

  const palette = labelMap[status];

  return (
    <ThemedView lightColor={palette.light} darkColor={palette.dark} style={styles.pill}>
      <ThemedText style={styles.pillLabel}>{palette.label}</ThemedText>
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
