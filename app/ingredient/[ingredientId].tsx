import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams, useSegments } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resolveAssetFromCatalog } from '@/assets/image-manifest';
import { CocktailListRow } from '@/components/CocktailListRow';
import { PresenceCheck } from '@/components/RowParts';
import { Colors } from '@/constants/theme';
import { useInventory, type Ingredient } from '@/providers/inventory-provider';

function useResolvedIngredient(param: string | undefined, ingredients: Ingredient[]) {
  return useMemo(() => {
    if (!param) {
      return undefined;
    }

    const numericId = Number(param);
    if (!Number.isNaN(numericId)) {
      const byId = ingredients.find((item) => Number(item.id ?? -1) === numericId);
      if (byId) {
        return byId;
      }
    }

    const normalized = param.toLowerCase();
    return ingredients.find((item) => item.name?.toLowerCase() === normalized);
  }, [ingredients, param]);
}

const BOTTOM_TABS = [
  {
    key: 'cocktails',
    label: 'Коктейлі',
    href: '/cocktails' as const,
    iconName: 'glass-cocktail' as const,
  },
  {
    key: 'shaker',
    label: 'Шейкер',
    href: '/shaker' as const,
    iconName: 'blender' as const,
  },
  {
    key: 'ingredients',
    label: 'Інгредієнти',
    href: '/ingredients' as const,
    iconName: 'food-apple-outline' as const,
  },
] as const;

