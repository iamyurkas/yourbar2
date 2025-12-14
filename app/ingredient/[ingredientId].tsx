import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
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
import { TagPill } from '@/components/TagPill';
import { Colors } from '@/constants/theme';
import { createIngredientLookup } from '@/libs/ingredient-availability';
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

export default function IngredientDetailsScreen() {
  const palette = Colors;
  const { ingredientId } = useLocalSearchParams<{ ingredientId?: string }>();
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

  const ingredientLookup = useMemo(() => createIngredientLookup(ingredients), [ingredients]);

  const numericIngredientId = useMemo(() => {
    const candidate = ingredient?.id ?? (Array.isArray(ingredientId) ? ingredientId[0] : ingredientId);
    const parsed = Number(candidate);
    return Number.isNaN(parsed) ? undefined : parsed;
  }, [ingredient?.id, ingredientId]);

  const [optimisticAvailability, setOptimisticAvailability] = useState<boolean | null>(null);
  const [optimisticShopping, setOptimisticShopping] = useState<boolean | null>(null);
  const [, startAvailabilityTransition] = useTransition();
  const [, startShoppingTransition] = useTransition();

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

  const effectiveIsAvailable = optimisticAvailability ?? isAvailable;
  const effectiveIsOnShoppingList = optimisticShopping ?? isOnShoppingList;

  useEffect(() => {
    setOptimisticAvailability((previous) => {
      if (previous == null) {
        return previous;
      }

      return previous === isAvailable ? null : previous;
    });
  }, [isAvailable]);

  useEffect(() => {
    setOptimisticShopping((previous) => {
      if (previous == null) {
        return previous;
      }

      return previous === isOnShoppingList ? null : previous;
    });
  }, [isOnShoppingList]);

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
      setOptimisticAvailability((previous) => {
        const current = previous ?? isAvailable;
        return !current;
      });

      startAvailabilityTransition(() => {
        toggleIngredientAvailability(numericIngredientId);
      });
    }
  }, [isAvailable, numericIngredientId, startAvailabilityTransition, toggleIngredientAvailability]);

  const handleToggleShopping = useCallback(() => {
    if (numericIngredientId != null) {
      setOptimisticShopping((previous) => {
        const current = previous ?? isOnShoppingList;
        return !current;
      });

      startShoppingTransition(() => {
        toggleIngredientShopping(numericIngredientId);
      });
    }
  }, [isOnShoppingList, numericIngredientId, startShoppingTransition, toggleIngredientShopping]);

  const handleEditPress = useCallback(() => {
    if (!ingredient) {
      return;
    }

    const targetId = ingredient.id ?? ingredient.name;
    if (!targetId) {
      return;
    }

    router.push({
      pathname: '/ingredient/[ingredientId]/edit',
      params: { ingredientId: String(targetId) },
    });
  }, [ingredient]);

  const handleAddCocktail = useCallback(() => {
    if (!ingredient) {
      router.push('/cocktail/create');
      return;
    }

    const targetId = ingredient.id ?? ingredient.name;
    const params: Record<string, string> = { source: 'ingredient' };
    if (targetId != null) {
      params.ingredientId = String(targetId);
    }
    if (ingredient.name) {
      params.ingredientName = ingredient.name;
    }

    router.push({ pathname: '/cocktail/create', params });
  }, [ingredient]);

  const DESCRIPTION_PREVIEW_LINES = 5;
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [shouldTruncateDescription, setShouldTruncateDescription] = useState(false);

  const handleDescriptionLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      if (shouldTruncateDescription) {
        return;
      }

      const totalLines = event.nativeEvent?.lines?.length ?? 0;
      if (totalLines > DESCRIPTION_PREVIEW_LINES) {
        setShouldTruncateDescription(true);
      }
    },
    [DESCRIPTION_PREVIEW_LINES, shouldTruncateDescription],
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

  const handleNavigateToCocktail = useCallback((cocktailId: number | string | undefined) => {
    if (cocktailId == null) {
      return;
    }

    router.push({ pathname: '/cocktail/[cocktailId]', params: { cocktailId: String(cocktailId) } });
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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]} edges={['left', 'right']}>
      <Stack.Screen
        options={{
          title: 'Ingredient details',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: palette.surface },
          headerTitleStyle: { color: palette.onSurface, fontSize: 16, fontWeight: '600' },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.headerButton}
              hitSlop={8}>
              <MaterialCommunityIcons name="arrow-left" size={22} color={palette.onSurface} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={handleEditPress}
              accessibilityRole="button"
              accessibilityLabel="Edit ingredient"
              style={styles.headerButton}
              hitSlop={8}>
              <MaterialCommunityIcons name="pencil-outline" size={20} color={palette.onSurface} />
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {ingredient ? (
          <View style={styles.section}>
            <Text style={[styles.name, { color: palette.onSurface }]}>{ingredient.name}</Text>

            <View style={styles.mediaSection}>
              <View style={styles.photoWrapper}>
                {photoSource ? (
                  <Image source={photoSource} style={styles.photo} contentFit="contain" />
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
                    effectiveIsOnShoppingList
                      ? 'Remove ingredient from shopping list'
                      : 'Add ingredient to shopping list'
                  }
                  hitSlop={8}
                  style={styles.statusIconButton}
                >
                  <MaterialIcons
                    name={
                      effectiveIsOnShoppingList ? 'shopping-cart' : 'add-shopping-cart'
                    }
                    size={24}
                    color={
                      effectiveIsOnShoppingList ? palette.tint : palette.onSurfaceVariant
                    }
                  />
                </Pressable>
                <PresenceCheck checked={effectiveIsAvailable} onToggle={handleToggleAvailability} />
              </View>
            </View>

            {ingredient.tags && ingredient.tags.length ? (
              <View style={styles.tagList}>
                {ingredient.tags.map((tag) => (
                  <TagPill
                    key={tag.id ?? tag.name}
                    label={tag.name ?? ''}
                    color={tag.color ?? palette.tint}
                    selected
                    accessibilityLabel={tag.name ?? 'Tag'}
                  />
                ))}
              </View>
            ) : null}

            {ingredient.description ? (
              <View style={styles.textBlock}>
                <Text
                  style={[styles.bodyText, styles.descriptionText, { color: palette.onSurfaceVariant }]}
                  numberOfLines={
                    !isDescriptionExpanded && shouldTruncateDescription
                      ? DESCRIPTION_PREVIEW_LINES
                      : undefined
                  }
                  onTextLayout={handleDescriptionLayout}
                >
                  {ingredient.description}
                </Text>
                {shouldTruncateDescription ? (
                  <Pressable
                    onPress={handleToggleDescription}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isDescriptionExpanded ? 'Show less description' : 'Show full description'
                    }
                    hitSlop={8}
                  >
                    <Text style={[styles.toggleDescription, { color: palette.tint }]}> 
                      {isDescriptionExpanded ? 'Show less' : 'Show more'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {baseIngredient ? (
              <View style={styles.textBlock}>
                <Text style={[styles.sectionTitle, { color: palette.onSurface }]}>Base ingredient</Text>
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
                            { backgroundColor: palette.background },
                          ]}>
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
                        name="link-off"
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
              <View style={styles.textBlock}>
                <Text style={[styles.sectionTitle, { color: palette.onSurface }]}>Branded ingredients</Text>
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
                              name="link-off"
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

            <View style={[styles.textBlock, styles.cocktailBlock]}>
              <Text style={[styles.sectionTitle, { color: palette.onSurface }]}>Cocktails</Text>
              {cocktailsWithIngredient.length ? (
                <View style={styles.cocktailList}>
                  {cocktailsWithIngredient.map((cocktail) => (
                    <CocktailListRow
                      key={cocktail.id ?? cocktail.name}
                      cocktail={cocktail}
                      availableIngredientIds={availableIngredientIds}
                      ingredientLookup={ingredientLookup}
                      onPress={() => handleNavigateToCocktail(cocktail.id ?? cocktail.name)}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  section: {
    gap: 24,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  mediaSection: {
    gap: 16,
    alignItems: 'center',
  },
  photoWrapper: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceBright,
  },
  photoPlaceholder: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    gap: 8,
  },
  photoPlaceholderText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    justifyContent: 'flex-end',
    gap: 16,
  },
  statusIconButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cocktailList: {
    gap: 12,
    marginHorizontal: -24,
  },
  placeholderText: {
    fontSize: 14,
    textAlign: 'center',
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
  },
  textBlock: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
  },
  descriptionText: {
    color: Colors.onSurfaceMuted,
  },
  toggleDescription: {
    fontSize: 14,
    fontWeight: '500',
  },
  baseIngredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
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
    fontSize: 14,
    fontWeight: '500',
  },
  baseIngredientActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unlinkButton: {
    padding: 6,
    borderRadius: 12,
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
    borderRadius: 12,
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
});
