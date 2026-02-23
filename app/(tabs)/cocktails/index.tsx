import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useScrollToTop } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type LayoutRectangle,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CocktailListRow } from '@/components/CocktailListRow';
import { CollectionHeader } from '@/components/CollectionHeader';
import { FabAdd } from '@/components/FabAdd';
import { useOnboardingAnchors } from '@/components/onboarding/OnboardingContext';
import { ListRow, Thumb } from '@/components/RowParts';
import { SideMenuDrawer } from '@/components/SideMenuDrawer';
import { TagPill } from '@/components/TagPill';
import type { SegmentTabOption } from '@/components/TopBars';
import { getCocktailMethods, METHOD_ICON_MAP, type CocktailMethod } from '@/constants/cocktail-methods';
import { BUILTIN_COCKTAIL_TAGS } from '@/constants/cocktail-tags';
import { useAppColors } from '@/constants/theme';
import { isCocktailReady, summariseCocktailAvailability } from '@/libs/cocktail-availability';
import { getLastCocktailTab, setLastCocktailTab, type CocktailTabKey } from '@/libs/collection-tabs';
import { createIngredientLookup } from '@/libs/ingredient-availability';
import { navigateToDetailsWithReturnTo } from '@/libs/navigation';
import { getPluralCategory } from '@/libs/i18n/plural';
import { normalizeSearchText } from '@/libs/search-normalization';
import { buildTagOptions, type TagOption } from '@/libs/tag-options';
import { useI18n } from '@/libs/i18n/use-i18n';
import { useCocktailTabLogic, type MyTabListItem } from '@/libs/use-cocktail-tab-logic';
import { useInventoryActions, useInventoryData, useInventorySettings, type Cocktail } from '@/providers/inventory-provider';
import { tagColors } from '@/theme/theme';

type CocktailMethodOption = {
  id: CocktailMethod['id'];
  label: string;
};

const METHOD_ICON_SIZE = 16;

