import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MD3TopTabs } from '@/components/ui/md3-top-tabs';
import type { TabItem } from '@/components/ui/md3-top-tabs';

type Cocktail = {
  name: string;
  profile: string;
  ingredients: string[];
};

const ALL_COCKTAILS: Cocktail[] = [
  {
    name: 'Negroni',
    profile: 'Bitter, citrus-forward and perfectly balanced.',
    ingredients: ['Gin', 'Campari', 'Sweet vermouth'],
  },
  {
    name: 'Whiskey Sour',
    profile: 'Silky texture with bright lemon acidity.',
    ingredients: ['Bourbon', 'Lemon', 'Simple syrup', 'Egg white'],
  },
  {
    name: 'Margarita',
    profile: 'Zesty, refreshing and crowd-pleasing.',
    ingredients: ['Tequila', 'Lime', 'Orange liqueur'],
  },
  {
    name: 'Old Fashioned',
    profile: 'Spirit-forward with a soft citrus aroma.',
    ingredients: ['Bourbon', 'Angostura bitters', 'Sugar', 'Orange zest'],
  },
  {
    name: 'Espresso Martini',
    profile: 'Velvety pick-me-up with espresso intensity.',
    ingredients: ['Vodka', 'Fresh espresso', 'Coffee liqueur'],
  },
];

const MY_RECIPES = new Set(['Margarita', 'Espresso Martini', 'Negroni']);
const FAVORITES = new Set(['Negroni', 'Old Fashioned']);

const COCKTAIL_SECTIONS = {
  all: {
    key: 'all',
    label: 'All',
    heading: 'Explore every pour',
    description: 'Browse the full catalogue of signature and classic recipes ready for service.',
    data: ALL_COCKTAILS,
  },
  my: {
    key: 'my',
    label: 'My',
    heading: 'Saved to your station',
    description: 'Personal creations and bar-approved specs you have pinned for quick access.',
    data: ALL_COCKTAILS.filter((cocktail) => MY_RECIPES.has(cocktail.name)),
  },
  favorites: {
    key: 'favorites',
    label: 'Favorites',
    heading: 'Nightly crowd-pleasers',
    description: 'Highlight the recipes guests ask for again and again to keep your shift flowing.',
    data: ALL_COCKTAILS.filter((cocktail) => FAVORITES.has(cocktail.name)),
  },
} satisfies Record<string, {
  key: string;
  label: string;
  heading: string;
  description: string;
  data: Cocktail[];
}>;

const TAB_ITEMS: TabItem[] = Object.values(COCKTAIL_SECTIONS).map(({ key, label }) => ({ key, label }));

export default function CocktailsScreen() {
  const [activeTab, setActiveTab] = useState<string>('all');

  const activeSection = useMemo(() => COCKTAIL_SECTIONS[activeTab], [activeTab]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText type="title">Cocktails</ThemedText>
          <ThemedText style={styles.subtitle}>
            Curate your menu, tweak your specs and keep the classics within reach.
          </ThemedText>
        </View>

        <MD3TopTabs tabs={TAB_ITEMS} activeKey={activeTab} onTabChange={setActiveTab} />

        <View style={styles.sectionIntro}>
          <ThemedText type="subtitle">{activeSection.heading}</ThemedText>
          <ThemedText style={styles.sectionDescription}>{activeSection.description}</ThemedText>
        </View>

        {activeSection.data.length > 0 ? (
          activeSection.data.map((cocktail) => <CocktailCard key={cocktail.name} cocktail={cocktail} />)
        ) : (
          <EmptyState message="Add a recipe to get started shaking." />
        )}
      </ScrollView>
    </ThemedView>
  );
}

function CocktailCard({ cocktail }: { cocktail: Cocktail }) {
  return (
    <ThemedView
      lightColor="rgba(10,126,164,0.08)"
      darkColor="rgba(255,255,255,0.07)"
      style={styles.card}>
      <ThemedText type="subtitle" style={styles.cardTitle}>
        {cocktail.name}
      </ThemedText>
      <ThemedText style={styles.cardProfile}>{cocktail.profile}</ThemedText>
      <ThemedText style={styles.cardLabel}>Key ingredients</ThemedText>
      <ThemedText style={styles.cardIngredients}>{cocktail.ingredients.join(' • ')}</ThemedText>
    </ThemedView>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <ThemedView
      lightColor="rgba(10,126,164,0.05)"
      darkColor="rgba(255,255,255,0.04)"
      style={[styles.card, styles.emptyCard]}>
      <ThemedText style={styles.emptyTitle}>Nothing here yet</ThemedText>
      <ThemedText style={styles.cardProfile}>{message}</ThemedText>
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
  card: {
    borderRadius: 20,
    padding: 20,
    gap: 8,
  },
  cardTitle: {
    letterSpacing: 0.2,
  },
  cardProfile: {
    fontSize: 16,
    lineHeight: 22,
  },
  cardLabel: {
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    opacity: 0.7,
  },
  cardIngredients: {
    fontSize: 15,
    lineHeight: 22,
  },
  emptyCard: {
    alignItems: 'flex-start',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
});
