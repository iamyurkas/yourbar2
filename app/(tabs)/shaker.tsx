import React, { useMemo, useState } from 'react';
import { PlatformPressable } from '@react-navigation/elements';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';
import { SearchHeader } from '@/components/ui/search-header';
import { Badge } from '@/components/ui/badge';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useInventory, type Cocktail, type Ingredient } from '@/providers/inventory-provider';

export default function ShakerScreen() {
  const { ingredients, cocktails, availableIngredientIds } = useInventory();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const [query, setQuery] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const grouped = useMemo(() => {
    const map = new Map<string, { color: string; items: Ingredient[] }>();
    const baseList = ingredients.filter((ingredient) => {
      if (!query.trim()) {
        return true;
      }
      return ingredient.name.toLowerCase().includes(query.trim().toLowerCase());
    });

    return baseList.reduce((acc, ingredient) => {
      if (inStockOnly) {
        const id = Number(ingredient.id ?? -1);
        if (!availableIngredientIds.has(id)) {
          return acc;
        }
      }

      const tag = ingredient.tags?.[0];
      const key = tag?.name ?? 'Untagged';
      const color = tag?.color ?? colors.primary;
      const entry = acc.get(key) ?? { color, items: [] };
      entry.items.push(ingredient);
      acc.set(key, entry);
      return acc;
    }, map);
  }, [ingredients, query, inStockOnly, availableIngredientIds, colors.primary]);

  const readyCocktails = useMemo(() => {
    return cocktails.filter((cocktail) => isCocktailReady(cocktail, availableIngredientIds));
  }, [cocktails, availableIngredientIds]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  const clearSelections = () => setSelectedIds([]);

  return (
    <Screen>
      <View style={styles.flex1}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <SearchHeader
            query={query}
            onQueryChange={setQuery}
            placeholder="Search shaker tools"
            onPressMenu={() => {}}
            onPressFilter={() => setInStockOnly((prev) => !prev)}
            filterActive={inStockOnly}
          />

          {Array.from(grouped.entries()).map(([groupName, { color, items }]) => {
            const expanded = expandedGroups[groupName] ?? true;
            return (
              <View key={groupName} style={styles.groupBlock}>
                <PlatformPressable
                  accessibilityRole="button"
                  onPress={() => toggleGroup(groupName)}
                  android_ripple={{ color: '#ffffff22' }}
                  style={({ pressed }) => [
                    styles.groupChip,
                    {
                      backgroundColor: color,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}>
                  <ThemedText style={styles.groupLabel}>{groupName}</ThemedText>
                  <Badge label={expanded ? 'Hide' : 'Show'} tone="info" />
                </PlatformPressable>

                {expanded ? (
                  <View style={styles.groupList}>
                    {items.map((ingredient) => {
                      const id = Number(ingredient.id ?? -1);
                      const isSelected = selectedIds.includes(id);
                      const isAvailable = id >= 0 && availableIngredientIds.has(id);
                      const badgeTone = isAvailable ? 'success' : 'neutral';
                      return (
                        <PlatformPressable
                          key={String(ingredient.id ?? ingredient.name)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isSelected }}
                          onPress={() => toggleSelection(id)}
                          android_ripple={{ color: '#D3F9D844' }}
                          style={({ pressed }) => [
                            styles.row,
                            {
                              backgroundColor: isSelected ? 'rgba(211,249,216,0.6)' : colors.surface,
                              borderColor: colors.outline,
                              opacity: pressed ? 0.92 : 1,
                            },
                          ]}>
                          <View style={[styles.rowThumbnail, { backgroundColor: `${color}22` }]}>
                            <ThemedText style={styles.rowInitial}>{getInitials(ingredient.name)}</ThemedText>
                          </View>
                          <View style={styles.rowBody}>
                            <ThemedText type="subtitle" numberOfLines={1}>
                              {ingredient.name}
                            </ThemedText>
                            <ThemedText style={[styles.rowDetail, { color: colors.mutedText }]} numberOfLines={1}>
                              {(ingredient.description ?? '').slice(0, 72) || 'No tasting notes yet.'}
                            </ThemedText>
                          </View>
                          <View style={styles.rowMeta}>
                            <Badge label={isAvailable ? 'In stock' : 'Out'} tone={badgeTone} />
                            <ThemedText style={[styles.rowMetaText, { color: colors.mutedText }]}>
                              {isSelected ? 'Queued' : 'Add'}
                            </ThemedText>
                          </View>
                        </PlatformPressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
        <View style={[styles.counterBar, { borderColor: colors.outlineVariant, backgroundColor: colors.surface }]}>
          <View>
            <ThemedText type="subtitle">Cocktails available</ThemedText>
            <ThemedText style={[styles.counterMeta, { color: colors.mutedText }]}>
              {readyCocktails.length} ready to pour
            </ThemedText>
          </View>
          <View style={styles.counterActions}>
            <PlatformPressable
              onPress={clearSelections}
              android_ripple={{ color: '#FFC9C9' }}
              style={({ pressed }) => [
                styles.clearButton,
                {
                  borderColor: '#FA5252',
                  opacity: pressed ? 0.85 : 1,
                },
              ]}>
              <ThemedText style={[styles.clearLabel, { color: '#FA5252' }]}>Clear</ThemedText>
            </PlatformPressable>
            <PlatformPressable
              disabled={selectedIds.length === 0}
              onPress={() => {}}
              android_ripple={{ color: '#74C0FC66' }}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor:
                    selectedIds.length === 0
                      ? 'rgba(77,171,247,0.35)'
                      : pressed
                        ? '#3D9CE0'
                        : '#4DABF7',
                  opacity: pressed && selectedIds.length > 0 ? 0.9 : 1,
                },
              ]}>
              <ThemedText style={styles.primaryLabel}>Show</ThemedText>
            </PlatformPressable>
          </View>
        </View>
      </View>
    </Screen>
  );
}

function isCocktailReady(cocktail: Cocktail, availableIds: Set<number>) {
  const recipe = cocktail.ingredients ?? [];
  if (recipe.length === 0) {
    return false;
  }
  return recipe.every((item) => {
    const id = Number(item.ingredientId);
    return Number.isFinite(id) && availableIds.has(id);
  });
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
  groupBlock: {
    gap: 12,
  },
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  groupLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  groupList: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  rowThumbnail: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInitial: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowDetail: {
    fontSize: 13,
    lineHeight: 18,
  },
  rowMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  rowMetaText: {
    fontSize: 12,
  },
  counterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  counterMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  counterActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  clearButton: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  clearLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  primaryButton: {
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
