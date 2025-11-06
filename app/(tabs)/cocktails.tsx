import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { HeaderBar } from '@/components/ui/header-bar';
import { IconButton } from '@/components/ui/icon-button';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { MD3TopTabs } from '@/components/ui/md3-top-tabs';
import type { TabItem } from '@/components/ui/md3-top-tabs';
import { SearchBar } from '@/components/ui/search-bar';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useInventory, type Cocktail } from '@/providers/inventory-provider';

type CocktailSection = {
  key: string;
  label: string;
  data: Cocktail[];
};

type TagOption = {
  id: number;
  name: string;
  color: string;
};

type Palette = (typeof Colors)['light'];

type CocktailCardProps = {
  cocktail: Cocktail;
  availableIngredientIds: Set<number>;
  theme: Palette;
};

export default function CocktailsScreen() {
  const { cocktails, availableIngredientIds, loading } = useInventory();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<number>>(new Set());

  const sections = useMemo<Record<string, CocktailSection>>(() => {
    const readyToMix = cocktails.filter((cocktail) => isCocktailAvailable(cocktail, availableIngredientIds));
    const signature = cocktails.filter((cocktail) =>
      (cocktail.tags ?? []).some((tag) => /signature|house|brand|reserve/i.test(tag.name)),
    );

    return {
      all: {
        key: 'all',
        label: 'All',
        data: cocktails,
      },
      available: {
        key: 'available',
        label: 'Ready',
        data: readyToMix,
      },
      signature: {
        key: 'signature',
        label: 'Featured',
        data: signature.length > 0 ? signature : cocktails.slice(0, 12),
      },
    } satisfies Record<string, CocktailSection>;
  }, [cocktails, availableIngredientIds]);

  const tabItems: TabItem[] = useMemo(
    () => Object.values(sections).map(({ key, label }) => ({ key, label })),
    [sections],
  );

  const activeSection = sections[activeTab] ?? sections.all;

  const tagOptions = useMemo<TagOption[]>(() => {
    const map = new Map<number, TagOption>();
    cocktails.forEach((cocktail) => {
      (cocktail.tags ?? []).forEach((tag) => {
        if (!map.has(tag.id)) {
          map.set(tag.id, {
            id: tag.id,
            name: tag.name,
            color: tag.color ?? theme.primary,
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [cocktails, theme.primary]);

  const filteredCocktails = useMemo(() => {
    const base = activeSection.data;
    if (base.length === 0) {
      return [];
    }
    const query = searchQuery.trim().toLowerCase();
    return base.filter((cocktail) => {
      const matchesQuery = !query || cocktail.name.toLowerCase().includes(query);
      const matchesTags =
        selectedTags.size === 0 ||
        (cocktail.tags ?? []).some((tag) => selectedTags.has(tag.id));
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
        <HeaderBar title="Cocktails" />

        <View style={styles.searchRow}>
          <IconButton icon="menu" accessibilityLabel="Open navigation" />
          <SearchBar
            placeholder="Search cocktails"
            value={searchQuery}
            onChange={setSearchQuery}
            style={styles.searchInput}
          />
          <IconButton
            icon="filter"
            accessibilityLabel="Filter cocktails"
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
          ) : filteredCocktails.length > 0 ? (
            filteredCocktails.map((cocktail) => (
              <CocktailCard
                key={String(cocktail.id ?? cocktail.name)}
                cocktail={cocktail}
                availableIngredientIds={availableIngredientIds}
                theme={theme}
              />
            ))
          ) : (
            <EmptyState theme={theme} />
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function CocktailCard({ cocktail, availableIngredientIds, theme }: CocktailCardProps) {
  const ingredients = (cocktail.ingredients ?? [])
    .map((item) => item.name)
    .filter(Boolean)
    .slice(0, 4)
    .join(' • ');

  const totalIngredients = cocktail.ingredients?.length ?? 0;
  const availableCount = (cocktail.ingredients ?? []).reduce((count, item) => {
    if (typeof item.ingredientId !== 'number') {
      return count;
    }
    return availableIngredientIds.has(item.ingredientId) ? count + 1 : count;
  }, 0);

  const missingCount = Math.max(0, totalIngredients - availableCount);
  const isAvailable = totalIngredients > 0 && missingCount === 0;
  const missingLabel =
    totalIngredients === 0
      ? 'No ingredients tracked yet'
      : missingCount === 0
        ? 'All ingredients ready'
        : `Missing ${missingCount}`;

  const rating = calculateRating(cocktail);
  const ratingLabel = rating.toFixed(1);

  const isSignature = (cocktail.tags ?? []).some((tag) => /signature|house|brand|reserve/i.test(tag.name));

  const tagColors = (cocktail.tags ?? []).map((tag) => tag.color ?? theme.tertiary).slice(0, 4);

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.cardPressable, pressed && styles.cardPressed]}
      android_ripple={{ color: theme.ripple, radius: 220 }}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: isAvailable ? theme.secondaryContainer : theme.surface,
            borderColor: isAvailable ? theme.secondary : theme.outline,
          },
        ]}>
        {isSignature ? (
          <View style={[styles.brandStripe, { backgroundColor: theme.primary }]} />
        ) : null}
        <View
          style={[
            styles.thumbnail,
            {
              backgroundColor: theme.primaryContainer,
            },
          ]}>
          <Ionicons name="wine-outline" size={24} color={theme.primary} />
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
            {cocktail.name}
          </Text>
          <Text style={[styles.cardSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
            {ingredients || 'No ingredients listed'}
          </Text>
          <View style={styles.tagRow}>
            {tagColors.map((color, index) => (
              <View key={`${cocktail.id}-tag-${index}`} style={[styles.tagDot, { backgroundColor: color }]} />
            ))}
          </View>
        </View>
        <View style={styles.cardMeta}>
          <View style={[styles.ratingBadge, { backgroundColor: theme.primaryContainer }]}> 
            <Ionicons name="star" size={14} color={theme.warning} />
            <Text style={[styles.ratingLabel, { color: theme.warning }]}>{ratingLabel}</Text>
          </View>
          <Text style={[styles.missingLabel, { color: theme.textSubtle }]} numberOfLines={1}>
            {missingLabel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function EmptyState({ theme }: { theme: Palette }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="wine-outline" size={36} color={theme.textSubtle} />
      <ThemedText style={[styles.emptyTitle, { color: theme.textMuted }]}>No cocktails yet</ThemedText>
      <Text style={[styles.emptyDescription, { color: theme.textSubtle }]}>Add a recipe to start building your list.</Text>
    </View>
  );
}

function isCocktailAvailable(cocktail: Cocktail, availableIngredientIds: Set<number>) {
  const recipe = cocktail.ingredients ?? [];
  if (recipe.length === 0) {
    return false;
  }
  return recipe.every((item) => typeof item.ingredientId === 'number' && availableIngredientIds.has(item.ingredientId));
}

function calculateRating(cocktail: Cocktail) {
  const base = (cocktail.ingredients?.length ?? 0) * 0.18 + 3.2;
  return Math.min(5, Math.max(3, base));
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
    paddingBottom: 140,
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
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  brandStripe: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
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
  tagRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardMeta: {
    alignItems: 'flex-end',
    gap: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  ratingLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  missingLabel: {
    fontSize: 13,
    fontWeight: '500',
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
