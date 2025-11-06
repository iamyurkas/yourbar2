import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resolveAssetFromCatalog } from '@/assets/image-manifest';
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
  const { ingredients, cocktails, availableIngredientIds, toggleIngredientAvailability } = useInventory();

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

            {ingredient.description ? (
              <View style={styles.infoBlock}>
                <Text style={[styles.sectionLabel, { color: palette.onSurfaceVariant }]}>Description</Text>
                <Text style={[styles.bodyText, { color: palette.onSurface }]}>{ingredient.description}</Text>
              </View>
            ) : null}

            <View style={styles.infoBlock}>
              <Text style={[styles.sectionLabel, { color: palette.onSurfaceVariant }]}>Base ingredient</Text>
              <Text style={[styles.bodyText, { color: palette.onSurface }]}>{baseIngredient?.name ?? '—'}</Text>
            </View>

            <View style={styles.infoBlock}>
              <Text style={[styles.sectionLabel, { color: palette.onSurfaceVariant }]}>Cocktails</Text>
              {cocktailsWithIngredient.length ? (
                <View style={styles.cocktailList}>
                  {cocktailsWithIngredient.map((cocktail) => (
                    <ListRow
                      key={cocktail.id ?? cocktail.name}
                      title={cocktail.name}
                      subtitle={`${cocktail.ingredients?.length ?? 0} ingredients`}
                      thumbnail={<Thumb label={cocktail.name} uri={cocktail.photoUri} />}
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
  },
  placeholderText: {
    fontSize: 15,
    textAlign: 'center',
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
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
  addButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
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
