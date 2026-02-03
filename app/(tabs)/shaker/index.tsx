import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useScrollToTop } from '@react-navigation/native';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type SectionListData,
  type SectionListRenderItemInfo,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ListRow, PresenceCheck, Thumb } from '@/components/RowParts';
import { SideMenuDrawer } from '@/components/SideMenuDrawer';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import { useAppColors } from '@/constants/theme';
import { isCocktailReady } from '@/libs/cocktail-availability';
import {
  createIngredientLookup,
  getVisibleIngredientIdsForCocktail,
} from '@/libs/ingredient-availability';
import { normalizeSearchText } from '@/libs/search-normalization';
import { useInventory, type Cocktail, type Ingredient } from '@/providers/inventory-provider';
import { tagColors } from '@/theme/theme';

type IngredientTagOption = {
  key: string;
  name: string;
  color: string;
};

type IngredientGroup = IngredientTagOption & {
  ingredients: Ingredient[];
};

type IngredientSection = IngredientGroup & {
  data: Ingredient[];
};

type IngredientRowProps = {
  ingredient: Ingredient;
  isSelected: boolean;
  isAvailable: boolean;
  isOnShoppingList: boolean;
  subtitle?: string;
  subtitleStyle?: StyleProp<TextStyle>;
  onToggle: (id: number) => void;
};

const IngredientRow = memo(function IngredientRow({
  ingredient,
  isSelected,
  isAvailable,
  isOnShoppingList,
  subtitle,
  subtitleStyle,
  onToggle,
}: IngredientRowProps) {
  const Colors = useAppColors();
  const ingredientId = Number(ingredient.id ?? -1);
  const ingredientTagColors = (ingredient.tags ?? [])
    .map((tag) => tag?.color ?? tagColors.yellow)
    .filter(Boolean);
  const brandIndicatorColor = ingredient.baseIngredientId != null ? Colors.primary : undefined;

  const handlePress = useCallback(() => {
    if (ingredientId >= 0) {
      onToggle(ingredientId);
    }
  }, [ingredientId, onToggle]);

  const highlightColor = isSelected ? Colors.highlightSubtle : Colors.highlightFaint;
  const thumbnail = useMemo(
    () => <Thumb label={ingredient.name} uri={ingredient.photoUri} />,
    [ingredient.name, ingredient.photoUri],
  );
  const shoppingControl = useMemo(() => {
    if (!isOnShoppingList) {
      return <View style={styles.shoppingIconPlaceholder} />;
    }

    return (
      <MaterialIcons
        name="shopping-cart"
        size={20}
        color={Colors.tint}
        style={styles.shoppingIcon}
        accessibilityRole="image"
        accessibilityLabel="On shopping list"
      />
    );
  }, [isOnShoppingList, Colors]);
  const selectionControl = useMemo(() => {
    if (!isSelected) {
      return null;
    }

    return <MaterialIcons name="check" size={18} color={Colors.tint} />;
  }, [isSelected, Colors]);

  return (
    <ListRow
      title={ingredient.name}
      subtitle={subtitle}
      subtitleStyle={subtitleStyle}
      onPress={handlePress}
      selected={isSelected || isAvailable}
      highlightColor={highlightColor}
      tagColors={ingredientTagColors}
      thumbnail={thumbnail}
      accessibilityRole="button"
      accessibilityState={isSelected ? { selected: true } : undefined}
      brandIndicatorColor={brandIndicatorColor}
      metaAlignment="center"
      control={selectionControl}
      metaFooter={shoppingControl}
    />
  );
});

function normalizeTagKey(tag?: { id?: number | null; name?: string | null }) {
  if (!tag) {
    return undefined;
  }

  if (tag.id != null) {
    return String(tag.id);
  }

  return tag.name?.trim().toLowerCase();
}

function getIngredientTagKey(ingredient: Ingredient, fallbackKey?: string) {
  return normalizeTagKey(ingredient.tags?.[0]) ?? fallbackKey ?? 'other';
}

function resolveCocktailKey(cocktail: Cocktail) {
  if (cocktail.id != null) {
    return String(cocktail.id);
  }

  if (cocktail.name) {
    return cocktail.name.trim().toLowerCase();
  }

  return undefined;
}

