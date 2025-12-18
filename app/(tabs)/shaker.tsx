import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollectionHeader } from '@/components/CollectionHeader';
import { ListRow, PresenceCheck, Thumb } from '@/components/RowParts';
import { SideMenuDrawer } from '@/components/SideMenuDrawer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import { Colors } from '@/constants/theme';
import { isCocktailReady } from '@/libs/cocktail-availability';
import { createIngredientLookup } from '@/libs/ingredient-availability';
import { useInventory, type Cocktail, type Ingredient } from '@/providers/inventory-provider';
import { palette } from '@/theme/theme';

type IngredientSection = {
  key: string;
  label: string;
  color: string;
  data: Ingredient[];
};

type ShakerIngredientRowProps = {
  ingredient: Ingredient;
  selected: boolean;
  onToggle: (id: number) => void;
  availableCount: number;
  totalCount: number;
};

function ShakerIngredientRow({ ingredient, selected, onToggle, availableCount, totalCount }: ShakerIngredientRowProps) {
  const id = Number(ingredient.id ?? -1);
  const tagColor = ingredient.tags?.[0]?.color ?? palette.tagYellow;

  const handlePress = useCallback(() => {
    if (id >= 0) {
      onToggle(id);
    }
  }, [id, onToggle]);

  let subtitle: string | undefined;
  if (availableCount > 0) {
    const label = availableCount === 1 ? 'cocktail' : 'cocktails';
    subtitle = `Make ${availableCount} ${label}`;
  } else if (totalCount > 0) {
    const label = totalCount === 1 ? 'recipe' : 'recipes';
    subtitle = `${totalCount} ${label}`;
  }

  return (
    <ListRow
      title={ingredient.name}
      subtitle={subtitle}
      onPress={handlePress}
      selected={selected}
      highlightColor={palette.highlightSubtle}
      tagColor={tagColor}
      thumbnail={<Thumb label={ingredient.name} uri={ingredient.photoUri} />}
      metaAlignment="center"
    />
  );
}

