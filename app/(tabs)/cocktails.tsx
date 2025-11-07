import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { FabAdd } from '@/components/FabAdd';
import { CocktailListRow } from '@/components/CocktailListRow';
import { CollectionHeader } from '@/components/CollectionHeader';
import type { SegmentTabOption } from '@/components/TopBars';
import { Colors } from '@/constants/theme';
import { tagColors } from '@/theme/theme';
import { useInventory, type Cocktail } from '@/providers/inventory-provider';

type CocktailSection = {
  key: string;
  label: string;
  data: Cocktail[];
};

type CocktailTabKey = 'all' | 'my' | 'favorites';

const TAB_OPTIONS: SegmentTabOption[] = [
  { key: 'all', label: 'All' },
  { key: 'my', label: 'My' },
  { key: 'favorites', label: 'Favorites' },
];

type CocktailTagRecord = NonNullable<Cocktail['tags']>[number];

type TagFilterOption = {
  key: string;
  name: string;
  color: string;
  count: number;
};

type TagFilterModalProps = {
  visible: boolean;
  options: TagFilterOption[];
  selectedTagIds: Set<string>;
  onToggle: (key: string) => void;
  onClear: () => void;
  onClose: () => void;
};

function getTagKey(tag: CocktailTagRecord | null | undefined): string | undefined {
  if (!tag) {
    return undefined;
  }

  if (tag.id != null) {
    return `id:${tag.id}`;
  }

  if (tag.name) {
    const normalized = tag.name.trim().toLowerCase();
    if (normalized) {
      return `name:${normalized}`;
    }
  }

  return undefined;
}

