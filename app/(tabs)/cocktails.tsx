import React, { useMemo, useState } from 'react';
import { PlatformPressable } from '@react-navigation/elements';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';
import { SearchHeader } from '@/components/ui/search-header';
import { TagChip } from '@/components/ui/tag-chip';
import { UnderlineTabs, type UnderlineTab } from '@/components/ui/underline-tabs';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useInventory, type Cocktail } from '@/providers/inventory-provider';

type TagOption = {
  id: number;
  name: string;
  color: string;
};

type CocktailSection = {
  key: string;
  label: string;
  heading: string;
  description: string;
  data: Cocktail[];
};

export default function CocktailsScreen() {
  const { cocktails, availableIngredientIds, loading } = useInventory();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);

  const readyToMix = useMemo(() => {
    return cocktails.filter((cocktail) => isCocktailAvailable(cocktail, availableIngredientIds));
  }, [cocktails, availableIngredientIds]);

  const sections = useMemo<Record<string, CocktailSection>>(() => {
    const signature = cocktails.filter((cocktail) => isBranded(cocktail));

    return {
      all: {
        key: 'all',
        label: 'All',
        heading: 'Explore every pour',
        description: 'Browse the entire menu of classics, riffs and signatures.',
        data: cocktails,
      },
      my: {
        key: 'my',
        label: 'My',
        heading: 'Ready to shake',
        description: 'Every cocktail you can build right now with ingredients on hand.',
        data: readyToMix,
      },
      favorites: {
        key: 'favorites',
        label: 'Favorites',
        heading: 'Signature highlights',
        description: 'Brand-led serves and house favorites curated for the spotlight.',
        data: signature.length > 0 ? signature : cocktails.slice(0, 12),
      },
    } satisfies Record<string, CocktailSection>;
  }, [cocktails, readyToMix]);

  const tabs: UnderlineTab[] = useMemo(
    () => Object.values(sections).map(({ key, label }) => ({ key, label })),
    [sections],
  );

  const tagOptions = useMemo<TagOption[]>(() => {
    const map = new Map<number, TagOption>();
    cocktails.forEach((cocktail) => {
      (cocktail.tags ?? []).forEach((tag) => {
        if (typeof tag.id === 'number' && !map.has(tag.id)) {
          map.set(tag.id, { id: tag.id, name: tag.name, color: tag.color ?? colors.primary });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [cocktails, colors.primary]);

  const activeSection = useMemo(() => sections[activeTab] ?? sections.all, [sections, activeTab]);

  const filteredCocktails = useMemo(() => {
    let base = activeSection.data;

    if (selectedTags.length > 0) {
      base = base.filter((cocktail) => {
        const ids = new Set((cocktail.tags ?? []).map((tag) => tag.id));
        return selectedTags.every((id) => ids.has(id));
      });
    }

    if (query.trim()) {
      const safe = query.trim().toLowerCase();
      base = base.filter((cocktail) => cocktail.name.toLowerCase().includes(safe));
    }

    return base;
  }, [activeSection.data, query, selectedTags]);

  const filterActive = showFilters || selectedTags.length > 0;

  const toggleTag = (id: number) => {
    setSelectedTags((prev) => {
      const exists = prev.includes(id);
      if (exists) {
        return prev.filter((tagId) => tagId !== id);
      }
      return [...prev, id];
    });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SearchHeader
          query={query}
          onQueryChange={setQuery}
          placeholder="Search cocktails"
          onPressMenu={() => {}}
          onPressFilter={() => setShowFilters((prev) => !prev)}
          filterActive={filterActive}
        />

        {showFilters ? (
          <View
            style={[
              styles.filterTray,
              {
                borderColor: colors.outlineVariant,
                backgroundColor: colors.surfaceVariant,
              },
            ]}>
            <View style={styles.filterHeader}>
              <ThemedText type="subtitle">Filter by tags</ThemedText>
              <ThemedText style={[styles.filterHint, { color: colors.mutedText }]}>
                Tap to toggle colourful chips and refine the list.
              </ThemedText>
            </View>
            <View style={styles.filterChips}>
              {tagOptions.length === 0 ? (
                <ThemedText style={[styles.filterHint, { color: colors.mutedText }]}>No tags yet.</ThemedText>
              ) : (
                tagOptions.map((tag) => (
                  <TagChip
                    key={tag.id}
                    label={tag.name}
                    color={tag.color}
                    selected={selectedTags.includes(tag.id)}
                    onPress={() => toggleTag(tag.id)}
                  />
                ))
              )}
            </View>
          </View>
        ) : null}

        <View style={styles.headerBlock}>
          <ThemedText type="title">Cocktails</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.mutedText }]}>
            Discover modern specs, spotlighted signatures and crushable crowd pleasers.
          </ThemedText>
        </View>

        <UnderlineTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />

        <View style={styles.sectionIntro}>
          <ThemedText type="subtitle">{activeSection.heading}</ThemedText>
          <ThemedText style={[styles.sectionDescription, { color: colors.mutedText }]}>
            {activeSection.description}
          </ThemedText>
        </View>

        {loading ? (
          <SkeletonList />
        ) : filteredCocktails.length > 0 ? (
          filteredCocktails.map((cocktail) => (
            <CocktailCard
              key={String(cocktail.id ?? cocktail.name)}
              cocktail={cocktail}
              isAvailable={isCocktailAvailable(cocktail, availableIngredientIds)}
              isBranded={isBranded(cocktail)}
              colors={colors}
            />
          ))
        ) : (
          <EmptyState
            message={
              activeSection.key === 'my'
                ? 'Mark more ingredients as in stock to unlock recipes you can pour immediately.'
                : 'Save a cocktail or import a menu to begin curating your list.'
            }
          />
        )}
      </ScrollView>
    </Screen>
  );
}

function CocktailCard({
  cocktail,
  isAvailable,
  isBranded,
  colors,
}: {
  cocktail: Cocktail;
  isAvailable: boolean;
  isBranded: boolean;
  colors: typeof Colors['light'];
}) {
  const ingredientsLine = getIngredientLine(cocktail);
  const rating = computeRating(cocktail);
  const highlightColor = isAvailable
    ? withOpacity(colors.secondary, 0.18)
    : colors.surface;
  const stripeColor = colors.primary;
  const tagDots = (cocktail.tags ?? []).slice(0, 3);

  return (
    <PlatformPressable
      accessibilityRole="button"
      android_ripple={{ color: colors.tertiary }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: highlightColor,
          borderColor: colors.outline,
          opacity: pressed ? 0.92 : 1,
        },
      ]}>
      <View style={styles.cardInner}>
        {isBranded ? <View style={[styles.brandStripe, { backgroundColor: stripeColor }]} /> : null}
        <View style={[styles.thumbnail, { backgroundColor: withOpacity(colors.tertiary, 0.4) }]}>
          <ThemedText style={styles.thumbnailLabel}>{getInitials(cocktail.name)}</ThemedText>
        </View>
        <View style={styles.cardContent}>
          <ThemedText type="subtitle" numberOfLines={1}>
            {cocktail.name}
          </ThemedText>
          <ThemedText style={[styles.cardSecondary, { color: colors.mutedText }]} numberOfLines={1}>
            {ingredientsLine}
          </ThemedText>
          <View style={styles.tagRow}>
            {tagDots.map((tag) => (
              <View key={String(tag.id ?? tag.name)} style={[styles.tagDot, { backgroundColor: tag.color ?? colors.primary }]} />
            ))}
          </View>
        </View>
        <View style={styles.metaColumn}>
          <ThemedText style={[styles.rating, { color: colors.primary }]}>★ {rating}</ThemedText>
          <ThemedText style={[styles.metaFootnote, { color: colors.mutedText }]}>
            {isAvailable ? 'Ready' : 'Needs prep'}
          </ThemedText>
        </View>
      </View>
    </PlatformPressable>
  );
}