export default function CocktailsScreen() {
  const { onTabChangeRequest } = useOnboardingAnchors();
  const { cocktails, availableIngredientIds, ingredients, shoppingIngredientIds, getCocktailRating } =
    useInventoryData();
  const { ignoreGarnish, allowAllSubstitutes, ratingFilterThreshold } = useInventorySettings();
  const { toggleIngredientShopping } = useInventoryActions();
  const Colors = useAppColors();
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<CocktailTabKey>(() => getLastCocktailTab());

  const tabOptions = useMemo<SegmentTabOption[]>(() => [
    { key: 'all', label: t('common.tabAll') },
    { key: 'my', label: t('common.tabMy') },
    { key: 'favorites', label: t('common.tabFavorites') },
  ], [t]);

  const [query, setQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFilterMenuVisible, setFilterMenuVisible] = useState(false);
  const [selectedTagKeys, setSelectedTagKeys] = useState<Set<string>>(() => new Set());
  const [selectedMethodIds, setSelectedMethodIds] = useState<Set<CocktailMethod['id']>>(
    () => new Set(),
  );
  const [headerLayout, setHeaderLayout] = useState<LayoutRectangle | null>(null);
  const [filterAnchorLayout, setFilterAnchorLayout] = useState<LayoutRectangle | null>(null);
  const listRef = useRef<FlatList<unknown>>(null);
  const lastScrollOffset = useRef(0);
  const searchStartOffset = useRef<number | null>(null);
  const previousQuery = useRef(query);

  useScrollToTop(listRef);

  useEffect(() => {
    return onTabChangeRequest((screen, tab) => {
      if (screen === 'cocktails') {
        setActiveTab(tab as CocktailTabKey);
      }
    });
  }, [onTabChangeRequest]);

  useEffect(() => {
    const wasEmpty = previousQuery.current.length === 0;
    const isEmpty = query.length === 0;

    if (wasEmpty && !isEmpty) {
      searchStartOffset.current = lastScrollOffset.current;
    } else if (!wasEmpty && isEmpty && searchStartOffset.current !== null) {
      const restoreOffset = searchStartOffset.current;
      searchStartOffset.current = null;
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: restoreOffset, animated: false });
      });
    }

    previousQuery.current = query;
  }, [query]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    lastScrollOffset.current = event.nativeEvent.contentOffset.y;
  }, []);
  const router = useRouter();
  const ingredientLookup = useMemo(() => createIngredientLookup(ingredients), [ingredients]);
  const defaultTagColor = tagColors.yellow ?? Colors.highlightFaint;

  const availableTagOptions = useMemo<TagOption[]>(
    () => buildTagOptions(cocktails, (cocktail) => cocktail.tags ?? [], BUILTIN_COCKTAIL_TAGS, defaultTagColor),
    [cocktails, defaultTagColor],
  );

  useEffect(() => {
    setSelectedTagKeys((previous) => {
      if (previous.size === 0) {
        return previous;
      }

      const validKeys = new Set(availableTagOptions.map((tag) => tag.key));
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
  }, [availableTagOptions]);

  useEffect(() => {
    setLastCocktailTab(activeTab);
  }, [activeTab, t]);

  const handleHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const nextLayout = event.nativeEvent.layout;
    setHeaderLayout((previous) => {
      if (
        previous &&
        Math.abs(previous.x - nextLayout.x) < 0.5 &&
        Math.abs(previous.y - nextLayout.y) < 0.5 &&
        Math.abs(previous.width - nextLayout.width) < 0.5 &&
        Math.abs(previous.height - nextLayout.height) < 0.5
      ) {
        return previous;
      }

      return nextLayout;
    });
  }, []);

  const handleFilterLayout = useCallback((layout: LayoutRectangle) => {
    setFilterAnchorLayout((previous) => {
      if (
        previous &&
        Math.abs(previous.x - layout.x) < 0.5 &&
        Math.abs(previous.y - layout.y) < 0.5 &&
        Math.abs(previous.width - layout.width) < 0.5 &&
        Math.abs(previous.height - layout.height) < 0.5
      ) {
        return previous;
      }

      return layout;
    });
  }, []);

  const handleFilterPress = useCallback(() => {
    setFilterMenuVisible((previous) => !previous);
  }, []);

  const handleCloseFilterMenu = useCallback(() => {
    setFilterMenuVisible(false);
  }, []);

  const handleTagFilterToggle = useCallback((key: string) => {
    setSelectedTagKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleMethodFilterToggle = useCallback((methodId: CocktailMethod['id']) => {
    setSelectedMethodIds((previous) => {
      const next = new Set(previous);
      if (next.has(methodId)) {
        next.delete(methodId);
      } else {
        next.add(methodId);
      }
      return next;
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setSelectedTagKeys((previous) => (previous.size === 0 ? previous : new Set<string>()));
    setSelectedMethodIds((previous) => (previous.size === 0 ? previous : new Set<CocktailMethod['id']>()));
  }, []);

  const renderMethodIcon = useCallback(
    (methodId: CocktailMethod['id'], selected: boolean) => {
      const icon = METHOD_ICON_MAP[methodId];
      if (!icon) {
        return null;
      }

      const tintColor = selected ? Colors.surface : Colors.tint;
      if (icon.type === 'asset') {
        return (
          <Image
            source={icon.source}
            style={[styles.methodIcon, { tintColor }]}
            contentFit="contain"
          />
        );
      }

      const isMuddle = methodId === 'muddle';
      return (
        <View style={styles.methodIconWrapper}>
          <MaterialCommunityIcons
            name={icon.name}
            size={METHOD_ICON_SIZE}
            color={tintColor}
            style={isMuddle ? styles.muddleIcon : undefined}
          />
        </View>
      );
    },
    [Colors],
  );

  const ratedCocktails = useMemo(() => {
    return cocktails.filter((cocktail) => {
      const ratingValue = getCocktailRating(cocktail);
      return ratingValue >= ratingFilterThreshold;
    });
  }, [cocktails, getCocktailRating, ratingFilterThreshold]);

  const baseTabCocktails = useMemo(() => {
    if (activeTab === 'favorites') {
      return ratedCocktails;
    }

    return cocktails;
  }, [activeTab, cocktails, ratedCocktails]);

  const availableMethodOptions = useMemo<CocktailMethodOption[]>(() => {
    const methodOrder = getCocktailMethods();
    const methodMap = new Map(methodOrder.map((method) => [method.id, method]));
    const usedMethods = new Set<CocktailMethodOption['id']>();

    baseTabCocktails.forEach((cocktail) => {
      const legacyMethodId =
        (cocktail as { methodId?: CocktailMethod['id'] | null }).methodId ?? null;
      const methodIds = cocktail.methodIds?.length
        ? cocktail.methodIds
        : legacyMethodId
          ? [legacyMethodId]
          : [];
      methodIds.forEach((methodId) => {
        if (methodMap.has(methodId)) {
          usedMethods.add(methodId);
        }
      });
    });

    return methodOrder
      .filter((method) => usedMethods.has(method.id))
      .map((method) => ({ id: method.id, label: method.label }));
  }, [baseTabCocktails]);

  useEffect(() => {
    setSelectedMethodIds((previous) => {
      if (previous.size === 0) {
        return previous;
      }

      const validIds = new Set(availableMethodOptions.map((method) => method.id));
      let didChange = false;
      const next = new Set<CocktailMethod['id']>();

      previous.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          didChange = true;
        }
      });

      if (!didChange && next.size === previous.size) {
        return previous;
      }

      return next;
    });
  }, [availableMethodOptions]);

  const normalizedQuery = useMemo(() => {
    const normalized = normalizeSearchText(query);
    const tokens = normalized ? normalized.split(/\s+/).filter(Boolean) : [];
    return { text: normalized, tokens };
  }, [query]);

  const filteredByMethods = useMemo(() => {
    const base = baseTabCocktails;
    if (selectedMethodIds.size === 0) {
      return base;
    }

    return base.filter((cocktail) => {
      const legacyMethodId = (cocktail as { methodId?: CocktailMethod['id'] | null }).methodId ?? null;
      const methodIds = cocktail.methodIds?.length ? cocktail.methodIds : legacyMethodId ? [legacyMethodId] : [];
      if (methodIds.length === 0) {
        return false;
      }

      return methodIds.some((methodId) => selectedMethodIds.has(methodId));
    });
  }, [baseTabCocktails, selectedMethodIds]);

  const filteredByTags = useMemo(() => {
    const base = filteredByMethods;
    if (selectedTagKeys.size === 0) {
      return base;
    }

    return base.filter((cocktail) => {
      const tags = cocktail.tags ?? [];
      if (tags.length === 0) {
        return false;
      }

      return tags.some((tag) => {
        if (!tag) {
          return false;
        }

        const key = tag.id != null ? String(tag.id) : tag.name?.toLowerCase();
        if (!key) {
          return false;
        }

        return selectedTagKeys.has(key);
      });
    });
  }, [filteredByMethods, selectedTagKeys]);

  const filteredCocktails = useMemo(() => {
    const base = filteredByTags;
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
  }, [filteredByTags, normalizedQuery]);

  const sortedCocktails = useMemo(
    () => [...filteredCocktails].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
    [filteredCocktails],
  );

  const sortedFavorites = useMemo(() => {
    if (activeTab !== 'favorites') {
      return sortedCocktails;
    }

    return [...filteredCocktails].sort((a, b) => {
      const ratingA = getCocktailRating(a);
      const ratingB = getCocktailRating(b);

      if (ratingA !== ratingB) {
        return ratingB - ratingA;
      }

      return (a.name ?? '').localeCompare(b.name ?? '');
    });
  }, [activeTab, filteredCocktails, getCocktailRating, sortedCocktails]);

  const myTabListData = useCocktailTabLogic({
    activeTab,
    allowAllSubstitutes,
    availableIngredientIds,
    filteredCocktails,
    ignoreGarnish,
    ingredientLookup,
    defaultTagColor,
  });

  const keyExtractor = useCallback((item: Cocktail) => String(item.id ?? item.name), []);
  const myTabKeyExtractor = useCallback((item: MyTabListItem) => item.key, []);

  const handleSelectCocktail = useCallback(
    (cocktail: Cocktail) => {
      const candidateId = cocktail.id ?? cocktail.name;
      if (!candidateId) {
        return;
      }

      navigateToDetailsWithReturnTo({
        pathname: '/cocktails/[cocktailId]',
        params: { cocktailId: String(candidateId) },
        returnToPath: '/cocktails',
      });
    },
    [],
  );

  const handleSelectIngredient = useCallback(
    (ingredientId: number) => {
      if (ingredientId >= 0) {
        navigateToDetailsWithReturnTo({
          pathname: '/ingredients/[ingredientId]',
          params: { ingredientId: String(ingredientId) },
          returnToPath: '/cocktails',
        });
      }
    },
    [],
  );

  const handleShoppingToggle = useCallback(
    (ingredientId: number) => {
      if (ingredientId >= 0) {
        toggleIngredientShopping(ingredientId);
      }
    },
    [toggleIngredientShopping],
  );

  const getAvailabilitySummary = useCallback(
    (cocktail: Cocktail) =>
      summariseCocktailAvailability(
        cocktail,
        availableIngredientIds,
        ingredientLookup,
        undefined,
        {
          ignoreGarnish,
          allowAllSubstitutes,
        },
        t,
        locale,
      ),
    [allowAllSubstitutes, availableIngredientIds, ignoreGarnish, ingredientLookup, t, locale],
  );

  const renderItem = useCallback(
    ({ item }: { item: Cocktail }) => {
      const availability = getAvailabilitySummary(item);
      return (
        <CocktailListRow
          cocktail={item}
          ingredients={ingredients}
          showMethodIcons
          onPress={() => handleSelectCocktail(item)}
          isReady={availability.isReady}
          missingCount={availability.missingCount}
          recipeNamesCount={availability.recipeNames.length}
          ingredientLine={availability.ingredientLine}
          ratingValue={getCocktailRating(item)}
          hasBrandFallback={availability.hasBrandFallback}
          hasStyleFallback={availability.hasStyleFallback}
        />
      );
    },
    [
      getAvailabilitySummary,
      getCocktailRating,
      handleSelectCocktail,
      ingredients,
    ],
  );

  const renderMyItem = useCallback(
    ({ item }: { item: MyTabListItem }) => {
      if (item.type === 'separator') {
        return (
          <View style={styles.moreIngredientsWrapper}>
            <Text style={[styles.moreIngredientsLabel, { color: Colors.onSurfaceVariant }]}>
              {t("cocktails.oneMoreIngredientForMore")}
            </Text>
          </View>
        );
      }

      if (item.type === 'ingredient-header') {
        const isOnShoppingList = shoppingIngredientIds.has(item.ingredientId);
        const accessibilityLabel = isOnShoppingList
          ? t('cocktails.removeIngredientFromShopping')
          : t('cocktails.addIngredientToShopping');
        const titleLabel = t("cocktails.buyNamed", { name: item.name });
        const pluralCategory = getPluralCategory(locale, item.cocktailCount);
        const subtitleLabel = t(`cocktails.toMakeMore.${pluralCategory}`, { count: item.cocktailCount });
        const thumbnail = <Thumb label={item.name} uri={item.photoUri ?? undefined} />;
        const brandIndicatorColor = item.isStyled
          ? Colors.styledIngredient
          : item.isBranded
            ? Colors.primary
            : undefined;

        return (
          <ListRow
            title={titleLabel}
            subtitle={subtitleLabel}
            selected
            highlightColor={Colors.highlightSubtle}
            tagColor={item.tagColor}
            thumbnail={thumbnail}
            brandIndicatorColor={brandIndicatorColor}
            onPress={() => handleSelectIngredient(item.ingredientId)}
            accessibilityRole="button"
            metaAlignment="center"
            control={
              <View style={styles.shoppingSlot}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={accessibilityLabel}
                  onPress={() => handleShoppingToggle(item.ingredientId)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.shoppingButton, pressed ? styles.shoppingButtonPressed : null]}>
                  <MaterialIcons
                    name={isOnShoppingList ? 'shopping-cart' : 'add-shopping-cart'}
                    size={20}
                    color={isOnShoppingList ? Colors.tint : Colors.onSurfaceVariant}
                    style={styles.shoppingIcon}
                  />
                </Pressable>
              </View>
            }
          />
        );
      }

      const availability = getAvailabilitySummary(item.cocktail);
      return (
        <CocktailListRow
          cocktail={item.cocktail}
          ingredients={ingredients}
          showMethodIcons
          onPress={() => handleSelectCocktail(item.cocktail)}
          isReady={availability.isReady}
          missingCount={availability.missingCount}
          recipeNamesCount={availability.recipeNames.length}
          ingredientLine={availability.ingredientLine}
          ratingValue={getCocktailRating(item.cocktail)}
          hasBrandFallback={availability.hasBrandFallback}
          hasStyleFallback={availability.hasStyleFallback}
        />
      );
    },
    [
      getAvailabilitySummary,
      getCocktailRating,
      handleSelectCocktail,
      handleSelectIngredient,
      handleShoppingToggle,
      ingredients,
      shoppingIngredientIds,
      Colors,
      locale,
      t,
    ],
  );

  const renderSeparator = useCallback(
    ({ leadingItem }: { leadingItem?: Cocktail | null }) => {
      const isReady = leadingItem
        ? isCocktailReady(leadingItem, availableIngredientIds, ingredientLookup, undefined, {
          ignoreGarnish,
          allowAllSubstitutes,
        })
        : false;
      const backgroundColor = isReady ? Colors.outline : Colors.outlineVariant;

      return <View style={[styles.divider, { backgroundColor }]} />;
    },
    [
      availableIngredientIds,
      allowAllSubstitutes,
      ignoreGarnish,
      ingredientLookup,
      Colors,
    ],
  );

  const renderMySeparator = useCallback(
    ({ leadingItem }: { leadingItem?: MyTabListItem | null }) => {
      if (!leadingItem || leadingItem.type !== 'cocktail') {
        return null;
      }

      const cocktailKey = String(leadingItem.cocktail.id ?? leadingItem.cocktail.name);
      const isReady = myTabListData?.availabilityMap.get(cocktailKey) ?? false;
      const backgroundColor = isReady ? Colors.outline : Colors.outlineVariant;

      return <View style={[styles.divider, { backgroundColor }]} />;
    },
    [myTabListData, Colors],
  );

  const isFilterActive = selectedTagKeys.size > 0 || selectedMethodIds.size > 0;
  const isMyTab = activeTab === 'my';
  const listData = isMyTab ? myTabListData?.items ?? [] : sortedFavorites;
  const emptyMessage = useMemo(() => {
    switch (activeTab) {
      case 'my':
        return t('cocktails.emptyMy');
      case 'favorites':
        return t('cocktails.emptyFavorites');
      default:
        return t('cocktails.emptyAll');
    }
  }, [activeTab, t]);
  const helpContent = useMemo(() => {
    switch (activeTab) {
      case 'my':
        return {
          title: t('cocktails.helpMyTitle'),
          text: t('cocktails.helpMyText'),
        };
      case 'favorites':
        return {
          title: t('cocktails.helpFavoritesTitle'),
          text: t('cocktails.helpFavoritesText'),
        };
      case 'all':
      default:
        return {
          title: t('cocktails.helpAllTitle'),
          text: t('cocktails.helpAllText'),
        };
    }
  }, [activeTab, t]);

  const filterMenuTop = useMemo(() => {
    if (headerLayout && filterAnchorLayout) {
      return headerLayout.y + filterAnchorLayout.y + filterAnchorLayout.height + 6;
    }

    if (headerLayout) {
      return headerLayout.y + headerLayout.height;
    }

    return 0;
  }, [filterAnchorLayout, headerLayout]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors.background }]}
      edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.headerWrapper} onLayout={handleHeaderLayout}>
          <CollectionHeader
            searchValue={query}
            onSearchChange={setQuery}
            placeholder={t('common.search')}
            onMenuPress={() => setIsMenuOpen(true)}
            tabs={tabOptions}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            anchorPrefix="cocktails-tab"
            onFilterPress={handleFilterPress}
            filterActive={isFilterActive}
            filterExpanded={isFilterMenuVisible}
            onFilterLayout={handleFilterLayout}
            helpTitle={helpContent.title}
            helpText={helpContent.text}
          />
        </View>
        {isFilterMenuVisible ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.closeTagFilters')}
              onPress={handleCloseFilterMenu}
              style={styles.filterMenuBackdrop}
            />
            <View
              style={[
                styles.filterMenu,
                {
                  top: filterMenuTop,
                  backgroundColor: Colors.surface,
                  borderColor: Colors.outline,
                  shadowColor: Colors.shadow,
                },
              ]}>
              {/* Allow filter taps to work even if the search input keeps focus/keyboard open. */}
              <ScrollView
                style={styles.filterMenuScroll}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled">
                <View style={styles.filterMenuContent}>
                  <View style={styles.filterMethodList}>
                    {availableMethodOptions.length > 0 ? (
                      availableMethodOptions.map((method) => {
                        const selected = selectedMethodIds.has(method.id);
                        return (
                          <TagPill
                            key={method.id}
                            label={t(`cocktailMethod.${method.id}.label`)}
                            color={Colors.tint}
                            selected={selected}
                            icon={renderMethodIcon(method.id, selected)}
                            onPress={() => handleMethodFilterToggle(method.id)}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: selected }}
                            androidRippleColor={`${Colors.surfaceVariant}33`}
                          />
                        );
                      })
                    ) : (
                      <Text style={[styles.filterMenuEmpty, { color: Colors.onSurfaceVariant }]}>
                        {t("common.noMethodsAvailable")}
                      </Text>
                    )}
                  </View>
                  <View style={styles.filterSeparator}>
                    <View style={[styles.filterSeparatorLine, { backgroundColor: Colors.outline }]} />
                    <Text style={[styles.filterSeparatorLabel, { color: Colors.onSurfaceVariant }]}>
                      {t("common.and")}
                    </Text>
                    <View style={[styles.filterSeparatorLine, { backgroundColor: Colors.outline }]} />
                  </View>
                  <View style={styles.filterTagList}>
                    {availableTagOptions.length > 0 ? (
                      availableTagOptions.map((tag) => {
                        const selected = selectedTagKeys.has(tag.key);
                        const isBuiltin = !isNaN(Number(tag.key)) && Number(tag.key) >= 1 && Number(tag.key) <= 11;
                        const translatedName = isBuiltin ? t(`cocktailTag.${tag.key}`) : tag.name;
                        const finalName = (isBuiltin && translatedName !== `cocktailTag.${tag.key}`) ? translatedName : tag.name;

                        return (
                          <TagPill
                            key={tag.key}
                            label={finalName}
                            color={tag.color}
                            selected={selected}
                            onPress={() => handleTagFilterToggle(tag.key)}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: selected }}
                            androidRippleColor={`${Colors.surfaceVariant}33`}
                          />
                        );
                      })
                    ) : (
                      <Text style={[styles.filterMenuEmpty, { color: Colors.onSurfaceVariant }]}>
                        {t("common.noTagsAvailable")}
                      </Text>
                    )}
                  </View>
                </View>
                {selectedTagKeys.size > 0 || selectedMethodIds.size > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("cocktails.clearSelectedFilters")}
                    onPress={handleClearFilters}
                    style={styles.filterMenuClearButton}>
                    <Text style={[styles.filterMenuClearLabel, { color: Colors.tint }]}>{t("common.clearFilters")}</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>
          </>
        ) : null}
        <FlatList
          ref={listRef}
          data={listData}
          keyExtractor={isMyTab ? myTabKeyExtractor : keyExtractor}
          renderItem={isMyTab ? renderMyItem : renderItem}
          ItemSeparatorComponent={isMyTab ? renderMySeparator : renderSeparator}
          contentContainerStyle={styles.listContent}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          showsVerticalScrollIndicator
          keyboardDismissMode="on-drag"
          // Ensure first tap triggers row actions while dismissing the keyboard.
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <Text style={[styles.emptyLabel, { color: Colors.onSurfaceVariant }]}>
              {emptyMessage}
            </Text>
          }
        />
      </View>
      <FabAdd
        label={t("cocktails.addCocktail")}
        onPress={() =>
          router.push({ pathname: '/cocktails/create', params: { source: 'cocktails' } })
        }
      />
      <SideMenuDrawer visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    position: 'relative',
  },
  headerWrapper: {
    zIndex: 2,
  },
  listContent: {
    paddingTop: 0,
    paddingBottom: 80,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  moreIngredientsWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  moreIngredientsLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  shoppingButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shoppingButtonPressed: {
    opacity: 0.6,
  },
  shoppingIcon: {
    width: 20,
    height: 20,
    alignSelf: 'flex-end',
  },
  shoppingSlot: {
    minHeight: 24,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLabel: {
    textAlign: 'center',
    marginTop: 80,
    fontSize: 14,
    paddingHorizontal: 20,
  },
  filterMenuBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 3,
  },
  filterMenu: {
    position: 'absolute',
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'stretch',
    zIndex: 4,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  filterMenuScroll: {
    maxHeight: 540,
    paddingBottom: 2,
  },
  filterMenuContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  filterMethodList: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-start',
  },
  methodIcon: {
    width: METHOD_ICON_SIZE,
    height: METHOD_ICON_SIZE,
  },
  methodIconWrapper: {
    width: METHOD_ICON_SIZE,
    height: METHOD_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muddleIcon: {
    transform: [{ scaleX: 2 }],
  },
  filterTagList: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-end',
  },
  filterSeparator: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  filterSeparatorLine: {
    width: StyleSheet.hairlineWidth,
    flex: 1,
  },
  filterSeparatorLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingVertical: 4,
  },
  filterMenuEmpty: {
    fontSize: 14,
    textAlign: 'left',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  filterMenuClearButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterMenuClearLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
