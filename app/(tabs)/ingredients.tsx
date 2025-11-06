import React, { useMemo, useState } from 'react';
import { PlatformPressable } from '@react-navigation/elements';
import { ScrollView, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';
import { SearchHeader } from '@/components/ui/search-header';
import { Badge } from '@/components/ui/badge';
import { UnderlineTabs, type UnderlineTab } from '@/components/ui/underline-tabs';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useInventory, type Ingredient } from '@/providers/inventory-provider';

export default function IngredientsScreen() {
  const { ingredients, availableIngredientIds, toggleIngredientAvailability } = useInventory();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [restockOnly, setRestockOnly] = useState(false);

  const sections = useMemo(() => createSections(ingredients, availableIngredientIds), [ingredients, availableIngredientIds]);
  const tabs: UnderlineTab[] = useMemo(() => Object.values(sections).map(({ key, label }) => ({ key, label })), [sections]);
  const activeSection = sections[activeTab] ?? sections.all;

  const filtered = useMemo(() => {
    let base = activeSection.data;
    if (restockOnly) {
      base = base.filter((ingredient) => (ingredient.usageCount ?? 0) === 0);
    }
    if (query.trim()) {
      const safe = query.trim().toLowerCase();
      base = base.filter((ingredient) => ingredient.name.toLowerCase().includes(safe));
    }
    return base;
  }, [activeSection.data, query, restockOnly]);

  const handleToggle = (id: number) => {
    if (Number.isFinite(id)) {
      toggleIngredientAvailability(id);
    }
  };

  return (
    <Screen>
      <View style={styles.flex1}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <SearchHeader
            query={query}
            onQueryChange={setQuery}
            placeholder="Search ingredients"
            onPressMenu={() => {}}
            onPressFilter={() => setRestockOnly((prev) => !prev)}
            filterActive={restockOnly}
          />

          <View style={styles.headerBlock}>
            <ThemedText type="title">Ingredients</ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.mutedText }]}>
              Manage your back bar, prep list and shopping runs without leaving the rail.
            </ThemedText>
          </View>

          <UnderlineTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />

          <View style={styles.sectionIntro}>
            <ThemedText type="subtitle">{activeSection.heading}</ThemedText>
            <ThemedText style={[styles.sectionDescription, { color: colors.mutedText }]}>
              {activeSection.description}
            </ThemedText>
          </View>

          {filtered.length > 0 ? (
            filtered.map((ingredient) => {
              const id = Number(ingredient.id ?? -1);
              const isAvailable = id >= 0 && availableIngredientIds.has(id);
              return (
                <IngredientCard
                  key={String(ingredient.id ?? ingredient.name)}
                  ingredient={ingredient}
                  isAvailable={isAvailable}
                  onToggle={() => handleToggle(id)}
                  colors={colors}
                />
              );
            })
          ) : (
            <EmptyInventoryMessage
              message={
                activeSection.key === 'shopping'
                  ? 'Everything is stocked. Time to shake!'
                  : 'Add bottles or mark stock levels to populate your list.'
              }
            />
          )}
        </ScrollView>
        <PlatformPressable
          accessibilityRole="button"
          android_ripple={{ color: '#4DABF744' }}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: colors.primaryContainer,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          onPress={() => {}}>
          <MaterialIcons name="add" size={28} color={colors.primary} />
        </PlatformPressable>
      </View>
    </Screen>
  );
}

function createSections(ingredients: Ingredient[], available: Set<number>) {
  const needsRestock = ingredients.filter((ingredient) => (ingredient.usageCount ?? 0) === 0);
  const inStock = ingredients.filter((ingredient) => available.has(Number(ingredient.id ?? -1)));

  return {
    all: {
      key: 'all',
      label: 'All',
      heading: 'Inventory at a glance',
      description: 'Keep tabs on spirits, modifiers and prep essentials across the bar.',
      data: ingredients,
    },
    my: {
      key: 'my',
      label: 'My',
      heading: "What's on your rail",
      description: 'Frequently pulled bottles and everyday workhorses ready for service.',
      data: inStock,
    },
    shopping: {
      key: 'shopping',
      label: 'Shopping',
      heading: 'Restock list',
      description: 'Flag bottles and batches to pick up before the next shift.',
      data: needsRestock.length > 0 ? needsRestock : ingredients.slice(-12),
    },
  } satisfies Record<string, { key: string; label: string; heading: string; description: string; data: Ingredient[] }>;
}


function IngredientCard({
  ingredient,
  isAvailable,
  onToggle,
  colors,
}: {
  ingredient: Ingredient;
  isAvailable: boolean;
  onToggle: () => void;
  colors: typeof Colors['light'];
}) {
  const tag = ingredient.tags?.[0];
  const badgeColor = tag?.color ?? colors.primary;
  const usage = ingredient.usageCount ?? 0;
  const usageLabel = usage > 0 ? `${usage} cocktail${usage === 1 ? '' : 's'}` : 'No cocktails yet';
  const background = (badgeColor ?? colors.primary) + '22';

  return (
    <PlatformPressable
      accessibilityRole="button"
      onPress={onToggle}
      android_ripple={{ color: '#74C0FC55' }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: isAvailable ? 'rgba(116,192,252,0.18)' : colors.surface,
          borderColor: colors.outline,
          opacity: pressed ? 0.92 : 1,
        },
      ]}>
      <View style={[styles.thumbnail, { backgroundColor: background }]}>
        <ThemedText style={styles.thumbnailLabel}>{getInitials(ingredient.name)}</ThemedText>
      </View>
      <View style={styles.cardContent}>
        <ThemedText type="subtitle" numberOfLines={1}>
          {ingredient.name}
        </ThemedText>
        <ThemedText style={[styles.cardSecondary, { color: colors.mutedText }]} numberOfLines={1}>
          {usageLabel}
        </ThemedText>
        <ThemedText style={[styles.cardMeta, { color: colors.mutedText }]} numberOfLines={1}>
          {(ingredient.description ?? '').slice(0, 72) || 'No tasting notes yet.'}
        </ThemedText>
      </View>
      <View style={styles.cardMetaColumn}>
        <Badge label={isAvailable ? 'In stock' : 'Track'} tone={isAvailable ? 'success' : 'neutral'} />
        <View style={[styles.switch, { borderColor: badgeColor }]}>
          <View
            style={[
              styles.switchThumb,
              {
                backgroundColor: isAvailable ? badgeColor : 'transparent',
              },
            ]}
          />
        </View>
      </View>
    </PlatformPressable>
  );
}

function EmptyInventoryMessage({ message }: { message: string }) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  return (
    <View style={[styles.emptyState, { borderColor: colors.outline }]}>
      <ThemedText type="subtitle">Nothing tracked yet</ThemedText>
      <ThemedText style={[styles.emptyHint, { color: colors.mutedText }]}>{message}</ThemedText>
    </View>
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 140,
    gap: 16,
  },
  headerBlock: {
    gap: 6,
    paddingTop: 4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  sectionIntro: {
    gap: 6,
    paddingTop: 4,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardContent: {
    flex: 1,
    gap: 6,
  },
  cardSecondary: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardMeta: {
    fontSize: 12,
    lineHeight: 18,
  },
  cardMetaColumn: {
    alignItems: 'flex-end',
    gap: 8,
  },
  switch: {
    width: 40,
    height: 22,
    borderRadius: 16,
    borderWidth: 2,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyHint: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});
