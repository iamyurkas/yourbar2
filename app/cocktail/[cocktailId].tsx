import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resolveAssetFromCatalog } from '@/assets/image-manifest';
import { Colors } from '@/constants/theme';
import { useInventory, type Cocktail } from '@/providers/inventory-provider';

type Ingredient = NonNullable<Cocktail['ingredients']>[number];

type UnitDictionary = Record<number, { singular: string; plural?: string }>;

const UNIT_LABELS: UnitDictionary = {
  1: { singular: 'piece', plural: 'pieces' },
  2: { singular: 'bar spoon', plural: 'bar spoons' },
  4: { singular: 'teaspoon', plural: 'teaspoons' },
  6: { singular: 'dash', plural: 'dashes' },
  7: { singular: 'drop', plural: 'drops' },
  8: { singular: 'g' },
  9: { singular: 'pinch', plural: 'pinches' },
  10: { singular: 'leaf', plural: 'leaves' },
  11: { singular: 'ml' },
  12: { singular: 'oz' },
  14: { singular: 'cup', plural: 'cups' },
  15: { singular: 'pinch', plural: 'pinches' },
  17: { singular: 'splash', plural: 'splashes' },
  18: { singular: 'scoop', plural: 'scoops' },
  19: { singular: 'piece', plural: 'pieces' },
  20: { singular: 'bottle', plural: 'bottles' },
  21: { singular: 'sprig', plural: 'sprigs' },
  22: { singular: 'tablespoon', plural: 'tablespoons' },
  24: { singular: 'ml' },
  26: { singular: 'piece', plural: 'pieces' },
  27: { singular: 'piece', plural: 'pieces' },
  31: { singular: 'spray', plural: 'sprays' },
};

function resolveCocktail(
  param: string | undefined,
  cocktails: Cocktail[],
): Cocktail | undefined {
  if (!param) {
    return undefined;
  }

  const numericId = Number(param);
  if (!Number.isNaN(numericId)) {
    const byId = cocktails.find((item) => Number(item.id ?? -1) === numericId);
    if (byId) {
      return byId;
    }
  }

  const normalized = param.toLowerCase();
  return cocktails.find((item) => item.name?.toLowerCase() === normalized);
}

function formatIngredientQuantity(ingredient: Ingredient): string {
  const amountRaw = ingredient.amount ?? '';
  const amount = amountRaw.trim();
  const unitId = typeof ingredient.unitId === 'number' ? ingredient.unitId : undefined;
  const unitDetails = unitId != null ? UNIT_LABELS[unitId] : undefined;
  const parsedAmount = Number(amount);
  const isNumeric = !Number.isNaN(parsedAmount);

  let unitText = '';
  if (unitDetails) {
    const isSingular = !isNumeric || parsedAmount === 1;
    unitText = isSingular ? unitDetails.singular : unitDetails.plural ?? `${unitDetails.singular}s`;
  }

  if (!amount && !unitText) {
    return 'As needed';
  }

  if (!amount && unitText) {
    return unitText;
  }

  if (unitText) {
    return `${amount} ${unitText}`;
  }

  return amount;
}

function getIngredientQualifier(ingredient: Ingredient): string | undefined {
  if (ingredient.optional) {
    return 'optional';
  }

  if (ingredient.garnish) {
    return 'garnish';
  }

  return undefined;
}

