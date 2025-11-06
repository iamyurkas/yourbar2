import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
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

import { resolveAssetFromCatalog, resolveGlasswareUriFromId } from '@/assets/image-manifest';
import { ListRow, PresenceCheck, Thumb } from '@/components/RowParts';
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

export default function IngredientDetailsScreen() {
  const palette = Colors;
  const { ingredientId } = useLocalSearchParams<{ ingredientId?: string }>();
  const {
    ingredients,
    cocktails,
    availableIngredientIds,
    toggleIngredientAvailability,
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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]} edges={['left', 'right']}>
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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

            <Pressable
              onPress={handleToggleAvailability}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isAvailable }}
              style={[styles.availabilityRow, { backgroundColor: palette.surfaceVariant }]}
            >
              <View style={styles.availabilityInfo}>
                <MaterialIcons name="add-shopping-cart" size={20} color={palette.onSurfaceVariant} />
                <Text style={[styles.availabilityLabel, { color: palette.onSurface }]}>Available</Text>
              </View>
              <PresenceCheck checked={isAvailable} onToggle={handleToggleAvailability} />
            </Pressable>

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

            <View style={styles.infoBlock}>
              <Text style={[styles.sectionLabel, { color: palette.onSurfaceVariant }]}>Base ingredient</Text>
              {baseIngredient ? (
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
              ) : (
                <Text style={[styles.bodyText, { color: palette.onSurfaceVariant }]}>—</Text>
              )}
            </View>

            <View style={[styles.infoBlock, styles.cocktailBlock]}>
              <Text style={[styles.sectionLabel, { color: palette.onSurfaceVariant }]}>Cocktails</Text>
              {cocktailsWithIngredient.length ? (
                <View style={styles.cocktailList}>
                  {cocktailsWithIngredient.map((cocktail) => (
                    <ListRow
                      key={cocktail.id ?? cocktail.name}
                      title={cocktail.name}
                      subtitle={`${cocktail.ingredients?.length ?? 0} ingredients`}
                      thumbnail={
                        <Thumb
                          label={cocktail.name}
                          uri={cocktail.photoUri}
                          fallbackUri={resolveGlasswareUriFromId(cocktail.glassId)}
                        />
                      }
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
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
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  availabilityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  availabilityLabel: {
    fontSize: 16,
    fontWeight: '500',
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
});
