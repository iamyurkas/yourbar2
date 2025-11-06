import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { HeaderBar } from '@/components/ui/header-bar';
import { IconButton } from '@/components/ui/icon-button';
import { FloatingActionButton } from '@/components/ui/fab';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { MD3TopTabs } from '@/components/ui/md3-top-tabs';
import type { TabItem } from '@/components/ui/md3-top-tabs';
import { SearchBar } from '@/components/ui/search-bar';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useInventory, type Ingredient } from '@/providers/inventory-provider';

type IngredientSection = {
  key: string;
  label: string;
  data: Ingredient[];
};

type TagOption = {
  id: number;
  name: string;
  color: string;
};

type Palette = (typeof Colors)['light'];

type IngredientCardProps = {
  ingredient: Ingredient;
  isAvailable: boolean;
  onToggle: () => void;
  theme: Palette;
};

export default function IngredientsScreen() {
  const { ingredients, availableIngredientIds, toggleIngredientAvailability, loading } = useInventory();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<number>>(new Set());

  const sections = useMemo<Record<string, IngredientSection>>(() => {
    const inStock = ingredients.filter((ingredient) => {
      const id = Number(ingredient.id ?? -1);
      return id >= 0 && availableIngredientIds.has(id);
    });

    const needsRestock = ingredients.filter((ingredient) => (ingredient.usageCount ?? 0) === 0);

    return {
      all: {
        key: 'all',
        label: 'All',
        data: ingredients,
      },
      my: {
        key: 'my',
        label: 'My',
        data: inStock,
      },
      shopping: {
        key: 'shopping',
        label: 'Shopping',
        data: needsRestock.length > 0 ? needsRestock : ingredients.slice(-12),
      },
    } satisfies Record<string, IngredientSection>;
  }, [ingredients, availableIngredientIds]);

  const tabItems: TabItem[] = useMemo(
    () => Object.values(sections).map(({ key, label }) => ({ key, label })),
    [sections],
  );

  const activeSection = sections[activeTab] ?? sections.all;

  const tagOptions = useMemo<TagOption[]>(() => {
    const map = new Map<number, TagOption>();
    ingredients.forEach((ingredient) => {
      (ingredient.tags ?? []).forEach((tag) => {
        if (!map.has(tag.id)) {
          map.set(tag.id, {
            id: tag.id,
            name: tag.name,
            color: tag.color ?? theme.secondary,
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [ingredients, theme.secondary]);

  const filteredIngredients = useMemo(() => {
    const base = activeSection.data;
    const query = searchQuery.trim().toLowerCase();
    return base.filter((ingredient) => {
      const matchesQuery = !query || ingredient.name.toLowerCase().includes(query);
      const matchesTags =
        selectedTags.size === 0 ||
        (ingredient.tags ?? []).some((tag) => selectedTags.has(tag.id));
      return matchesQuery && matchesTags;
    });
  }, [activeSection.data, searchQuery, selectedTags]);

  const hasTagFilters = selectedTags.size > 0;

  const handleToggleTag = (tagId: number) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const handleClearFilters = () => {
    setSelectedTags(new Set());
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <HeaderBar title="Ingredients" />

        <View style={styles.searchRow}>
          <IconButton icon="menu" accessibilityLabel="Open navigation" />
          <SearchBar
            placeholder="Search ingredients"
            value={searchQuery}
            onChange={setSearchQuery}
            style={styles.searchInput}
          />
          <IconButton
            icon="sliders"
            accessibilityLabel="Filter ingredients"
            onPress={() => setIsFilterOpen((prev) => !prev)}
            active={isFilterOpen || hasTagFilters}
          />
        </View>

        {isFilterOpen ? (
          <View
            style={[
              styles.filterSheet,
              {
                backgroundColor: theme.surface,
                borderColor: theme.outline,
              },
            ]}>
            <View style={styles.filterHeader}>
              <ThemedText type="defaultSemiBold">Tag filters</ThemedText>
              {hasTagFilters ? (
                <Pressable onPress={handleClearFilters} accessibilityRole="button">
                  <Text style={[styles.clearButton, { color: theme.primary }]}>Clear</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.chipGrid}>
              {tagOptions.map((tag) => {
                const active = selectedTags.has(tag.id);
                const textColor = active ? '#FFFFFF' : tag.color;
                return (
                  <Pressable
                    key={tag.id}
                    onPress={() => handleToggleTag(tag.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        backgroundColor: active ? tag.color : theme.surface,
                        borderColor: active ? tag.color : theme.outline,
                      },
                      pressed && styles.chipPressed,
                    ]}
                    android_ripple={{ color: theme.ripple, radius: 160 }}>
                    <Text style={[styles.chipLabel, { color: textColor }]}>{tag.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <MD3TopTabs tabs={tabItems} activeKey={activeTab} onTabChange={setActiveTab} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {loading ? (
            <ListSkeleton rows={5} />
          ) : filteredIngredients.length > 0 ? (
            filteredIngredients.map((ingredient) => {
              const id = Number(ingredient.id ?? -1);
              const isAvailable = id >= 0 && availableIngredientIds.has(id);
              const handleToggle = () => {
                if (id >= 0) {
                  toggleIngredientAvailability(id);
                }
              };
              return (
                <IngredientCard
                  key={String(ingredient.id ?? ingredient.name)}
                  ingredient={ingredient}
                  isAvailable={isAvailable}
                  onToggle={handleToggle}
                  theme={theme}
                />
              );
            })
          ) : (
            <EmptyState theme={theme} />
          )}
        </ScrollView>

        <FloatingActionButton icon="plus" accessibilityLabel="Add ingredient" />
      </View>
    </SafeAreaView>
  );
}

function IngredientCard({ ingredient, isAvailable, onToggle, theme }: IngredientCardProps) {
  const description = ingredient.description?.trim();
  const usageCount = ingredient.usageCount ?? 0;
  const usageLabel = usageCount > 0 ? `${usageCount} cocktail${usageCount === 1 ? '' : 's'}` : 'No cocktails yet';
  const tagColors = (ingredient.tags ?? []).map((tag) => tag.color ?? theme.tertiary).slice(0, 4);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isAvailable }}
      onPress={onToggle}
      style={({ pressed }) => [styles.cardPressable, pressed && styles.cardPressed]}
      android_ripple={{ color: theme.ripple, radius: 220 }}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: isAvailable ? 'rgba(76,195,138,0.12)' : theme.surface,
            borderColor: isAvailable ? theme.success : theme.outline,
          },
        ]}>
        <View style={[styles.thumbnail, { backgroundColor: theme.secondaryContainer }]}> 
          <Ionicons name="leaf" size={22} color={theme.secondary} />
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
            {ingredient.name}
          </Text>
          <Text style={[styles.cardSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
            {usageLabel}
          </Text>
          {description ? (
            <Text style={[styles.cardDetail, { color: theme.textSubtle }]} numberOfLines={2}>
              {description}
            </Text>
          ) : null}
          <View style={styles.tagRow}>
            {tagColors.map((color, index) => (
              <View key={`${ingredient.id}-tag-${index}`} style={[styles.tagDot, { backgroundColor: color }]} />
            ))}
          </View>
        </View>
        <View style={styles.metaColumn}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: isAvailable ? 'rgba(76,195,138,0.16)' : theme.surfaceVariant,
                borderColor: isAvailable ? theme.success : theme.outline,
              },
            ]}>
            <Text
              style={[
                styles.badgeLabel,
                { color: isAvailable ? theme.success : theme.textMuted },
              ]}>
              {isAvailable ? 'In stock' : 'Add to rail'}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function EmptyState({ theme }: { theme: Palette }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="basket-outline" size={36} color={theme.textSubtle} />
      <ThemedText style={[styles.emptyTitle, { color: theme.textMuted }]}>All clear</ThemedText>
      <Text style={[styles.emptyDescription, { color: theme.textSubtle }]}>Everything is stocked. Time to shake!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchInput: {
    flex: 1,
  },
  filterSheet: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  chipPressed: {
    transform: [{ scale: 0.97 }],
  },
  clearButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 180,
    gap: 12,
  },
  cardPressable: {
    borderRadius: 20,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  card: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 16,
    alignItems: 'flex-start',
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  cardDetail: {
    fontSize: 13,
    lineHeight: 18,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaColumn: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  badge: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center',
  },
});