function TagFilterModal({
  visible,
  options,
  selectedTagIds,
  onToggle,
  onClear,
  onClose,
}: TagFilterModalProps) {
  const paletteColors = Colors;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View
        style={[styles.modalOverlay, { backgroundColor: paletteColors.backdrop }]}
        pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss tag filter"
          onPress={onClose}
          style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}
        />
        <View
          accessibilityRole="dialog"
          accessibilityLabel="Filter cocktails by tags"
          style={[
            styles.modalContent,
            {
              backgroundColor: paletteColors.surface,
              borderColor: paletteColors.outline,
            },
          ]}>
          <Text style={[styles.modalTitle, { color: paletteColors.onSurface }]}>Filter by tags</Text>
          {options.length > 0 ? (
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}>
              {options.map((option) => {
                const selected = selectedTagIds.has(option.key);
                const labelColor = selected ? paletteColors.onPrimary : paletteColors.onSurface;

                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    accessibilityState={selected ? { selected: true } : undefined}
                    onPress={() => onToggle(option.key)}
                    style={[
                      styles.tagOptionRow,
                      {
                        borderColor: option.color,
                        backgroundColor: selected
                          ? option.color
                          : paletteColors.surfaceVariant,
                      },
                    ]}>
                    <View style={[styles.tagOptionSwatch, { backgroundColor: option.color }]} />
                    <Text style={[styles.tagOptionLabel, { color: labelColor }]}>
                      {option.name}
                      {option.count > 0 ? ` (${option.count})` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={[styles.modalEmptyText, { color: paletteColors.onSurfaceVariant }]}>No tags available</Text>
          )}
          <View style={styles.modalActions}>
            <Pressable
              accessibilityRole="button"
              onPress={onClear}
              style={[styles.modalActionSecondary, { borderColor: paletteColors.outline }]}>
              <Text style={[styles.modalActionSecondaryLabel, { color: paletteColors.onSurface }]}>Clear</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={[styles.modalActionPrimary, { backgroundColor: paletteColors.primary }]}>
              <Text style={[styles.modalActionPrimaryLabel, { color: paletteColors.onPrimary }]}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function CocktailsScreen() {
  const { cocktails, availableIngredientIds } = useInventory();
  const [activeTab, setActiveTab] = useState<CocktailTabKey>('all');
  const [query, setQuery] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(() => new Set());
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);
  const paletteColors = Colors;
  const router = useRouter();

  const readyToMix = useMemo(() => {
    return cocktails.filter((cocktail) => {
      const recipe = cocktail.ingredients ?? [];
      if (recipe.length === 0) {
        return false;
      }
      return recipe.every((item) => {
        if (item?.optional || item?.garnish) {
          return true;
        }

        const id = typeof item.ingredientId === 'number' ? item.ingredientId : undefined;
        if (id == null) {
          return false;
        }

        return availableIngredientIds.has(id);
      });
    });
  }, [cocktails, availableIngredientIds]);

  const ratedCocktails = useMemo(() => {
    return cocktails.filter((cocktail) => {
      const ratingValue = Number((cocktail as { userRating?: number }).userRating ?? 0);
      return ratingValue > 0;
    });
  }, [cocktails]);

  const tagOptions = useMemo(() => {
    const map = new Map<string, TagFilterOption>();

    cocktails.forEach((cocktail) => {
      (cocktail.tags ?? []).forEach((tag) => {
        const key = getTagKey(tag);
        if (!key) {
          return;
        }

        const color = tag.color ?? tagColors.default;
        const name = tag.name?.trim() || 'Untitled';
        const existing = map.get(key);

        if (existing) {
          existing.count += 1;
          if (!existing.color && color) {
            existing.color = color;
          }
        } else {
          map.set(key, {
            key,
            name,
            color,
            count: 1,
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [cocktails]);

  const tagOptionByKey = useMemo(() => {
    const map = new Map<string, TagFilterOption>();
    tagOptions.forEach((option) => {
      map.set(option.key, option);
    });
    return map;
  }, [tagOptions]);

  const selectedTagColor = useMemo(() => {
    if (selectedTagIds.size === 0) {
      return undefined;
    }

    const keys = Array.from(selectedTagIds);
    const highlightKey = keys[keys.length - 1] ?? keys[0];
    return highlightKey ? tagOptionByKey.get(highlightKey)?.color : undefined;
  }, [selectedTagIds, tagOptionByKey]);

  useEffect(() => {
    setSelectedTagIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }

      const next = new Set<string>();
      let changed = false;

      prev.forEach((key) => {
        if (tagOptionByKey.has(key)) {
          next.add(key);
        } else {
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [tagOptionByKey]);

  const sections = useMemo<Record<CocktailTabKey, CocktailSection>>(() => {
    return {
      all: { key: 'all', label: 'All', data: cocktails },
      my: { key: 'my', label: 'My', data: readyToMix },
      favorites: {
        key: 'favorites',
        label: 'Favorites',
        data: ratedCocktails,
      },
    };
  }, [cocktails, readyToMix, ratedCocktails]);

  const activeSection = sections[activeTab] ?? sections.all;

  const normalizedQuery = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const tokens = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    return { text: trimmed, tokens };
  }, [query]);

  const filteredCocktails = useMemo(() => {
    let base = activeSection.data;

    if (selectedTagIds.size > 0) {
      base = base.filter((cocktail) => {
        const tagKeys = (cocktail.tags ?? [])
          .map((tag) => getTagKey(tag))
          .filter((key): key is string => Boolean(key));

        if (tagKeys.length === 0) {
          return false;
        }

        return tagKeys.some((key) => selectedTagIds.has(key));
      });
    }

    if (!normalizedQuery.text) {
      return base;
    }

    const { text, tokens } = normalizedQuery;
    if (tokens.length <= 1) {
      const token = tokens[0] ?? text;
      return base.filter((cocktail) => cocktail.searchNameNormalized.includes(token));
    }

    return base.filter((cocktail) =>
      tokens.every(
        (token) =>
          cocktail.searchTokensNormalized.includes(token) ||
          cocktail.searchNameNormalized.includes(token),
      ),
    );
  }, [activeSection.data, normalizedQuery, selectedTagIds]);

  const separatorColor = paletteColors.outline;

  const keyExtractor = useCallback((item: Cocktail) => String(item.id ?? item.name), []);

  const handleSelectCocktail = useCallback(
    (cocktail: Cocktail) => {
      const candidateId = cocktail.id ?? cocktail.name;
      if (!candidateId) {
        return;
      }

      router.push({ pathname: '/cocktail/[cocktailId]', params: { cocktailId: String(candidateId) } });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: Cocktail }) => (
      <CocktailListRow
        cocktail={item}
        availableIngredientIds={availableIngredientIds}
        onPress={() => handleSelectCocktail(item)}
      />
    ),
    [availableIngredientIds, handleSelectCocktail],
  );

  const renderSeparator = useCallback(
    () => <View style={[styles.divider, { backgroundColor: separatorColor }]} />,
    [separatorColor],
  );

  const handleToggleTag = useCallback(
    (key: string) => {
      if (!tagOptionByKey.has(key)) {
        return;
      }

      setSelectedTagIds((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    },
    [tagOptionByKey],
  );

  const handleClearTags = useCallback(() => {
    setSelectedTagIds(() => new Set());
  }, []);

  const handleOpenFilter = useCallback(() => {
    setFilterModalVisible(true);
  }, []);

  const handleCloseFilter = useCallback(() => {
    setFilterModalVisible(false);
  }, []);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: paletteColors.background }]}
      edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <CollectionHeader
          searchValue={query}
          onSearchChange={setQuery}
          placeholder="Search"
          tabs={TAB_OPTIONS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onFilterPress={handleOpenFilter}
          filterButtonColor={selectedTagColor}
          filterHighlightColor={selectedTagColor}
        />
        <FlatList
          data={filteredCocktails}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={renderSeparator}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={[styles.emptyLabel, { color: paletteColors.onSurfaceVariant }]}>No cocktails yet</Text>
          }
        />
      </View>
      <FabAdd label="Add cocktail" />
      <TagFilterModal
        visible={isFilterModalVisible}
        options={tagOptions}
        selectedTagIds={selectedTagIds}
        onToggle={handleToggleTag}
        onClear={handleClearTags}
        onClose={handleCloseFilter}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: 0,
    paddingBottom: 80,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  emptyLabel: {
    textAlign: 'center',
    marginTop: 80,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'left',
  },
  modalScroll: {
    maxHeight: 280,
  },
  modalScrollContent: {
    gap: 12,
    paddingBottom: 4,
  },
  tagOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tagOptionSwatch: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  tagOptionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  modalEmptyText: {
    textAlign: 'center',
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalActionSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalActionSecondaryLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  modalActionPrimary: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalActionPrimaryLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
