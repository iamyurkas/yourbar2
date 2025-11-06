import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TagPill } from '@/components/ui/TagPill';
import { Colors } from '@/constants/theme';
import type { Ingredient } from '@/providers/inventory-provider';
import { useInventory } from '@/providers/inventory-provider';

export default function IngredientDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const {
    ingredients,
    cocktails,
    availableIngredientIds,
    toggleIngredientAvailability,
    toggleShoppingList,
    findIngredientById,
  } = useInventory();

  const ingredientId = useMemo(() => {
    const numeric = Number(id);
    return Number.isFinite(numeric) ? numeric : null;
  }, [id]);

  const ingredient = useMemo<Ingredient | undefined>(() => {
    if (ingredientId == null) {
      return undefined;
    }
    return findIngredientById(ingredientId);
  }, [findIngredientById, ingredientId]);

  const isAvailable = ingredient ? availableIngredientIds.has(ingredient.id) : false;
  const inShoppingList = ingredient?.shoppingList ?? false;

  const baseIngredient = useMemo(() => {
    if (!ingredient?.baseIngredientId) {
      return undefined;
    }
    return ingredients.find((item) => item.id === ingredient.baseIngredientId);
  }, [ingredient, ingredients]);

  const brandedChildren = useMemo(
    () =>
      ingredient
        ? ingredients.filter((item) => item.baseIngredientId === ingredient.id && item.id !== ingredient.id)
        : [],
    [ingredient, ingredients],
  );

  const relatedCocktails = useMemo(() => {
    if (!ingredient) {
      return [];
    }
    return cocktails.filter((cocktail) =>
      cocktail.ingredients?.some((item) => item.ingredientId === ingredient.id),
    );
  }, [cocktails, ingredient]);

  const handleToggleAvailability = useCallback(() => {
    if (ingredient) {
      toggleIngredientAvailability(ingredient.id);
    }
  }, [ingredient, toggleIngredientAvailability]);

  const handleToggleShopping = useCallback(() => {
    if (ingredient) {
      toggleShoppingList(ingredient.id);
    }
  }, [ingredient, toggleShoppingList]);

  const handleEdit = useCallback(() => {
    if (ingredient) {
      router.push({ pathname: '/ingredients/[id]/edit', params: { id: String(ingredient.id) } });
    }
  }, [ingredient, router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const ingredientDescription = ingredient?.description ?? '';

  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const descriptionNeedsToggle = ingredientDescription.length > 160;

  const displayedDescription = useMemo(() => {
    if (!ingredientDescription) {
      return '';
    }

    if (descriptionExpanded || !descriptionNeedsToggle) {
      return ingredientDescription;
    }

    return `${ingredientDescription.slice(0, 160)}…`;
  }, [descriptionExpanded, descriptionNeedsToggle, ingredientDescription]);

  const handleToggleDescription = useCallback(() => {
    setDescriptionExpanded((prev) => !prev);
  }, []);

  const renderHeader = (actionsEnabled: boolean) => (
    <View style={[styles.header, { backgroundColor: Colors.surface, borderBottomColor: Colors.outline }]}>
      <Pressable
        onPress={handleBack}
        accessibilityRole="button"
        style={styles.headerIconButton}
        android_ripple={{ color: `${Colors.onSurface}14` }}>
        <MaterialIcons
          name={Platform.select({ ios: 'arrow-back-ios', default: 'arrow-back' }) as any}
          size={24}
          color={Colors.onSurface}
        />
      </Pressable>
      <Text style={[styles.headerTitle, { color: Colors.onSurface }]}>Ingredient details</Text>
      <Pressable
        onPress={handleEdit}
        accessibilityRole="button"
        style={[styles.headerIconButton, !actionsEnabled && styles.headerIconButtonDisabled]}
        android_ripple={{ color: `${Colors.onSurface}14` }}
        disabled={!actionsEnabled}>
        <MaterialIcons name="edit" size={22} color={Colors.onSurface} />
      </Pressable>
    </View>
  );

  if (!ingredient) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: Colors.background }]}>
        {renderHeader(false)}
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={Colors.tint} />
          <Text style={[styles.loaderText, { color: Colors.onSurfaceVariant }]}>Ingredient not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Colors.background }]}>
      {renderHeader(true)}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: Colors.onSurface }]}>{ingredient.name}</Text>

        <View style={styles.photoSection}>
          <View style={styles.photoWrapper}>
            {ingredient.photoUri ? (
              <Image source={{ uri: ingredient.photoUri }} style={styles.photo} resizeMode="cover" />
            ) : (
              <View style={[styles.photoPlaceholder, { borderColor: Colors.outline }]}>
                <Text style={{ color: Colors.onSurfaceVariant }}>No image</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.iconRow}>
          <Pressable
            onPress={handleToggleShopping}
            style={[styles.iconButton, inShoppingList && styles.iconButtonActive]}
            accessibilityRole="button"
            android_ripple={{ color: `${Colors.onSurface}22` }}>
            <MaterialCommunityIcons
              name={inShoppingList ? 'cart' : 'cart-outline'}
              size={26}
              color={inShoppingList ? Colors.tint : Colors.onSurfaceVariant}
            />
          </Pressable>
          <Pressable
            onPress={handleToggleAvailability}
            style={[styles.iconButton, isAvailable && styles.iconButtonActive]}
            accessibilityRole="button"
            android_ripple={{ color: `${Colors.onSurface}22` }}>
            <MaterialIcons
              name={isAvailable ? 'check-circle' : 'radio-button-unchecked'}
              size={26}
              color={isAvailable ? Colors.tint : Colors.onSurfaceVariant}
            />
          </Pressable>
        </View>

        {ingredient.tags?.length ? (
          <View style={styles.tagRow}>
            {ingredient.tags.map((tag) => (
              <TagPill key={tag.id} label={tag.name} color={tag.color} selected />
            ))}
          </View>
        ) : null}

        {ingredient.description ? (
          <View style={styles.descriptionBlock}>
            <Text style={[styles.sectionTitle, { color: Colors.onSurface }]}>Description</Text>
            <Text style={[styles.description, { color: Colors.onSurface }]}>{displayedDescription}</Text>
            {descriptionNeedsToggle ? (
              <Pressable onPress={handleToggleDescription} accessibilityRole="button">
                <Text style={[styles.link, { color: Colors.tint }]}>
                  {descriptionExpanded ? 'Show less' : 'Show more'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {brandedChildren.length ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: Colors.onSurface }]}>Branded ingredients</Text>
            {brandedChildren.map((child) => (
              <Text key={child.id} style={[styles.sectionItem, { color: Colors.onSurfaceVariant }]}>
                {child.name}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.onSurface }]}>Base ingredient</Text>
          <View style={[styles.baseCard, { backgroundColor: Colors.surfaceVariant, borderColor: Colors.outline }]}>
            {baseIngredient ? (
              <>
                {baseIngredient.photoUri ? (
                  <Image source={{ uri: baseIngredient.photoUri }} style={styles.baseThumbnail} />
                ) : (
                  <View style={[styles.baseThumbnail, styles.basePlaceholder]}>
                    <MaterialIcons
                      name="inventory-2"
                      size={20}
                      color={Colors.onSurfaceVariant}
                    />
                  </View>
                )}
                <Text style={[styles.baseName, { color: Colors.onSurface }]}>{baseIngredient.name}</Text>
              </>
            ) : (
              <Text style={[styles.baseName, { color: Colors.onSurfaceVariant }]}>None</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.onSurface }]}>Used in cocktails</Text>
          {relatedCocktails.length ? (
            relatedCocktails.map((cocktail) => (
              <Text key={cocktail.id} style={[styles.sectionItem, { color: Colors.onSurfaceVariant }]}>
                {cocktail.name}
              </Text>
            ))
          ) : (
            <Text style={[styles.sectionItem, { color: Colors.onSurfaceVariant }]}>No cocktails yet</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconButtonDisabled: {
    opacity: 0.4,
  },
  container: {
    padding: 24,
    paddingBottom: 120,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 12,
  },
  scroll: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconButton: {
    marginHorizontal: 12,
    padding: 8,
    borderRadius: 20,
  },
  iconButtonActive: {
    backgroundColor: `${Colors.tint}22`,
  },
  photoSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  photoWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  photo: {
    width: 150,
    height: 150,
  },
  photoPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  descriptionBlock: {
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  sectionItem: {
    fontSize: 15,
    marginBottom: 8,
  },
  link: {
    fontSize: 15,
    fontWeight: '600',
  },
  baseCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  baseThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  basePlaceholder: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseName: {
    fontSize: 16,
    flexShrink: 1,
    marginLeft: 12,
  },
});