export default function CocktailDetailsScreen() {
  const palette = Colors;
  const { cocktailId } = useLocalSearchParams<{ cocktailId?: string }>();
  const { cocktails } = useInventory();

  const resolvedParam = Array.isArray(cocktailId) ? cocktailId[0] : cocktailId;
  const cocktail = useMemo(
    () => resolveCocktail(resolvedParam, cocktails),
    [cocktails, resolvedParam],
  );

  const sortedIngredients = useMemo(() => {
    const recipe = cocktail?.ingredients ?? [];
    return [...recipe].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
  }, [cocktail?.ingredients]);

  const instructionsParagraphs = useMemo(() => {
    const instructions = cocktail?.instructions?.trim();
    if (!instructions) {
      return [] as string[];
    }

    return instructions
      .split(/\n+/)
      .map((segment) => segment.trim())
      .filter(Boolean);
  }, [cocktail?.instructions]);

  const photoSource = useMemo(() => {
    if (!cocktail?.photoUri) {
      return undefined;
    }

    const asset = resolveAssetFromCatalog(cocktail.photoUri);
    if (asset) {
      return asset;
    }

    if (/^https?:/i.test(cocktail.photoUri)) {
      return { uri: cocktail.photoUri } as const;
    }

    return undefined;
  }, [cocktail?.photoUri]);

  const handleEditPress = useCallback(() => {
    // Editing functionality will be implemented later
  }, []);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
      edges={['left', 'right']}>
      <Stack.Screen
        options={{
          title: 'Cocktail details',
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
              accessibilityLabel="Edit cocktail"
              style={[styles.headerButton, { backgroundColor: palette.surfaceVariant }]}
              hitSlop={8}>
              <MaterialCommunityIcons name="pencil-outline" size={20} color={palette.onSurface} />
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {cocktail ? (
          <View style={styles.section}>
            <Text style={[styles.name, { color: palette.onSurface }]}>{cocktail.name}</Text>

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
                  <MaterialCommunityIcons name="image-off" size={36} color={palette.onSurfaceVariant} />
                  <Text style={[styles.photoPlaceholderText, { color: palette.onSurfaceVariant }]}>No photo</Text>
                </View>
              )}
            </View>

            {cocktail.tags && cocktail.tags.length ? (
              <View style={styles.tagList}>
                {cocktail.tags.map((tag) => (
                  <View
                    key={tag.id ?? tag.name}
                    style={[styles.tagChip, { backgroundColor: tag.color ?? palette.surfaceVariant }]}
                  >
                    <Text style={[styles.tagText, { color: palette.onPrimary }]}>{tag.name}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {cocktail.description ? (
              <View style={styles.textBlock}>
                <Text style={[styles.sectionTitle, { color: palette.onSurface }]}>Description</Text>
                <Text style={[styles.bodyText, { color: palette.onSurfaceVariant }]}>{cocktail.description}</Text>
              </View>
            ) : null}

            {instructionsParagraphs.length ? (
              <View style={styles.textBlock}>
                <Text style={[styles.sectionTitle, { color: palette.onSurface }]}>Instructions</Text>
                {instructionsParagraphs.map((paragraph, index) => (
                  <Text
                    key={`instruction-${index}`}
                    style={[styles.bodyText, { color: palette.onSurfaceVariant }]}
                  >
                    {paragraph}
                  </Text>
                ))}
              </View>
            ) : null}

            {sortedIngredients.length ? (
              <View style={styles.textBlock}>
                <Text style={[styles.sectionTitle, { color: palette.onSurface }]}>Ingredients</Text>
                <View style={styles.ingredientsList}>
                  {sortedIngredients.map((ingredient) => {
                    const quantity = formatIngredientQuantity(ingredient);
                    const qualifier = getIngredientQualifier(ingredient);

                    return (
                      <View
                        key={`${ingredient.ingredientId ?? ingredient.name}-${ingredient.order}`}
                        style={[styles.ingredientRow, { borderColor: palette.outline }]}
                      >
                        <Text style={[styles.ingredientAmount, { color: palette.onSurface }]}>{quantity}</Text>
                        <View style={styles.ingredientDetails}>
                          <Text style={[styles.ingredientName, { color: palette.onSurface }]}>{ingredient.name}</Text>
                          {qualifier ? (
                            <Text style={[styles.ingredientQualifier, { color: palette.onSurfaceVariant }]}>
                              {qualifier}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="glass-cocktail" size={42} color={palette.onSurfaceVariant} />
            <Text style={[styles.emptyText, { color: palette.onSurfaceVariant }]}>Cocktail not found</Text>
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
  content: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  section: {
    gap: 24,
  },
  name: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  photoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: 150,
    height: 150,
    borderRadius: 16,
    overflow: 'hidden',
  },
  photoPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoPlaceholderText: {
    fontSize: 14,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  tagChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
  },
  textBlock: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  ingredientsList: {
    gap: 12,
  },
  ingredientRow: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  ingredientAmount: {
    fontSize: 15,
    fontWeight: '600',
    minWidth: 80,
  },
  ingredientDetails: {
    flex: 1,
    gap: 4,
  },
  ingredientName: {
    fontSize: 15,
    fontWeight: '500',
  },
  ingredientQualifier: {
    fontSize: 13,
    textTransform: 'capitalize',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 80,
  },
  emptyText: {
    fontSize: 16,
  },
});