export default function IngredientDetailsScreen() {
  const palette = Colors;
  const { ingredientId } = useLocalSearchParams<{ ingredientId?: string }>();
  const segments = useSegments();
  const {
    ingredients,
    cocktails,
    availableIngredientIds,
    toggleIngredientAvailability,
    shoppingIngredientIds,
    toggleIngredientShopping,
    clearBaseIngredient,
  } = useInventory();

  const ingredient = useResolvedIngredient(
    Array.isArray(ingredientId) ? ingredientId[0] : ingredientId,
    ingredients,
  );

  const numericIngredientId = useMemo(() => {
    const candidate = ingredient?.id ?? (Array.isArray(ingredientId) ? ingredientId[0] : ingredientId);
    const parsed = Number(candidate);
    return Number.isNaN(parsed) ? undefined : parsed;
  }, [ingredient?.id, ingredientId]);

  const isAvailable = useMemo(() => {
    if (numericIngredientId == null) {
      return false;
    }
    return availableIngredientIds.has(numericIngredientId);
  }, [availableIngredientIds, numericIngredientId]);

  const isOnShoppingList = useMemo(() => {
    if (numericIngredientId == null) {
      return false;
    }
    return shoppingIngredientIds.has(numericIngredientId);
  }, [numericIngredientId, shoppingIngredientIds]);

  const baseIngredient = useMemo(() => {
    if (!ingredient?.baseIngredientId) {
      return undefined;
    }

    const baseId = Number(ingredient.baseIngredientId);
    if (Number.isNaN(baseId)) {
      return undefined;
    }

    return ingredients.find((item) => Number(item.id ?? -1) === baseId);
  }, [ingredient?.baseIngredientId, ingredients]);

  const brandedIngredients = useMemo(() => {
    if (numericIngredientId == null) {
      return [];
    }

    return ingredients.filter((item) => Number(item.baseIngredientId ?? -1) === numericIngredientId);
  }, [ingredients, numericIngredientId]);

  const baseIngredientPhotoSource = useMemo(() => {
    if (!baseIngredient?.photoUri) {
      return undefined;
    }

    const asset = resolveAssetFromCatalog(baseIngredient.photoUri);
    if (asset) {
      return asset;
    }

    if (/^https?:/i.test(baseIngredient.photoUri)) {
      return { uri: baseIngredient.photoUri } as const;
    }

    return undefined;
  }, [baseIngredient?.photoUri]);

  const cocktailsWithIngredient = useMemo(() => {
    if (!ingredient) {
      return [];
    }

    const normalizedName = ingredient.name?.toLowerCase();
    const idToMatch = numericIngredientId;

    return cocktails.filter((cocktail) =>
      cocktail.ingredients?.some((cocktailIngredient) => {
        if (idToMatch != null && !Number.isNaN(Number(cocktailIngredient.ingredientId))) {
          if (Number(cocktailIngredient.ingredientId) === idToMatch) {
            return true;
          }
        }

        if (normalizedName && cocktailIngredient.name) {
          return cocktailIngredient.name.toLowerCase() === normalizedName;
        }

        return false;
      }),
    );
  }, [cocktails, ingredient, numericIngredientId]);

  const handleToggleAvailability = useCallback(() => {
    if (numericIngredientId != null) {
      toggleIngredientAvailability(numericIngredientId);
    }
  }, [numericIngredientId, toggleIngredientAvailability]);

  const handleToggleShopping = useCallback(() => {
    if (numericIngredientId != null) {
      toggleIngredientShopping(numericIngredientId);
    }
  }, [numericIngredientId, toggleIngredientShopping]);

  const handleEditPress = useCallback(() => {
    // Editing functionality to be implemented later
  }, []);

  const handleAddCocktail = useCallback(() => {
    // Navigation to add cocktail will be added later
  }, []);

  const DESCRIPTION_PREVIEW_LINES = 5;
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [shouldShowDescriptionToggle, setShouldShowDescriptionToggle] = useState(false);

  const handleDescriptionLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      if (shouldShowDescriptionToggle) {
        return;
      }

      const totalLines = event.nativeEvent?.lines?.length ?? 0;
      if (totalLines > DESCRIPTION_PREVIEW_LINES) {
        setShouldShowDescriptionToggle(true);
      }
    },
    [DESCRIPTION_PREVIEW_LINES, shouldShowDescriptionToggle],
  );

  const handleToggleDescription = useCallback(() => {
    setIsDescriptionExpanded((previous) => !previous);
  }, []);

  const photoSource = useMemo(() => {
    if (!ingredient?.photoUri) {
      return undefined;
    }

    const asset = resolveAssetFromCatalog(ingredient.photoUri);
    if (asset) {
      return asset;
    }

    if (/^https?:/i.test(ingredient.photoUri)) {
      return { uri: ingredient.photoUri } as const;
    }

    return undefined;
  }, [ingredient?.photoUri]);

  const handleRemoveBase = useCallback(
    (event?: GestureResponderEvent) => {
      event?.stopPropagation();

      if (!ingredient || numericIngredientId == null || !ingredient.baseIngredientId) {
        return;
      }

      Alert.alert(
        'Remove base ingredient',
        `Are you sure you want to unlink ${ingredient.name} from its base ingredient?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              clearBaseIngredient(numericIngredientId);
            },
          },
        ],
      );
    },
    [clearBaseIngredient, ingredient, numericIngredientId],
  );

  const handleNavigateToBase = useCallback(() => {
    if (!baseIngredient?.id) {
      return;
    }

    router.push({
      pathname: '/ingredient/[ingredientId]',
      params: { ingredientId: String(baseIngredient.id) },
    });
  }, [baseIngredient?.id]);

  const handleNavigateToIngredient = useCallback((id: number | string | undefined) => {
    if (id == null) {
      return;
    }

    router.push({ pathname: '/ingredient/[ingredientId]', params: { ingredientId: String(id) } });
  }, []);

  const handleRemoveBranded = useCallback(
    (brandedIngredient: Ingredient) =>
      (event?: GestureResponderEvent) => {
        event?.stopPropagation();

        const brandedId = Number(brandedIngredient.id ?? -1);
        if (Number.isNaN(brandedId)) {
          return;
        }

        Alert.alert(
          'Remove branded ingredient',
          `Unlink ${brandedIngredient.name} from ${ingredient?.name}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: () => {
                clearBaseIngredient(brandedId);
              },
            },
          ],
        );
      },
    [clearBaseIngredient, ingredient?.name],
  );

  const handleNavigateToTab = useCallback((href: (typeof BOTTOM_TABS)[number]['href']) => {
    router.replace(href);
  }, []);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
      edges={['left', 'right', 'bottom']}>
      <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Ingredient details',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: palette.surface },
          headerTitleStyle: { color: palette.onSurface, fontSize: 18, fontWeight: '600' },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={[styles.headerButton, { backgroundColor: palette.surfaceVariant }]}
              hitSlop={8}>
              <MaterialCommunityIcons name="arrow-left" size={22} color={palette.onSurface} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={handleEditPress}
              accessibilityRole="button"
              accessibilityLabel="Edit ingredient"
              style={[styles.headerButton, { backgroundColor: palette.surfaceVariant }]}
              hitSlop={8}>
              <MaterialCommunityIcons name="pencil-outline" size={20} color={palette.onSurface} />
            </Pressable>
          ),
        }}
      />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
        {ingredient ? (
          <View style={styles.section}>
            <Text style={[styles.name, { color: palette.onSurface }]}>{ingredient.name}</Text>

            <View style={styles.photoWrapper}>
              {photoSource ? (
                <Image
                  source={photoSource}
                  style={[styles.photo, { backgroundColor: palette.surface }]}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    styles.photoPlaceholder,
                    { borderColor: palette.outline, backgroundColor: palette.surface },
                  ]}>
                  <Text style={[styles.photoPlaceholderText, { color: palette.onSurfaceVariant }]}>No photo</Text>
                </View>
              )}
            </View>

            <View style={styles.statusRow}>
              <Pressable
                onPress={handleToggleShopping}
                accessibilityRole="button"
                accessibilityLabel={
                  isOnShoppingList
                    ? 'Remove ingredient from shopping list'
                    : 'Add ingredient to shopping list'
                }
                hitSlop={8}
              >
                <MaterialIcons
                  name={isOnShoppingList ? 'shopping-cart' : 'add-shopping-cart'}
                  size={22}
                  color={isOnShoppingList ? palette.tint : palette.onSurfaceVariant}
                />
              </Pressable>
              <PresenceCheck checked={isAvailable} onToggle={handleToggleAvailability} />
            </View>

            {ingredient.tags && ingredient.tags.length ? (
              <View style={styles.tagList}>
                {ingredient.tags.map((tag) => (
                  <View
                    key={tag.id ?? tag.name}
                    style={[styles.tagChip, { backgroundColor: tag.color ?? palette.surfaceVariant }]}
                  >
                    <Text style={[styles.tagText, { color: palette.onPrimary }]}>{tag.name}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {ingredient.description ? (
              <View style={styles.infoBlock}>
                <Text style={[styles.sectionLabel, { color: palette.onSurfaceVariant }]}>Description</Text>
                <Text
                  style={[styles.bodyText, { color: palette.onSurface }]}
                  numberOfLines={isDescriptionExpanded ? undefined : DESCRIPTION_PREVIEW_LINES}
                  onTextLayout={handleDescriptionLayout}
                >
                  {ingredient.description}
                </Text>
                {shouldShowDescriptionToggle ? (
                  <Pressable
                    onPress={handleToggleDescription}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isDescriptionExpanded ? 'Show less description' : 'Show full description'
                    }
                    hitSlop={8}
                  >
                    <Text style={[styles.showMoreLess, { color: palette.tint }]}>
                      {isDescriptionExpanded ? 'Show less' : 'Show more'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {baseIngredient ? (
              <View style={styles.infoBlock}>
                <Text style={[styles.sectionLabel, { color: palette.onSurfaceVariant }]}>Base ingredient</Text>
                <Pressable
                  onPress={handleNavigateToBase}
                  accessibilityRole="button"
                  accessibilityLabel="View base ingredient"
                  style={[
                    styles.baseIngredientRow,
                    { borderColor: palette.outline, backgroundColor: palette.surface },
                  ]}>
                  <View style={styles.baseIngredientInfo}>
                    <View style={styles.baseIngredientThumb}>
                      {baseIngredientPhotoSource ? (
                        <Image
                          source={baseIngredientPhotoSource}
                          style={styles.baseIngredientImage}
                          contentFit="contain"
                        />
                      ) : (
                        <View
                          style={[
                            styles.baseIngredientPlaceholder,
                            { backgroundColor: palette.surfaceVariant },
                          ]}>
                          <MaterialCommunityIcons
                            name="image-off"
                            size={20}
                            color={palette.onSurfaceVariant}
                          />
                        </View>
                      )}
                    </View>
                    <Text style={[styles.baseIngredientName, { color: palette.onSurface }]} numberOfLines={2}>
                      {baseIngredient.name}
                    </Text>
                  </View>
                  <View style={styles.baseIngredientActions}>
                    <Pressable
                      onPress={handleRemoveBase}
                      style={styles.unlinkButton}
                      accessibilityRole="button"
                      accessibilityLabel="Remove base ingredient"
                      hitSlop={8}>
                      <MaterialCommunityIcons
                        name="link-variant-off"
                        size={20}
                        color={palette.error}
                      />
                    </Pressable>
                    <MaterialIcons name="chevron-right" size={20} color={palette.onSurfaceVariant} />
                  </View>
                </Pressable>
              </View>
            ) : null}

            {brandedIngredients.length ? (
              <View style={styles.infoBlock}>
                <Text style={[styles.sectionLabel, { color: palette.onSurfaceVariant }]}>Branded ingredients</Text>
                <View style={styles.brandedList}>
                  {brandedIngredients.map((branded) => {
                    const brandedPhotoSource = (() => {
                      if (!branded.photoUri) {
                        return undefined;
                      }

                      const asset = resolveAssetFromCatalog(branded.photoUri);
                      if (asset) {
                        return asset;
                      }

                      if (/^https?:/i.test(branded.photoUri)) {
                        return { uri: branded.photoUri } as const;
                      }

                      return undefined;
                    })();

                    return (
                      <Pressable
                        key={branded.id ?? branded.name}
                        onPress={() => handleNavigateToIngredient(branded.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`View ${branded.name}`}
                        style={[
                          styles.baseIngredientRow,
                          { borderColor: palette.outline, backgroundColor: palette.surface },
                        ]}>
                        <View style={styles.baseIngredientInfo}>
                          <View style={styles.baseIngredientThumb}>
                            {brandedPhotoSource ? (
                              <Image
                                source={brandedPhotoSource}
                                style={styles.baseIngredientImage}
                                contentFit="contain"
                              />
                            ) : (
                              <View
                                style={[
                                  styles.baseIngredientPlaceholder,
                                  { backgroundColor: palette.surfaceVariant },
                                ]}>
                                <MaterialCommunityIcons
                                  name="image-off"
                                  size={20}
                                  color={palette.onSurfaceVariant}
                                />
                              </View>
                            )}
                          </View>
                          <Text
                            style={[styles.baseIngredientName, { color: palette.onSurface }]}
                            numberOfLines={2}>
                            {branded.name}
                          </Text>
                        </View>
                        <View style={styles.baseIngredientActions}>
                          <Pressable
                            onPress={handleRemoveBranded(branded)}
                            style={styles.unlinkButton}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${branded.name} link`}
                            hitSlop={8}>
                            <MaterialCommunityIcons
                              name="link-variant-off"
                              size={20}
                              color={palette.error}
                            />
                          </Pressable>
                          <MaterialIcons name="chevron-right" size={20} color={palette.onSurfaceVariant} />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={[styles.infoBlock, styles.cocktailBlock]}>
              <Text style={[styles.sectionLabel, { color: palette.onSurfaceVariant }]}>Cocktails</Text>
              {cocktailsWithIngredient.length ? (
                <View style={styles.cocktailList}>
                  {cocktailsWithIngredient.map((cocktail) => (
                    <CocktailListRow
                      key={cocktail.id ?? cocktail.name}
                      cocktail={cocktail}
                      availableIngredientIds={availableIngredientIds}
                    />
                  ))}
                </View>
              ) : (
                <Text style={[styles.placeholderText, { color: palette.onSurfaceVariant }]}>No cocktails yet</Text>
              )}
            </View>

            <Pressable
              style={[styles.addButton, { backgroundColor: palette.tint }]}
              onPress={handleAddCocktail}
              accessibilityRole="button"
              accessibilityLabel="Add cocktail">
              <Text style={[styles.addButtonLabel, { color: palette.onPrimary }]}>+ Add cocktail</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.placeholderText, { color: palette.onSurfaceVariant }]}>Ingredient not found</Text>
          </View>
        )}
        </ScrollView>

        <View style={[styles.bottomTabsWrapper, { borderColor: palette.outline, backgroundColor: palette.surface }]}>
          {BOTTOM_TABS.map(({ key, label, iconName, href }) => {
            const isActive = segments[0] === key;
            return (
              <Pressable
                key={key}
                onPress={() => handleNavigateToTab(href)}
                style={[
                  styles.bottomTabButton,
                  isActive && { backgroundColor: palette.surfaceVariant },
                ]}
                accessibilityRole="button"
                accessibilityLabel={label}>
                <MaterialCommunityIcons
                  name={iconName}
                  size={22}
                  color={isActive ? palette.tint : palette.icon}
                  accessibilityRole="image"
                  accessibilityLabel={label}
                />
                <Text
                  style={[
                    styles.bottomTabLabel,
                    { color: isActive ? palette.tint : palette.onSurfaceVariant },
                  ]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
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
  scroll: {
    flex: 1,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 160,
    gap: 24,
  },
  section: {
    gap: 24,
  },
  name: {
    fontSize: 28,
    fontWeight: '600',
  },
  photoWrapper: {
    width: 150,
    height: 150,
    alignSelf: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  photoPlaceholder: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 16,
  },
  photoPlaceholderText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 20,
    marginTop: 16,
  },
  infoBlock: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '500',
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 22,
  },
  cocktailList: {
    gap: 12,
    marginHorizontal: -24,
  },
  placeholderText: {
    fontSize: 15,
    textAlign: 'center',
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  showMoreLess: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  baseIngredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: 12,
    borderWidth: 1,
    borderRadius: 16,
  },
  baseIngredientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  baseIngredientThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  baseIngredientImage: {
    width: '100%',
    height: '100%',
  },
  baseIngredientPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  baseIngredientName: {
    fontSize: 16,
    fontWeight: '500',
  },
  baseIngredientActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unlinkButton: {
    padding: 6,
    borderRadius: 999,
  },
  brandedList: {
    gap: 12,
  },
  cocktailBlock: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
  },
  addButton: {
    marginTop: 12,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  addButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  bottomTabsWrapper: {
    marginTop: 16,
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  bottomTabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bottomTabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
