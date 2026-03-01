import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useScrollToTop } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { AppDialog } from '@/components/AppDialog';
import { OnboardingAnchor } from '@/components/onboarding/OnboardingAnchor';
import { useOnboardingAnchors } from '@/components/onboarding/OnboardingContext';
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
import { compareGlobalAlphabet } from '@/libs/global-sort';
import { getPluralCategory } from '@/libs/i18n/plural';
import { useI18n } from '@/libs/i18n/use-i18n';
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
  isStyleBaseIngredient: boolean;
  isBrandBaseIngredient: boolean;
  subtitle?: string;
  subtitleStyle?: StyleProp<TextStyle>;
  onToggle: (id: number) => void;
};

const IngredientRow = memo(function IngredientRow({
  ingredient,
  isSelected,
  isAvailable,
  isOnShoppingList,
  isStyleBaseIngredient,
  isBrandBaseIngredient,
  subtitle,
  subtitleStyle,
  onToggle,
}: IngredientRowProps) {
  const Colors = useAppColors();
  const { t } = useI18n();
  const ingredientId = Number(ingredient.id ?? -1);
  const ingredientTagColors = (ingredient.tags ?? [])
    .map((tag) => tag?.color ?? tagColors.yellow)
    .filter(Boolean);
  const brandIndicatorColor = ingredient.styleIngredientId != null
    ? Colors.styledIngredient
    : ingredient.baseIngredientId != null
      ? Colors.primary
      : undefined;
  const rightIndicatorColor = isBrandBaseIngredient
    ? Colors.primary
    : isStyleBaseIngredient
      ? Colors.styledIngredient
      : undefined;
  const rightIndicatorBottomColor = isBrandBaseIngredient && isStyleBaseIngredient
    ? Colors.styledIngredient
    : undefined;

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
        accessibilityLabel={t("common.tabShopping")}
      />
    );
  }, [isOnShoppingList, Colors, t]);
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
      rightIndicatorColor={rightIndicatorColor}
      rightIndicatorBottomColor={rightIndicatorBottomColor}
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
  const { t, locale } = useI18n();
  const {
    cocktails,
    ingredients,
    availableIngredientIds,
    shoppingIngredientIds,
    ignoreGarnish,
    allowAllSubstitutes,
    shakerSmartFilteringEnabled,
    onboardingStep,
    onboardingCompleted,
  } = useInventory();
  const [query, setQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [isHelpVisible, setIsHelpVisible] = useState(false);
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
  const { registerAction } = useOnboardingAnchors();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.min(insets.bottom, 8);
  const defaultTagColor = tagColors.yellow ?? Colors.highlightFaint;
  const isOnboardingActive = !onboardingCompleted && onboardingStep > 0;

  useScrollToTop(listRef);

  useEffect(
    () =>
      registerAction('shaker-availability-toggle', () => {
        setInStockOnly((previous) => (previous ? previous : true));
      }),
    [registerAction],
  );

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

  const baseFilteredIngredients = useMemo(() => {
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
        const isBuiltin = tag?.id != null && tag.id < 10;
        const translatedName = isBuiltin ? t(`ingredientTag.${tag.id}`) : tag?.name;
        const finalName = (isBuiltin && translatedName !== `ingredientTag.${tag.id}`) ? translatedName : (tag?.name ?? t('tags.unnamed'));

        map.set(key, {
          key,
          name: finalName,
          color: tag?.color ?? defaultTagColor,
        });
      }
    });

    const otherTag = BUILTIN_INGREDIENT_TAGS.find((tag) => tag.id === 9 || tag.name.trim().toLowerCase() === 'other');
    const otherKey = normalizeTagKey(otherTag) ?? 'other';
    if (!map.has(otherKey)) {
      const translatedName = t(`ingredientTag.9`);
      map.set(otherKey, {
        key: otherKey,
        name: translatedName !== `ingredientTag.9` ? translatedName : (otherTag?.name ?? 'Other'),
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

      return compareGlobalAlphabet(normalizedNameA, normalizedNameB);
    });
  }, [defaultTagColor, ingredients, t]);

  const ingredientLookup = useMemo(() => createIngredientLookup(ingredients), [ingredients]);
  const styleBaseIngredientIds = useMemo(() => {
    return new Set(
      Array.from(ingredientLookup.stylesByBaseId.entries())
        .filter(([, styleIds]) => styleIds.length > 0)
        .map(([baseId]) => baseId),
    );
  }, [ingredientLookup.stylesByBaseId]);

  const brandedBaseIngredientIds = useMemo(() => {
    return new Set(
      Array.from(ingredientLookup.brandsByBaseId.entries())
        .filter(([, brandIds]) => brandIds.length > 0)
        .map(([baseId]) => baseId),
    );
  }, [ingredientLookup.brandsByBaseId]);

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

  const allCocktailKeys = useMemo(() => {
    const keys = new Set<string>();
    cocktails.forEach((cocktail) => {
      const key = resolveCocktailKey(cocktail);
      if (key) {
        keys.add(key);
      }
    });
    return keys;
  }, [cocktails]);

  const otherTagOption = useMemo(
    () => availableTagOptions.find((tag) => tag.name.trim().toLowerCase() === 'other'),
    [availableTagOptions],
  );

  const selectedByGroup = useMemo(() => {
    if (selectedIngredientIds.size === 0) {
      return new Map<string, Set<number>>();
    }

    const map = new Map<string, Set<number>>();
    ingredients.forEach((ingredient) => {
      const ingredientId = Number(ingredient.id ?? -1);
      if (!selectedIngredientIds.has(ingredientId)) {
        return;
      }

      const groupId = getIngredientTagKey(ingredient, otherTagOption?.key);
      if (!map.has(groupId)) {
        map.set(groupId, new Set<number>());
      }
      map.get(groupId)?.add(ingredientId);
    });

    return map;
  }, [ingredients, otherTagOption?.key, selectedIngredientIds]);

  const unionByGroup = useMemo(() => {
    const map = new Map<string, Set<string>>();

    selectedByGroup.forEach((ingredientIds, groupId) => {
      const union = new Set<string>();
      ingredientIds.forEach((ingredientId) => {
        const cocktailKeys = visibleCocktailsByIngredientId.get(ingredientId);
        if (!cocktailKeys) {
          return;
        }
        cocktailKeys.forEach((cocktailKey) => union.add(cocktailKey));
      });
      map.set(groupId, union);
    });

    return map;
  }, [selectedByGroup, visibleCocktailsByIngredientId]);

  const candidateCocktailKeys = useMemo(() => {
    if (unionByGroup.size === 0) {
      return allCocktailKeys;
    }

    const unions = Array.from(unionByGroup.values()).sort((a, b) => a.size - b.size);
    const [first, ...rest] = unions;
    if (!first) {
      return new Set<string>();
    }

    const candidate = new Set(first);
    for (const union of rest) {
      for (const key of candidate) {
        if (!union.has(key)) {
          candidate.delete(key);
        }
      }
      if (candidate.size === 0) {
        return candidate;
      }
    }

    return candidate;
  }, [allCocktailKeys, unionByGroup]);

  const isIngredientAllowed = useCallback(
    (ingredientId: number, groupId: string) => {
      if (!shakerSmartFilteringEnabled) {
        return true;
      }

      if (selectedByGroup.has(groupId)) {
        return true;
      }

      const cocktailKeys = visibleCocktailsByIngredientId.get(ingredientId);
      if (!cocktailKeys || cocktailKeys.size === 0 || candidateCocktailKeys.size === 0) {
        return false;
      }

      for (const key of cocktailKeys) {
        if (candidateCocktailKeys.has(key)) {
          return true;
        }
      }

      return false;
    },
    [candidateCocktailKeys, selectedByGroup, shakerSmartFilteringEnabled, visibleCocktailsByIngredientId],
  );

  const effectiveFilteredIngredients = useMemo(() => {
    if (!shakerSmartFilteringEnabled) {
      return baseFilteredIngredients;
    }

    return baseFilteredIngredients.filter((ingredient) => {
      const ingredientId = Number(ingredient.id ?? -1);
      if (ingredientId < 0) {
        return false;
      }

      const groupId = getIngredientTagKey(ingredient, otherTagOption?.key);
      return isIngredientAllowed(ingredientId, groupId);
    });
  }, [
    baseFilteredIngredients,
    isIngredientAllowed,
    otherTagOption?.key,
    shakerSmartFilteringEnabled,
  ]);

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    if (!shakerSmartFilteringEnabled) {
      const legacyIds = baseFilteredIngredients.map((item) => Number(item.id ?? -1)).join(',');
      const currentIds = effectiveFilteredIngredients.map((item) => Number(item.id ?? -1)).join(',');
      if (legacyIds !== currentIds) {
        console.error('Smart shaker filtering disabled but filtered ingredient order/content changed.');
      }
      return;
    }

    effectiveFilteredIngredients.forEach((ingredient) => {
      const ingredientId = Number(ingredient.id ?? -1);
      if (ingredientId < 0) {
        return;
      }

      const groupId = getIngredientTagKey(ingredient, otherTagOption?.key);
      if (selectedByGroup.has(groupId)) {
        return;
      }

      if (!isIngredientAllowed(ingredientId, groupId)) {
        console.error('Smart shaker filtering invariant failed: visible ingredient can lead to empty results.', {
          ingredientId,
          groupId,
        });
      }
    });
  }, [
    baseFilteredIngredients,
    effectiveFilteredIngredients,
    isIngredientAllowed,
    otherTagOption?.key,
    selectedByGroup,
    shakerSmartFilteringEnabled,
  ]);

  const ingredientGroups = useMemo<IngredientGroup[]>(() => {
    const groups = new Map<string, IngredientGroup>();
    const otherTag = availableTagOptions.find((tag) => tag.name.trim().toLowerCase() === 'other');

    effectiveFilteredIngredients.forEach((ingredient) => {
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

      const isBuiltin = tag?.id != null && tag.id < 10;
      const translatedName = isBuiltin ? t(`ingredientTag.${tag.id}`) : tag?.name;
      const finalName = (isBuiltin && translatedName !== `ingredientTag.${tag.id}`) ? translatedName : (tag?.name ?? fallbackTag.name);

      groups.set(key, {
        key,
        name: finalName,
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
        ingredients: group.ingredients.sort((a, b) => compareGlobalAlphabet(a.name, b.name)),
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

        return compareGlobalAlphabet(a.name, b.name);
      });
  }, [availableTagOptions, defaultTagColor, effectiveFilteredIngredients, t]);

  const onboardingSampleIds = useMemo(() => {
    const preferredIds = [161, 352, 114, 339, 219, 227]; // Gin, Whiskey, Cola, Tonic, Lemon, Lime
    const existingIngredientIds = new Set(
      ingredients
        .map((ingredient) => Number(ingredient.id ?? -1))
        .filter((id) => id >= 0),
    );

    const picks = preferredIds.filter((id) => existingIngredientIds.has(id));

    if (picks.length > 0) {
      return picks;
    }

    return preferredIds.filter((id) => availableIngredientIds.has(id));
  }, [availableIngredientIds, ingredients]);

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

  useEffect(() => {
    if (onboardingStep !== 15) {
      return;
    }

    setInStockOnly((previous) => (previous ? previous : true));
    setExpandedTagKeys((previous) => {
      const nextKeys = ingredientGroups.map((group) => group.key);
      if (previous.size === nextKeys.length && nextKeys.every((key) => previous.has(key))) {
        return previous;
      }
      return new Set(nextKeys);
    });
  }, [ingredientGroups, onboardingStep]);

  useEffect(() => {
    if (onboardingStep !== 11) {
      return;
    }

    if (selectedIngredientIds.size > 0 || onboardingSampleIds.length === 0) {
      return;
    }

    setSelectedIngredientIds(new Set(onboardingSampleIds));
  }, [onboardingSampleIds, onboardingStep, selectedIngredientIds.size]);

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

  const matchingCocktailSummary = useMemo(() => {
    const availableKeys: string[] = [];
    const unavailableKeys: string[] = [];
    const allMatchingKeys = new Set<string>();

    if (selectedByGroup.size === 0) {
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
      selectedByGroup.forEach((groupIds) => {
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
    selectedByGroup,
  ]);

  const helpMessage = useMemo(() => {
    const baseMessage = t('shaker.helpBase');

    if (selectedByGroup.size === 0) {
      return baseMessage;
    }

    const ingredientById = new Map<number, Ingredient>();
    ingredients.forEach((ingredient) => {
      const ingredientId = Number(ingredient.id ?? -1);
      if (ingredientId >= 0) {
        ingredientById.set(ingredientId, ingredient);
      }
    });

    const sortedGroups = Array.from(selectedByGroup.entries()).sort(([groupKeyA], [groupKeyB]) =>
      compareGlobalAlphabet(groupKeyA, groupKeyB),
    );

    const selectionExpression = sortedGroups
      .map(([, ingredientIds]) => {
        const names = Array.from(ingredientIds)
          .map((ingredientId) => ingredientById.get(ingredientId)?.name?.trim())
          .filter((name): name is string => Boolean(name))
          .sort((nameA, nameB) => compareGlobalAlphabet(nameA, nameB));

        if (names.length === 0) {
          return null;
        }

        return `(${names.join(` ${t('common.or')} `)})`;
      })
      .filter((groupExpression): groupExpression is string => Boolean(groupExpression))
      .join(` ${t('common.and')} `);

    if (!selectionExpression) {
      return baseMessage;
    }

    return `${baseMessage}\n\n${t('shaker.currentSelection')}:\n${selectionExpression}`;
  }, [ingredients, selectedByGroup, t]);

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
      const selectedCount = section.ingredients.reduce((count, ingredient) => {
        const ingredientId = Number(ingredient.id ?? -1);
        if (ingredientId >= 0 && selectedIngredientIds.has(ingredientId)) {
          return count + 1;
        }
        return count;
      }, 0);
      const titleSuffix = selectedCount > 0 ? ` (${selectedCount})` : '';

      return (
        <View style={[styles.groupCard, { backgroundColor: Colors.background }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("shaker.ingredientsInGroupA11y", { name: section.name })}
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
            <Text style={[styles.groupTitle, { color: Colors.onPrimary }]}>
              {section.name}
              {titleSuffix}
            </Text>
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
    [handleToggleGroup, Colors, selectedIngredientIds, t],
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
      const isStyleBaseIngredient = ingredientId >= 0 && styleBaseIngredientIds.has(ingredientId);
      const isBrandBaseIngredient = ingredientId >= 0 && brandedBaseIngredientIds.has(ingredientId);
      const separatorColor = isAvailable ? Colors.outline : Colors.outlineVariant;
      const makeableCount = ingredientId >= 0 ? makeableCocktailCounts.get(ingredientId) ?? 0 : 0;
      const totalCount = ingredientId >= 0 ? totalCocktailCounts.get(ingredientId) ?? 0 : 0;

      let subtitleText: string | undefined;
      if (makeableCount > 0) {
        const pluralCategory = getPluralCategory(locale, makeableCount);
        subtitleText = t(`shaker.makeCount.${pluralCategory}`, { count: makeableCount });
      } else if (totalCount > 0) {
        const pluralCategory = getPluralCategory(locale, totalCount);
        subtitleText = t(`shaker.recipeCount.${pluralCategory}`, { count: totalCount });
      }

      return (
        <View>
          <IngredientRow
            ingredient={item}
            isAvailable={isAvailable}
            isSelected={isSelected}
            isOnShoppingList={isOnShoppingList}
            isStyleBaseIngredient={isStyleBaseIngredient}
            isBrandBaseIngredient={isBrandBaseIngredient}
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
      styleBaseIngredientIds,
      brandedBaseIngredientIds,
      totalCocktailCounts,
      locale,
      t,
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
            accessibilityLabel={t('common.openNavigation')}
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
              placeholder={t('common.search')}
              placeholderTextColor={`${Colors.onSurfaceVariant}99`}
              returnKeyType="search"
              style={[styles.searchInput, { color: Colors.text, fontWeight: '400' }]}
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.clearSearch')}
                onPress={() => setQuery('')}
                style={styles.clearButton}
              >
                <MaterialCommunityIcons name="close" size={18} color={Colors.onSurface} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.openScreenHelp')}
            onPress={() => setIsHelpVisible(true)}
            style={styles.iconButton}
          >
            <MaterialCommunityIcons name="help-circle-outline" size={24} color={Colors.icon} />
          </Pressable>
          <View style={styles.iconButton}>
            <OnboardingAnchor name="shaker-availability-toggle">
              <PresenceCheck checked={inStockOnly} onToggle={() => setInStockOnly((previous) => !previous)} />
            </OnboardingAnchor>
          </View>
        </View>
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(item) => String(item.id ?? item.name)}
          renderItem={renderIngredient}
          renderSectionHeader={renderSectionHeader}
          // NOTE: Fabric + sticky headers can get into a ref update loop when section content
          // is dynamically swapped during onboarding restarts (collapsed header row <-> section
          // header). Disable stickiness only while onboarding is active.
          stickySectionHeadersEnabled={!isOnboardingActive}
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
            accessibilityLabel={t('shaker.clearSelectedIngredients')}
            onPress={handleClearSelection}
            style={({ pressed }) => [styles.clearButtonBase, { borderColor: Colors.danger }, pressed ? styles.clearButtonPressed : null]}
          >
            <Text style={[styles.clearButtonLabel, { color: Colors.error }]}>{t("common.clear")}</Text>
          </Pressable>
          <View style={styles.countsColumn}>
            <Text style={[styles.countsPrimary, { color: Colors.onSurface }]}
            >
              {t("shaker.cocktailsCount", { count: matchingCocktailSummary.availableCount })}
            </Text>
            <Text style={[styles.countsSecondary, { color: Colors.onSurfaceVariant }]}
            >
              {t("shaker.recipesCount", { count: matchingCocktailSummary.recipeCount })}
            </Text>
          </View>
          <OnboardingAnchor name="shaker-show-results">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('shaker.showMatchingRecipes')}
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
                {t("common.show")}
              </Text>
            </Pressable>
          </OnboardingAnchor>
        </View>
        <SideMenuDrawer visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
        <AppDialog
          visible={isHelpVisible}
          title={t("tabs.shaker")}
          message={helpMessage}
          actions={[{ label: t('common.gotIt'), variant: 'secondary' }]}
          onRequestClose={() => setIsHelpVisible(false)}
        />
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
