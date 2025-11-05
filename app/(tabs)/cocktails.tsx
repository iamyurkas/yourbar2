import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MD3TopTabs } from '@/components/ui/md3-top-tabs';
import type { TabItem } from '@/components/ui/md3-top-tabs';
import { useInventory, type Cocktail } from '@/providers/inventory-provider';

type CocktailSection = {
  key: string;
  label: string;
  heading: string;
  description: string;
  data: Cocktail[];
};

export default function CocktailsScreen() {
  const { cocktails } = useInventory();
  const [activeTab, setActiveTab] = useState<string>('all');

  const sections = useMemo<Record<string, CocktailSection>>(() => {
    return {
      all: {
        key: 'all',
        label: 'All',
        heading: 'Explore every pour',
        description: 'Browse the full catalogue of signature and classic recipes ready for service.',
        data: cocktails,
      },
    } satisfies Record<string, CocktailSection>;
  }, [cocktails]);

  const tabItems: TabItem[] = useMemo(() => Object.values(sections).map(({ key, label }) => ({ key, label })), [sections]);

  const activeSection = useMemo(() => sections[activeTab] ?? sections.all, [sections, activeTab]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText type="title">Cocktails</ThemedText>
          <ThemedText style={styles.subtitle}>
            Curate your menu, tweak your specs and keep the classics within reach.
          </ThemedText>
        </View>

        <MD3TopTabs tabs={tabItems} activeKey={activeTab} onTabChange={setActiveTab} />

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
  const profile = cocktail.description?.trim() || cocktail.instructions?.trim();
  const ingredients = cocktail.ingredients
    .map((item) => item.name)
    .filter(Boolean)
    .join(' • ');

  return (
    <ThemedView
      lightColor="rgba(10,126,164,0.08)"
      darkColor="rgba(255,255,255,0.07)"
      style={styles.card}>
      <ThemedText type="subtitle" style={styles.cardTitle}>
        {cocktail.name}
      </ThemedText>
      {profile ? (
        <ThemedText style={styles.cardProfile}>{profile}</ThemedText>
      ) : (
        <ThemedText style={styles.cardProfile}>
          No description yet. Add tasting notes to keep your team aligned.
        </ThemedText>
      )}
      <ThemedText style={styles.cardLabel}>Key ingredients</ThemedText>
      <ThemedText style={styles.cardIngredients}>
        {ingredients || 'Ingredients list is empty for this cocktail.'}
      </ThemedText>
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
