import { MaterialIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
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

  if (!ingredient) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator color={Colors.tint} />
        <Text style={[styles.loaderText, { color: Colors.onSurfaceVariant }]}>Ingredient not found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: ingredient.name,
          headerLeft: () => (
            <Pressable onPress={handleBack} accessibilityRole="button" style={styles.headerIconButton}>
              <MaterialIcons
                name={Platform.select({ ios: 'arrow-back-ios', default: 'arrow-back' }) as any}
                size={24}
                color={Colors.onSurface}
              />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={handleEdit} accessibilityRole="button" style={styles.headerIconButton}>
              <MaterialIcons name="edit" size={22} color={Colors.onSurface} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: Colors.onSurface }]}>{ingredient.name}</Text>
          <View style={styles.iconRow}>
            <Pressable
              onPress={handleToggleShopping}
              style={styles.iconButton}
              accessibilityRole="button"
              android_ripple={{ color: `${Colors.onSurface}22` }}>
              <MaterialIcons
                name={inShoppingList ? 'add-shopping-cart' : 'shopping-cart'}
                size={22}
                color={inShoppingList ? Colors.tint : Colors.onSurface}
              />
            </Pressable>
            <Pressable
              onPress={handleToggleAvailability}
              style={styles.iconButton}
              accessibilityRole="button"
              android_ripple={{ color: `${Colors.onSurface}22` }}>
              <MaterialIcons
                name={isAvailable ? 'check-circle' : 'radio-button-unchecked'}
                size={22}
                color={isAvailable ? Colors.tint : Colors.onSurface}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.photoWrapper}>
          {ingredient.photoUri ? (
            <Image source={{ uri: ingredient.photoUri }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={[styles.photoPlaceholder, { borderColor: Colors.outline }]}>
              <Text style={{ color: Colors.onSurfaceVariant }}>No image</Text>
            </View>
          )}
        </View>

        {ingredient.tags?.length ? (
          <View style={styles.tagRow}>
            {ingredient.tags.map((tag) => (
              <TagPill key={tag.id} label={tag.name} color={tag.color} selected />
            ))}
          </View>
        ) : null}

        {ingredient.description ? (
          <Text style={[styles.description, { color: Colors.onSurface }]}>{ingredient.description}</Text>
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

        {baseIngredient ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: Colors.onSurface }]}>Base ingredient</Text>
            <Text style={[styles.sectionItem, { color: Colors.onSurfaceVariant }]}>{baseIngredient.name}</Text>
          </View>
        ) : null}

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
    </>
  );
}

const styles = StyleSheet.create({
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
  },
  iconRow: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 12,
    padding: 6,
    borderRadius: 18,
  },
  headerIconButton: {
    padding: 6,
    marginLeft: 12,
  },
  photoWrapper: {
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  photo: {
    width: 150,
    height: 150,
    borderRadius: 12,
  },
  photoPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 24,
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
});