const COLLAPSED_HEADER_PREFIX = '__collapsed_header__';

function makeCollapsedHeaderItem(key: string): Ingredient {
  return {
    id: `${COLLAPSED_HEADER_PREFIX}${key}`,
    name: '',
  } as Ingredient;
}

function isCollapsedHeaderItem(item: Ingredient) {
  return typeof item.id === 'string' && item.id.startsWith(COLLAPSED_HEADER_PREFIX);
}

export default function ShakerScreen() {
  const router = useRouter();
  const Colors = useAppColors();
  const {
    cocktails,
    ingredients,
    availableIngredientIds,
    shoppingIngredientIds,
    ignoreGarnish,
    allowAllSubstitutes,
  } = useInventory();
  const [query, setQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [expandedTagKeys, setExpandedTagKeys] = useState<Set<string>>(() => new Set());
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<Set<number>>(() => new Set());
  const listRef = useRef<SectionList<Ingredient, IngredientSection>>(null);
  const lastScrollOffset = useRef(0);
  const searchStartOffset = useRef<number | null>(null);
  const previousQuery = useRef(query);
  const headerPressTimestamps = useRef<Map<string, number>>(new Map());
  const headerTouchState = useRef<
    Map<string, { startY: number; moved: boolean; didPress: boolean }>
  >(new Map());
  const insets = useSafeAreaInsets();
  const bottomInset = Math.min(insets.bottom, 8);
  const defaultTagColor = tagColors.yellow ?? Colors.highlightFaint;

  useScrollToTop(listRef);

  useEffect(() => {
    const wasEmpty = previousQuery.current.length === 0;
    const isEmpty = query.length === 0;

    if (wasEmpty && !isEmpty) {
      searchStartOffset.current = lastScrollOffset.current;
    } else if (!wasEmpty && isEmpty && searchStartOffset.current !== null) {
      const restoreOffset = searchStartOffset.current;
      searchStartOffset.current = null;
      requestAnimationFrame(() => {
        listRef.current?.getScrollResponder?.()?.scrollTo({ y: restoreOffset, animated: false });
      });
    }

    previousQuery.current = query;
  }, [query]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    lastScrollOffset.current = event.nativeEvent.contentOffset.y;
  }, []);

  const normalizedQuery = useMemo(() => {
    const normalized = normalizeSearchText(query);
    const tokens = normalized ? normalized.split(/\s+/).filter(Boolean) : [];
    return { text: normalized, tokens };
  }, [query]);

  const filteredIngredients = useMemo(() => {
    let base = ingredients;

    if (inStockOnly) {
      base = base.filter((ingredient) => {
        const id = Number(ingredient.id ?? -1);
        return id >= 0 && availableIngredientIds.has(id);
      });
    }

    if (!normalizedQuery.text) {
      return base;
    }

    const { text, tokens } = normalizedQuery;
    if (tokens.length <= 1) {
      const token = tokens[0] ?? text;
      return base.filter((ingredient) => ingredient.searchNameNormalized.includes(token));
    }

    return base.filter((ingredient) =>
      tokens.every(
        (token) =>
          ingredient.searchTokensNormalized.includes(token) ||
          ingredient.searchNameNormalized.includes(token),
      ),
    );
  }, [availableIngredientIds, ingredients, inStockOnly, normalizedQuery]);

  const availableTagOptions = useMemo<IngredientTagOption[]>(() => {
    const map = new Map<string, IngredientTagOption>();
    const builtinTagOrder = new Map<string, number>();

    BUILTIN_INGREDIENT_TAGS.forEach((tag, index) => {
      const key = normalizeTagKey(tag);
      if (key) {
        builtinTagOrder.set(key, index);
      }

      if (tag.name) {
        builtinTagOrder.set(tag.name.trim().toLowerCase(), index);
      }
    });

    ingredients.forEach((ingredient) => {
      const tag = ingredient.tags?.[0];
      const key = normalizeTagKey(tag);
      if (!key) {
        return;
      }

      if (!map.has(key)) {
        map.set(key, {
          key,
          name: tag?.name ?? 'Unnamed tag',
          color: tag?.color ?? defaultTagColor,
        });
      }
    });

    const otherTag = BUILTIN_INGREDIENT_TAGS.find((tag) => tag.name === 'other');
    const otherKey = normalizeTagKey(otherTag) ?? 'other';
    if (!map.has(otherKey)) {
      map.set(otherKey, {
        key: otherKey,
        name: otherTag?.name ?? 'Other',
        color: otherTag?.color ?? defaultTagColor,
      });
    }

    return Array.from(map.values()).sort((a, b) => {
      const normalizedNameA = a.name.trim().toLowerCase();
      const normalizedNameB = b.name.trim().toLowerCase();
      const orderA = builtinTagOrder.get(a.key) ?? builtinTagOrder.get(normalizedNameA);
      const orderB = builtinTagOrder.get(b.key) ?? builtinTagOrder.get(normalizedNameB);

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

      return normalizedNameA.localeCompare(normalizedNameB);
    });
  }, [defaultTagColor, ingredients]);

  const ingredientGroups = useMemo<IngredientGroup[]>(() => {
    const groups = new Map<string, IngredientGroup>();
    const otherTag = availableTagOptions.find((tag) => tag.name.trim().toLowerCase() === 'other');

    filteredIngredients.forEach((ingredient) => {
      const tag = ingredient.tags?.[0];
      const key = getIngredientTagKey(ingredient, otherTag?.key);
      const group = groups.get(key);

      if (group) {
        group.ingredients.push(ingredient);
        return;
      }

      const fallbackTag = otherTag ?? {
        key,
        name: 'Other',
        color: defaultTagColor,
      };

      groups.set(key, {
        key,
        name: tag?.name ?? fallbackTag.name,
        color: tag?.color ?? fallbackTag.color,
        ingredients: [ingredient],
      });
    });

    const orderMap = new Map<string, number>();
    availableTagOptions.forEach((tag, index) => {
      orderMap.set(tag.key, index);
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        ingredients: group.ingredients.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => {
        const orderA = orderMap.get(a.key);
        const orderB = orderMap.get(b.key);

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

        return a.name.localeCompare(b.name);
      });
  }, [availableTagOptions, defaultTagColor, filteredIngredients]);

  useEffect(() => {
    setExpandedTagKeys((previous) => {
      if (previous.size === 0) {
        return previous;
      }

      const validKeys = new Set(ingredientGroups.map((group) => group.key));
      let didChange = false;
      const next = new Set<string>();

      previous.forEach((key) => {
        if (validKeys.has(key)) {
          next.add(key);
        } else {
          didChange = true;
        }
      });

      if (!didChange && next.size === previous.size) {
        return previous;
      }

      return next;
    });
  }, [ingredientGroups]);

  const handleToggleGroup = useCallback((key: string) => {
    setExpandedTagKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

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

  const ingredientLookup = useMemo(() => createIngredientLookup(ingredients), [ingredients]);

  const visibleCocktailsByIngredientId = useMemo(() => {
    const map = new Map<number, Set<string>>();

    cocktails.forEach((cocktail) => {
      const cocktailKey = resolveCocktailKey(cocktail);
      if (!cocktailKey) {
        return;
      }

      const visibleIds = getVisibleIngredientIdsForCocktail(cocktail, ingredientLookup, {
        allowAllSubstitutes,
      });

      visibleIds.forEach((ingredientId) => {
        let set = map.get(ingredientId);
        if (!set) {
          set = new Set<string>();
          map.set(ingredientId, set);
        }

        set.add(cocktailKey);
      });
    });

    return map;
  }, [allowAllSubstitutes, cocktails, ingredientLookup]);

  const makeableCocktailKeys = useMemo(() => {
    const keys = new Set<string>();

    cocktails.forEach((cocktail) => {
      const key = resolveCocktailKey(cocktail);
      if (!key) {
        return;
      }

      if (isCocktailReady(cocktail, availableIngredientIds, ingredientLookup, ingredients, {
        ignoreGarnish,
        allowAllSubstitutes,
      })) {
        keys.add(key);
      }
    });

    return keys;
  }, [
    allowAllSubstitutes,
    availableIngredientIds,
    cocktails,
    ignoreGarnish,
    ingredientLookup,
    ingredients,
  ]);

  const makeableCocktailCounts = useMemo(() => {
    const counts = new Map<number, number>();
    visibleCocktailsByIngredientId.forEach((cocktailKeys, ingredientId) => {
      let count = 0;
      cocktailKeys.forEach((key) => {
        if (makeableCocktailKeys.has(key)) {
          count += 1;
        }
      });
      counts.set(ingredientId, count);
    });
    return counts;
  }, [makeableCocktailKeys, visibleCocktailsByIngredientId]);

  const totalCocktailCounts = useMemo(() => {
    const counts = new Map<number, number>();
    visibleCocktailsByIngredientId.forEach((cocktailKeys, ingredientId) => {
      counts.set(ingredientId, cocktailKeys.size);
    });
    return counts;
  }, [visibleCocktailsByIngredientId]);

  const selectedGroups = useMemo(() => {
    if (selectedIngredientIds.size === 0) {
      return new Map<string, Set<number>>();
    }

    const otherTag = availableTagOptions.find((tag) => tag.name.trim().toLowerCase() === 'other');
    const map = new Map<string, Set<number>>();

    ingredients.forEach((ingredient) => {
      const ingredientId = Number(ingredient.id ?? -1);
      if (!selectedIngredientIds.has(ingredientId)) {
        return;
      }

      const key = getIngredientTagKey(ingredient, otherTag?.key);
      if (!map.has(key)) {
        map.set(key, new Set());
      }
      map.get(key)?.add(ingredientId);
    });

    return map;
  }, [availableTagOptions, ingredients, selectedIngredientIds]);

  const matchingCocktailSummary = useMemo(() => {
    const availableKeys: string[] = [];
    const unavailableKeys: string[] = [];
    const allMatchingKeys = new Set<string>();

    if (selectedGroups.size === 0) {
      return {
        availableKeys,
        unavailableKeys,
        availableCount: 0,
        recipeCount: 0,
      };
    }

    cocktails.forEach((cocktail) => {
      const key = resolveCocktailKey(cocktail);
      if (!key) {
        return;
      }

      const visibleIds = getVisibleIngredientIdsForCocktail(cocktail, ingredientLookup, {
        allowAllSubstitutes,
      });

      let matchesSelection = true;
      selectedGroups.forEach((groupIds) => {
        const hasMatch = Array.from(groupIds).some((id) => visibleIds.has(id));
        if (!hasMatch) {
          matchesSelection = false;
        }
      });

      if (!matchesSelection) {
        return;
      }

      allMatchingKeys.add(key);

      const isReady = isCocktailReady(cocktail, availableIngredientIds, ingredientLookup, ingredients, {
        ignoreGarnish,
        allowAllSubstitutes,
      });

      if (isReady) {
        availableKeys.push(key);
      } else {
        unavailableKeys.push(key);
      }
    });

    return {
      availableKeys,
      unavailableKeys,
      availableCount: availableKeys.length,
      recipeCount: allMatchingKeys.size,
    };
  }, [
    allowAllSubstitutes,
    availableIngredientIds,
    cocktails,
    ignoreGarnish,
    ingredientLookup,
    ingredients,
    selectedGroups,
  ]);

  const handleClearSelection = useCallback(() => {
    setSelectedIngredientIds((previous) => (previous.size === 0 ? previous : new Set()));
  }, []);

  const handleShowResults = useCallback(() => {
    router.push({
      pathname: '/shaker/results',
      params: {
        available: JSON.stringify(matchingCocktailSummary.availableKeys),
        unavailable: JSON.stringify(matchingCocktailSummary.unavailableKeys),
      },
    });
  }, [matchingCocktailSummary.availableKeys, matchingCocktailSummary.unavailableKeys, router]);

  const sections = useMemo<IngredientSection[]>(
    () =>
      ingredientGroups.map((group) => ({
        ...group,
        data: expandedTagKeys.has(group.key) ? group.ingredients : [makeCollapsedHeaderItem(group.key)],
      })),
    [expandedTagKeys, ingredientGroups],
  );

  const renderHeaderContent = useCallback(
    (section: IngredientSection, isExpanded: boolean) => {
      const iconRotation = isExpanded ? '180deg' : '0deg';
      const backgroundColor = section.color;

      return (
        <View style={[styles.groupCard, { backgroundColor: Colors.background }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${section.name} ingredients`}
            accessibilityState={{ expanded: isExpanded }}
            onStartShouldSetResponderCapture={() => true}
            onResponderTerminationRequest={() => false}
            onTouchStart={(event) => {
              headerTouchState.current.set(section.key, {
                startY: event.nativeEvent.pageY,
                moved: false,
                didPress: false,
              });
            }}
            onTouchMove={(event) => {
              const state = headerTouchState.current.get(section.key);
              if (!state) {
                headerTouchState.current.set(section.key, {
                  startY: event.nativeEvent.pageY,
                  moved: false,
                  didPress: false,
                });
                return;
              }

              if (!state.moved && Math.abs(event.nativeEvent.pageY - state.startY) > 8) {
                state.moved = true;
                headerTouchState.current.set(section.key, state);
              }
            }}
            onPressOut={() => {
              const touchState = headerTouchState.current.get(section.key);
              headerTouchState.current.delete(section.key);
              if (touchState?.moved || touchState?.didPress) {
                return;
              }
              const now = Date.now();
              const lastPress = headerPressTimestamps.current.get(section.key);
              if (lastPress == null || now - lastPress > 350) {
                handleToggleGroup(section.key);
              }
            }}
            onPress={() => {
              const now = Date.now();
              headerPressTimestamps.current.set(section.key, now);
              const touchState = headerTouchState.current.get(section.key);
              if (touchState) {
                touchState.didPress = true;
                headerTouchState.current.set(section.key, touchState);
              }
              handleToggleGroup(section.key);
            }}
            style={[styles.groupHeader, { backgroundColor }]}
          >
            <Text style={[styles.groupTitle, { color: Colors.onPrimary }]}>{section.name}</Text>
            <MaterialIcons
              name="expand-more"
              size={22}
              color={Colors.onPrimary}
              style={{ transform: [{ rotate: iconRotation }] }}
            />
          </Pressable>
        </View>
      );
    },
    [handleToggleGroup, Colors],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<Ingredient, IngredientSection> }) => {
      const isExpanded = expandedTagKeys.has(section.key);
      if (!isExpanded) {
        return null;
      }
      return renderHeaderContent(section, isExpanded);
    },
    [expandedTagKeys, renderHeaderContent],
  );

  const renderIngredient = useCallback(
    ({ item, index, section }: SectionListRenderItemInfo<Ingredient, IngredientSection>) => {
      if (isCollapsedHeaderItem(item)) {
        return renderHeaderContent(section, false);
      }
      const ingredientId = Number(item.id ?? -1);
      const isAvailable = ingredientId >= 0 && availableIngredientIds.has(ingredientId);
      const isSelected = ingredientId >= 0 && selectedIngredientIds.has(ingredientId);
      const isOnShoppingList = ingredientId >= 0 && shoppingIngredientIds.has(ingredientId);
      const separatorColor = isAvailable ? Colors.outline : Colors.outlineVariant;
      const makeableCount = ingredientId >= 0 ? makeableCocktailCounts.get(ingredientId) ?? 0 : 0;
      const totalCount = ingredientId >= 0 ? totalCocktailCounts.get(ingredientId) ?? 0 : 0;
      const label = makeableCount === 1 ? 'cocktail' : 'cocktails';
      const recipeLabel = totalCount === 1 ? 'recipe' : 'recipes';
      const subtitleText =
        makeableCount > 0
          ? `Make ${makeableCount} ${label}`
          : totalCount > 0
          ? `${totalCount} ${recipeLabel}`
          : undefined;

      return (
        <View>
          <IngredientRow
            ingredient={item}
            isAvailable={isAvailable}
            isSelected={isSelected}
            isOnShoppingList={isOnShoppingList}
            subtitle={subtitleText}
            subtitleStyle={{ color: Colors.onSurfaceVariant }}
            onToggle={handleToggleIngredient}
          />
          {index < section.data.length - 1 ? (
            <View style={[styles.divider, { backgroundColor: separatorColor }]} />
          ) : null}
        </View>
      );
    },
    [
      availableIngredientIds,
      Colors,
      handleToggleIngredient,
      makeableCocktailCounts,
      renderHeaderContent,
      selectedIngredientIds,
      shoppingIngredientIds,
      totalCocktailCounts,
    ],
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <View style={styles.screen}>
        <View
          style={[
            styles.header,
            { backgroundColor: Colors.background, borderBottomColor: Colors.outline },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open navigation"
            onPress={() => setIsMenuOpen(true)}
            style={styles.iconButton}
          >
            <MaterialCommunityIcons name="menu" size={24} color={Colors.onSurface} />
          </Pressable>
          <View
            style={[
              styles.searchContainer,
              { backgroundColor: Colors.surface, borderColor: Colors.background },
            ]}
          >
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color={Colors.onSurface}
              style={styles.searchIcon}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={`${Colors.onSurfaceVariant}99`}
              returnKeyType="search"
              style={[styles.searchInput, { color: Colors.text, fontWeight: '400' }]}
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search query"
                onPress={() => setQuery('')}
                style={styles.clearButton}
              >
                <MaterialCommunityIcons name="close" size={18} color={Colors.onSurface} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.iconButton}>
            <PresenceCheck checked={inStockOnly} onToggle={() => setInStockOnly((previous) => !previous)} />
          </View>
        </View>
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(item) => String(item.id ?? item.name)}
          renderItem={renderIngredient}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled
          contentContainerStyle={[styles.listContent, { paddingBottom: 140 + bottomInset }]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          // Allow the first tap to toggle items while dismissing the keyboard.
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />
        <View
          style={[
            styles.bottomPanel,
            {
              borderTopColor: Colors.outlineVariant,
              backgroundColor: Colors.surface,
              paddingBottom: 12 + bottomInset,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear selected ingredients"
            onPress={handleClearSelection}
            style={({ pressed }) => [styles.clearButtonBase, { borderColor: Colors.danger }, pressed ? styles.clearButtonPressed : null]}
          >
            <Text style={[styles.clearButtonLabel, { color: Colors.error }]}>Clear</Text>
          </Pressable>
          <View style={styles.countsColumn}>
            <Text style={[styles.countsPrimary, { color: Colors.onSurface }]}
            >
              Cocktails: {matchingCocktailSummary.availableCount}
            </Text>
            <Text style={[styles.countsSecondary, { color: Colors.onSurfaceVariant }]}
            >
              (recipes: {matchingCocktailSummary.recipeCount})
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show matching recipes"
            accessibilityState={{
              disabled: matchingCocktailSummary.recipeCount === 0 || selectedIngredientIds.size === 0,
            }}
            disabled={matchingCocktailSummary.recipeCount === 0 || selectedIngredientIds.size === 0}
            onPress={handleShowResults}
            style={({ pressed }) => [
              styles.showButton,
              {
                backgroundColor:
                  matchingCocktailSummary.recipeCount === 0 || selectedIngredientIds.size === 0
                    ? Colors.surfaceVariant
                    : Colors.primary,
              },
              pressed && matchingCocktailSummary.recipeCount > 0 && selectedIngredientIds.size > 0
                ? styles.showButtonPressed
                : null,
            ]}
          >
            <Text
              style={[
                styles.showButtonLabel,
                {
                  color:
                    matchingCocktailSummary.recipeCount === 0 || selectedIngredientIds.size === 0
                      ? Colors.onSurfaceVariant
                      : Colors.onPrimary,
                },
              ]}
            >
              Show
            </Text>
          </Pressable>
        </View>
        <SideMenuDrawer visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 120,
  },
  groupCard: {
    paddingBottom: 2,
  },
  groupHeader: {
    height: 64,
    paddingHorizontal: 16,
    paddingVertical: 0,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  groupList: {
    overflow: 'hidden',
    borderRadius: 0,
    marginTop: 0,
  },
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  shoppingIcon: {
    width: 20,
    height: 20,
    alignSelf: 'flex-end',
  },
  shoppingIconPlaceholder: {
    width: 20,
    height: 20,
    alignSelf: 'flex-end',
  },
  clearButtonBase: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  clearButtonPressed: {
    opacity: 0.7,
  },
  clearButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  countsColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  countsPrimary: {
    fontSize: 14,
    fontWeight: '700',
  },
  countsSecondary: {
    fontSize: 12,
  },
  showButton: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 90,
    alignItems: 'center',
  },
  showButtonPressed: {
    opacity: 0.85,
  },
  showButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
