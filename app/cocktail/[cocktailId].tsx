import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  resolveAssetFromCatalog,
  resolveGlasswareUriFromId,
} from '@/assets/image-manifest';
import { IngredientQuantityRow } from '@/components/IngredientQuantityRow';
import { Colors } from '@/constants/theme';
import {
  useInventory,
  type Cocktail,
  type Ingredient as InventoryIngredient,
} from '@/providers/inventory-provider';
import { palette as appPalette } from '@/theme/theme';

type RecipeIngredient = NonNullable<Cocktail['ingredients']>[number];

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

const GLASS_LABELS: Record<string, string> = {
  bowl: 'Punch bowl',
  champagne_flute: 'Champagne flute',
  cocktail_glass: 'Cocktail glass',
  collins_glass: 'Collins glass',
  copper_mug: 'Copper mug',
  coupe: 'Coupe glass',
  cup: 'Cup',
  goblet: 'Goblet',
  highball_glass: 'Highball glass',
  hurricane_glass: 'Hurricane glass',
  irish_coffee_glass: 'Irish coffee glass',
  margarita_glass: 'Margarita glass',
  nick_and_nora: 'Nick & Nora glass',
  pitcher: 'Pitcher',
  pub_glass: 'Pub glass',
  rocks_glass: 'Rocks glass',
  shooter: 'Shooter glass',
  snifter: 'Snifter',
  tiki: 'Tiki mug',
  wine_glass: 'Wine glass',
};

const MAX_RATING = 5;

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