function SkeletonList() {
  return (
    <View style={styles.skeletonColumn}>
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.skeleton} />
      ))}
    </View>
  );
}

function EmptyState({ message }: { message: string }) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  return (
    <View style={[styles.emptyState, { borderColor: colors.outline }]}>
      <ThemedText type="subtitle">Nothing to pour yet</ThemedText>
      <ThemedText style={[styles.emptyHint, { color: colors.mutedText }]}>{message}</ThemedText>
    </View>
  );
}

function computeRating(cocktail: Cocktail) {
  const base = (cocktail.ingredients?.length ?? 0) / 2;
  const score = Math.min(4.8, Math.max(3.2, 3.4 + base * 0.18));
  return score.toFixed(1);
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

function getIngredientLine(cocktail: Cocktail) {
  const names = (cocktail.ingredients ?? []).map((item) => item.name).filter(Boolean);
  if (names.length === 0) {
    return 'No ingredients listed yet';
  }
  return names.slice(0, 4).join(' • ');
}

function isCocktailAvailable(cocktail: Cocktail, availableIds: Set<number>) {
  const recipe = cocktail.ingredients ?? [];
  if (recipe.length === 0) {
    return false;
  }
  return recipe.every((item) => {
    const id = Number(item.ingredientId);
    return Number.isFinite(id) && availableIds.has(id);
  });
}

function isBranded(cocktail: Cocktail) {
  return (cocktail.tags ?? []).some((tag) => /signature|house|brand|featured/i.test(tag.name ?? ''));
}

function withOpacity(hex: string, alpha: number) {
  const sanitized = hex.replace('#', '');
  const value = sanitized.length === 3
    ? sanitized
        .split('')
        .map((char) => char + char)
        .join('')
    : sanitized;
  const numeric = parseInt(value, 16);
  const r = (numeric >> 16) & 255;
  const g = (numeric >> 8) & 255;
  const b = numeric & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 120,
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
  filterTray: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  filterHeader: {
    gap: 4,
  },
  filterHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
  },
  brandStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
  },
  thumbnail: {
    width: 50,
    height: 50,
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
    gap: 4,
  },
  rating: {
    fontSize: 13,
    fontWeight: '600',
  },
  metaFootnote: {
    fontSize: 12,
  },
  skeletonColumn: {
    gap: 12,
  },
  skeleton: {
    height: 84,
    borderRadius: 24,
    backgroundColor: 'rgba(165,216,255,0.35)',
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
});