export default function ShakerScreen() {
  const router = useRouter();
  const {
    cocktails,
    ingredients,
    availableIngredientIds,
    ignoreGarnish,
    allowAllSubstitutes,
  } = useInventory();
  const [query, setQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<Set<number>>(() => new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set());
  const paletteColors = Colors;
  const ingredientLookup = useMemo(() => createIngredientLookup(ingredients), [ingredients]);

  const builtInTagOrder = useMemo(() => {
    const map = new Map<string, number>();
    BUILTIN_INGREDIENT_TAGS.forEach((tag, index) => {
      map.set(String(tag.id), index);
      if (tag.name) {
        map.set(tag.name.trim().toLowerCase(), index);
      }
    });
    return map;
  }, []);

  const ingredientById = useMemo(() => {
    const map = new Map<number, Ingredient>();
    ingredients.forEach((ingredient) => {
      const id = Number(ingredient.id ?? -1);
      if (Number.isFinite(id) && id >= 0) {
        map.set(id, ingredient);
      }
    });
    return map;
  }, [ingredients]);

  const getBaseGroupId = useCallback(
    (rawId: number | string | null | undefined) => {
      if (rawId == null) {
        return undefined;
      }

      const id = Number(rawId);
      if (!Number.isFinite(id) || id < 0) {
        return undefined;
      }

      const ingredient = ingredientById.get(id);
      if (ingredient?.baseIngredientId != null) {
        const baseId = Number(ingredient.baseIngredientId);
        if (Number.isFinite(baseId) && baseId >= 0) {
          return baseId;
        }
      }

      if (ingredient?.id != null) {
        const ownId = Number(ingredient.id);
        if (Number.isFinite(ownId) && ownId >= 0) {
          return ownId;
        }
      }

      return id;
    },
    [ingredientById],
  );

  const resolveCocktailKey = useCallback((cocktail: Cocktail) => {
    const id = cocktail.id;
    if (id != null) {
      return String(id);
    }

    if (cocktail.name) {
      return cocktail.name.trim().toLowerCase();
    }

    return undefined;
  }, []);

  const normalizedQuery = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const tokens = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    return { text: trimmed, tokens };
  }, [query]);

  const filteredIngredients = useMemo(() => {
    const baseList = ingredients.filter((ingredient) => {
      const id = Number(ingredient.id ?? -1);
      if (inStockOnly && !(id >= 0 && availableIngredientIds.has(id))) {
        return false;
      }

      if (!normalizedQuery.text) {
        return true;
      }

      const { text, tokens } = normalizedQuery;
      if (tokens.length <= 1) {
        const token = tokens[0] ?? text;
        return ingredient.searchNameNormalized.includes(token);
      }

      return tokens.every(
        (token) =>
          ingredient.searchTokensNormalized.includes(token) ||
          ingredient.searchNameNormalized.includes(token),
      );
    });

    return baseList.sort((a, b) => a.searchNameNormalized.localeCompare(b.searchNameNormalized));
  }, [availableIngredientIds, inStockOnly, ingredients, normalizedQuery]);

  const sections = useMemo<IngredientSection[]>(() => {
    const map = new Map<string, IngredientSection>();

    const ensureSection = (key: string, label: string, color: string) => {
      if (!map.has(key)) {
        map.set(key, { key, label, color, data: [] });
      }
      return map.get(key)!;
    };

    filteredIngredients.forEach((ingredient) => {
      const tags = ingredient.tags ?? [];
      if (tags.length === 0) {
        ensureSection('other', 'Other', palette.tagYellow ?? palette.highlightFaint).data.push(ingredient);
        return;
      }

      const tag = tags[0]!;
      const key = tag.id != null ? String(tag.id) : tag.name?.toLowerCase() ?? 'tag';
      ensureSection(key, tag.name ?? 'Other', tag.color ?? palette.tagYellow).data.push(ingredient);
    });

    const ordered = Array.from(map.values()).map((section) => ({
      ...section,
      data: [...section.data].sort((a, b) => a.searchNameNormalized.localeCompare(b.searchNameNormalized)),
    }));

    ordered.sort((a, b) => {
      const orderA = builtInTagOrder.get(a.key) ?? builtInTagOrder.get(a.label.trim().toLowerCase());
      const orderB = builtInTagOrder.get(b.key) ?? builtInTagOrder.get(b.label.trim().toLowerCase());

      if (orderA != null || orderB != null) {
        if (orderA == null) {
          return 1;
        }

        if (orderB == null) {
          return -1;
        }

        if (orderA !== orderB) {
          return orderA - orderB;
        }
      }

      return a.label.localeCompare(b.label);
    });

    return ordered;
  }, [builtInTagOrder, filteredIngredients]);

  useEffect(() => {
    const validKeys = new Set(sections.map((section) => section.key));
    setCollapsedSections((previous) => {
      const next = new Set<string>();
      previous.forEach((key) => {
        if (validKeys.has(key)) {
          next.add(key);
        }
      });
      return next;
    });
  }, [sections]);

  const renderedSections = useMemo(() => {
    return sections.map((section) =>
      collapsedSections.has(section.key) ? { ...section, data: [] } : section,
    );
  }, [collapsedSections, sections]);

  const cocktailBaseMap = useMemo(() => {
    const map = new Map<string, Set<number>>();

    cocktails.forEach((cocktail) => {
      const key = resolveCocktailKey(cocktail);
      if (!key) {
        return;
      }

      const baseIds = new Set<number>();
      (cocktail.ingredients ?? []).forEach((item) => {
        const baseId = getBaseGroupId(item.ingredientId);
        if (baseId != null) {
          baseIds.add(baseId);
        }

        (item.substitutes ?? []).forEach((substitute) => {
          const substituteBaseId = getBaseGroupId(substitute.ingredientId ?? substitute.id);
          if (substituteBaseId != null) {
            baseIds.add(substituteBaseId);
          }
        });
      });

      if (baseIds.size > 0) {
        map.set(key, baseIds);
      }
    });

    return map;
  }, [cocktails, getBaseGroupId, resolveCocktailKey]);

  const totalCountByBase = useMemo(() => {
    const counts = new Map<number, number>();
    cocktailBaseMap.forEach((baseIds) => {
      baseIds.forEach((baseId) => {
        counts.set(baseId, (counts.get(baseId) ?? 0) + 1);
      });
    });
    return counts;
  }, [cocktailBaseMap]);

  const availableCocktailKeys = useMemo(() => {
    const set = new Set<string>();

    cocktails.forEach((cocktail) => {
      const key = resolveCocktailKey(cocktail);
      if (!key) {
        return;
      }

      const isAvailable = isCocktailReady(
        cocktail,
        availableIngredientIds,
        ingredientLookup,
        undefined,
        { ignoreGarnish, allowAllSubstitutes },
      );

      if (isAvailable) {
        set.add(key);
      }
    });

    return set;
  }, [allowAllSubstitutes, availableIngredientIds, cocktails, ignoreGarnish, ingredientLookup, resolveCocktailKey]);

  const availableCountByBase = useMemo(() => {
    const counts = new Map<number, number>();

    cocktailBaseMap.forEach((baseIds, cocktailKey) => {
      if (!availableCocktailKeys.has(cocktailKey)) {
        return;
      }

      baseIds.forEach((baseId) => {
        counts.set(baseId, (counts.get(baseId) ?? 0) + 1);
      });
    });

    return counts;
  }, [availableCocktailKeys, cocktailBaseMap]);

  const selectedBaseIds = useMemo(() => {
    const ids = new Set<number>();
    selectedIngredientIds.forEach((id) => {
      const baseId = getBaseGroupId(id);
      if (baseId != null) {
        ids.add(baseId);
      }
    });
    return ids;
  }, [getBaseGroupId, selectedIngredientIds]);

  const matchingCocktailKeys = useMemo(() => {
    if (selectedBaseIds.size === 0) {
      return new Set<string>();
    }

    const matches = new Set<string>();
    cocktailBaseMap.forEach((baseIds, cocktailKey) => {
      const hasAllSelected = Array.from(selectedBaseIds).every((id) => baseIds.has(id));
      if (hasAllSelected) {
        matches.add(cocktailKey);
      }
    });

    return matches;
  }, [cocktailBaseMap, selectedBaseIds]);

  const availableMatchingCocktailKeys = useMemo(() => {
    const matches = new Set<string>();
    matchingCocktailKeys.forEach((key) => {
      if (availableCocktailKeys.has(key)) {
        matches.add(key);
      }
    });
    return matches;
  }, [availableCocktailKeys, matchingCocktailKeys]);

  const handleToggleIngredient = useCallback((id: number) => {
    if (id < 0) {
      return;
    }

    setSelectedIngredientIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleSection = useCallback((key: string) => {
    setCollapsedSections((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIngredientIds((previous) => {
      if (previous.size === 0) {
        return previous;
      }
      return new Set<number>();
    });
  }, []);

  const handleShowResults = useCallback(() => {
    if (matchingCocktailKeys.size === 0) {
      return;
    }

    router.push({
      pathname: '/shaker/results',
      params: {
        matched: Array.from(matchingCocktailKeys).join(','),
        available: Array.from(availableMatchingCocktailKeys).join(','),
      },
    });
  }, [availableMatchingCocktailKeys, matchingCocktailKeys, router]);

  const toggleInStockOnly = useCallback(() => {
    setInStockOnly((previous) => !previous);
  }, []);

  const renderSectionHeader = useCallback(
    ({ section }: { section: IngredientSection }) => {
      const collapsed = collapsedSections.has(section.key);
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Toggle ${section.label} ingredients`}
          onPress={() => handleToggleSection(section.key)}
          style={[
            styles.sectionHeader,
            {
              backgroundColor: `${section.color}26`,
              borderColor: `${section.color}44`,
              marginBottom: collapsed ? 4 : 0,
            },
          ]}>
          <View style={styles.sectionHeaderContent}>
            <View style={[styles.sectionDot, { backgroundColor: section.color }]} />
            <Text style={[styles.sectionTitle, { color: paletteColors.onSurface }]}>{section.label}</Text>
            <MaterialCommunityIcons
              name={collapsed ? 'chevron-down' : 'chevron-up'}
              size={20}
              color={paletteColors.onSurface}
            />
          </View>
        </Pressable>
      );
    },
    [collapsedSections, handleToggleSection, paletteColors.onSurface],
  );

  const renderIngredient = useCallback(
    ({ item }: { item: Ingredient }) => {
      const id = Number(item.id ?? -1);
      const baseId = id >= 0 ? getBaseGroupId(id) : undefined;
      const availableCount = baseId != null ? availableCountByBase.get(baseId) ?? 0 : 0;
      const totalCount = baseId != null ? totalCountByBase.get(baseId) ?? 0 : 0;
      const isSelected = id >= 0 && selectedIngredientIds.has(id);

      return (
        <ShakerIngredientRow
          ingredient={item}
          selected={isSelected}
          onToggle={handleToggleIngredient}
          availableCount={availableCount}
          totalCount={totalCount}
        />
      );
    },
    [availableCountByBase, getBaseGroupId, handleToggleIngredient, selectedIngredientIds, totalCountByBase],
  );

  const inStockToggle = (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: inStockOnly }}
      onPress={toggleInStockOnly}
      style={[styles.stockToggle, { borderColor: paletteColors.outlineVariant }]}>
      <PresenceCheck checked={inStockOnly} />
    </Pressable>
  );

  const matchingCount = matchingCocktailKeys.size;
  const availableCount = availableMatchingCocktailKeys.size;
  const isShowDisabled = matchingCount === 0;
  const isClearDisabled = selectedIngredientIds.size === 0;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: paletteColors.background }]}
      edges={['top', 'left', 'right']}>
      <ThemedView style={[styles.screen, { backgroundColor: paletteColors.background }]}>
        <CollectionHeader
          searchValue={query}
          onSearchChange={setQuery}
          placeholder="Search"
          onMenuPress={() => setIsMenuOpen(true)}
          rightAccessory={inStockToggle}
        />
        <View style={styles.container}>
          <SectionList
            sections={renderedSections}
            keyExtractor={(item) => String(item.id ?? item.name)}
            renderSectionHeader={renderSectionHeader}
            renderItem={renderIngredient}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => (
              <View style={[styles.divider, { backgroundColor: paletteColors.outlineVariant }]} />
            )}
            stickySectionHeadersEnabled={false}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyLabel}>Mark which ingredients are in stock first</ThemedText>
              </View>
            }
          />
        </View>
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: paletteColors.surface,
              borderTopColor: paletteColors.outlineVariant,
            },
          ]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear selected ingredients"
            onPress={handleClearSelection}
            disabled={isClearDisabled}
            style={[
              styles.clearButton,
              {
                borderColor: paletteColors.error,
                opacity: isClearDisabled ? 0.5 : 1,
              },
            ]}>
            <Text style={[styles.clearLabel, { color: paletteColors.error }]}>Clear</Text>
          </Pressable>
          <View style={styles.counterArea}>
            <Text style={[styles.counterLabel, { color: paletteColors.onSurface }]}>Cocktails available: {availableCount}</Text>
            <Text style={[styles.counterSubLabel, { color: paletteColors.onSurfaceVariant }]}>
              (recipes available: {matchingCount})
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={isShowDisabled ? { disabled: true } : undefined}
            onPress={handleShowResults}
            disabled={isShowDisabled}
            style={[
              styles.showButton,
              {
                backgroundColor: isShowDisabled ? paletteColors.outlineVariant : paletteColors.tint,
              },
            ]}>
            <Text
              style={[
                styles.showLabel,
                { color: isShowDisabled ? paletteColors.onSurfaceVariant : paletteColors.onPrimary },
              ]}>
              Show
            </Text>
          </Pressable>
        </View>
        <SideMenuDrawer visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 140,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  sectionHeader: {
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyLabel: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  clearButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  counterArea: {
    flex: 1,
    alignItems: 'center',
  },
  counterLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  counterSubLabel: {
    fontSize: 13,
    marginTop: 2,
  },
  showButton: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  stockToggle: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