function formatIngredientQuantity(ingredient: RecipeIngredient): string {
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

function getIngredientQualifier(ingredient: RecipeIngredient): string | undefined {
  if (ingredient.optional) {
    return 'optional';
  }

  if (ingredient.garnish) {
    return 'garnish';
  }

  return undefined;
}

function formatGlassLabel(glassId?: string | null) {
  if (!glassId) {
    return undefined;
  }

  return (
    GLASS_LABELS[glassId] ??
    glassId
      .split(/[_\s]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );
}

export default function CocktailDetailsScreen() {
  const palette = Colors;
  const { cocktailId } = useLocalSearchParams<{ cocktailId?: string }>();
  const { cocktails, ingredients, availableIngredientIds, setCocktailRating, getCocktailRating } =
    useInventory();

  const resolvedParam = Array.isArray(cocktailId) ? cocktailId[0] : cocktailId;
  const cocktail = useMemo(
    () => resolveCocktail(resolvedParam, cocktails),
    [cocktails, resolvedParam],
  );

  const ingredientCatalog = useMemo(() => {
    const catalog = new Map<number, InventoryIngredient>();
    ingredients.forEach((item) => {
      const idValue = Number(item.id ?? -1);
      if (!Number.isNaN(idValue) && idValue >= 0) {
        catalog.set(idValue, item);
      }
    });
    return catalog;
  }, [ingredients]);

  const sortedIngredients = useMemo(() => {
    const recipe = cocktail?.ingredients ?? [];
    return [...recipe].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
  }, [cocktail?.ingredients]);

  const userRating = useMemo(() => {
    if (!cocktail) {
      return 0;
    }

    return getCocktailRating(cocktail);
  }, [cocktail, getCocktailRating]);

  const [optimisticRating, setOptimisticRating] = useState<number | null>(null);
  const [, startRatingTransition] = useTransition();
  const displayedRating = optimisticRating ?? userRating;

  useEffect(() => {
    setOptimisticRating((previous) => {
      if (previous == null) {
        return previous;
      }

      return previous === userRating ? null : previous;
    });
  }, [userRating]);

  const handleRatingSelect = useCallback(
    (value: number) => {
      if (!cocktail) {
        return;
      }

      const nextRating = displayedRating === value ? 0 : value;
      setOptimisticRating(nextRating);

      startRatingTransition(() => {
        setCocktailRating(cocktail, nextRating);
      });
    },
    [cocktail, displayedRating, setCocktailRating, startRatingTransition],
  );

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

  const ingredientHighlightColor = appPalette.highlightSubtle;

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

  const glassUri = useMemo(() => resolveGlasswareUriFromId(cocktail?.glassId), [cocktail?.glassId]);

  const glassSource = useMemo(() => {
    if (!glassUri) {
      return undefined;
    }

    const asset = resolveAssetFromCatalog(glassUri);
    if (asset) {
      return asset;
    }

    if (/^https?:/i.test(glassUri)) {
      return { uri: glassUri } as const;
    }

    return undefined;
  }, [glassUri]);

  const displayedImageSource = photoSource ?? glassSource;
  const glassLabel = useMemo(() => formatGlassLabel(cocktail?.glassId), [cocktail?.glassId]);

  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [shouldTruncateDescription, setShouldTruncateDescription] = useState(false);

  const handleDescriptionLayout = useCallback(
    (event: { nativeEvent: { lines: { length: number }[] } }) => {
      if (shouldTruncateDescription) {
        return;
      }

      if (event.nativeEvent.lines.length > 5) {
        setShouldTruncateDescription(true);
      }
    },
    [shouldTruncateDescription],
  );

  const toggleDescription = useCallback(() => {
    setIsDescriptionExpanded((current) => !current);
  }, []);

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

            <View style={styles.mediaSection}>
              <View style={styles.photoWrapper}>
                {displayedImageSource ? (
                  <Image
                    source={displayedImageSource}
                    style={styles.photo}
                    contentFit="contain"
                  />
                ) : (
                  <View
                    style={[
                      styles.photoPlaceholder,
                      { borderColor: palette.outline },
                    ]}>
                    <MaterialCommunityIcons name="image-off" size={36} color={palette.onSurfaceVariant} />
                    <Text style={[styles.photoPlaceholderText, { color: palette.onSurfaceVariant }]}>No photo</Text>
                  </View>
                )}
              </View>

              <View style={styles.ratingRow}>
                {Array.from({ length: MAX_RATING }).map((_, index) => {
                  const starValue = index + 1;
                  const isActive = displayedRating >= starValue;
                  const icon = isActive ? 'star' : 'star-outline';

                  return (
                    <Pressable
                      key={`rating-star-${starValue}`}
                      onPress={() => handleRatingSelect(starValue)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        displayedRating === starValue
                          ? 'Clear rating'
                          : `Set rating to ${starValue}`
                      }
                      style={styles.ratingStar}
                      hitSlop={8}>
                      <MaterialCommunityIcons name={icon} size={32} color={palette.tint} />
                    </Pressable>
                  );
                })}
              </View>

              {photoSource && glassSource && glassLabel ? (
                <View style={styles.glassInfo}>
                  <View style={styles.glassImageWrapper}>
                    <Image source={glassSource} style={styles.glassImage} contentFit="contain" />
                  </View>
                  <Text style={[styles.glassLabel, { color: palette.onSurface }]}>{glassLabel}</Text>
                </View>
              ) : null}
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
                <Text
                  style={[styles.bodyText, styles.descriptionText, { color: palette.onSurfaceVariant }]}
                  numberOfLines={!isDescriptionExpanded && shouldTruncateDescription ? 5 : undefined}
                  onTextLayout={handleDescriptionLayout}
                >
                  {cocktail.description}
                </Text>
                {shouldTruncateDescription ? (
                  <Pressable onPress={toggleDescription} accessibilityRole="button">
                    <Text style={[styles.toggleDescription, { color: palette.tint }]}>
                      {isDescriptionExpanded ? 'Show less' : 'Show more'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {instructionsParagraphs.length ? (
              <View style={styles.textBlock}>
                <Text style={[styles.instructionsTitle, { color: palette.onSurface }]}>Instructions</Text>
                <View style={styles.instructionsList}>
                  {instructionsParagraphs.map((paragraph, index) => (
                    <Text
                      key={`instruction-${index}`}
                      style={[styles.instructionsText, { color: palette.onSurface }]}
                    >
                      {paragraph}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}

            {sortedIngredients.length ? (
              <View style={styles.textBlock}>
                <Text style={[styles.sectionTitle, { color: palette.onSurface }]}>Ingredients</Text>
                <View style={styles.ingredientsList}>
                  {sortedIngredients.map((ingredient, index) => {
                    const quantity = formatIngredientQuantity(ingredient);
                    const qualifier = getIngredientQualifier(ingredient);
                    const key = `${ingredient.ingredientId ?? ingredient.name}-${ingredient.order}`;
                    const ingredientIdRaw = ingredient.ingredientId;
                    let ingredientId = -1;
                    if (typeof ingredientIdRaw === 'number') {
                      ingredientId = ingredientIdRaw;
                    } else if (typeof ingredientIdRaw === 'string') {
                      const parsed = Number(ingredientIdRaw);
                      if (!Number.isNaN(parsed)) {
                        ingredientId = parsed;
                      }
                    }
                    const catalogEntry = ingredientId >= 0 ? ingredientCatalog.get(ingredientId) : undefined;
                    const photoUri = ingredient.photoUri ?? catalogEntry?.photoUri;
                    const isAvailable = ingredientId >= 0 && availableIngredientIds.has(ingredientId);
                    const handlePress = () => {
                      const routeParam =
                        ingredientId >= 0
                          ? ingredientId
                          : catalogEntry?.id ?? ingredient.name;
                      if (routeParam == null) {
                        return;
                      }

                      router.push({
                        pathname: '/ingredient/[ingredientId]',
                        params: { ingredientId: String(routeParam) },
                      });
                    };

                    return (
                      <View key={key}>
                        {index > 0 ? (
                          <View style={[styles.ingredientDivider, { backgroundColor: palette.outline }]} />
                        ) : null}
                        <IngredientQuantityRow
                          name={ingredient.name ?? ''}
                          photoUri={photoUri}
                          fallbackPhotoUri={catalogEntry?.photoUri}
                          quantity={quantity}
                          qualifier={qualifier}
                          onPress={handlePress}
                          selected={isAvailable}
                          highlightColor={ingredientHighlightColor}
                        />
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
  mediaSection: {
    gap: 16,
    alignItems: 'center',
  },
  photoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  photo: {
    width: 150,
    height: 150,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  photoPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  photoPlaceholderText: {
    fontSize: 14,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  ratingStar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'flex-start',
  },
  glassImageWrapper: {
    width: 48,
    height: 48,
  },
  glassImage: {
    width: '100%',
    height: '100%',
  },
  glassLabel: {
    fontSize: 16,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 8,
    alignSelf: 'stretch',
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
  descriptionText: {
    color: '#6F6F6F',
  },
  toggleDescription: {
    fontSize: 15,
    fontWeight: '500',
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  instructionsText: {
    fontSize: 15,
    lineHeight: 22,
  },
  instructionsList: {
    gap: 8,
  },
  ingredientsList: {
    marginHorizontal: -24,
  },
  ingredientDivider: {
    height: StyleSheet.hairlineWidth,
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
