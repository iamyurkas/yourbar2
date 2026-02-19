import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { resolveGlasswareUriFromId } from '@/assets/image-manifest';
import { METHOD_ICON_MAP, type CocktailMethodId } from '@/constants/cocktail-methods';
import { useAppColors } from '@/constants/theme';
import type { Cocktail, Ingredient } from '@/providers/inventory-provider';
import { createIngredientLookup } from '@/libs/ingredient-availability';

import { ListRow, Thumb } from './RowParts';

type CocktailListRowProps = {
  cocktail: Cocktail;
  ingredients?: Ingredient[];
  highlightColor?: string;
  showMethodIcons?: boolean;
  onPress?: () => void;
  isReady: boolean;
  missingCount: number;
  recipeNamesCount: number;
  ingredientLine: string;
  ratingValue: number;
  hasBrandFallback?: boolean;
  hasStyleFallback?: boolean;
};

const areCocktailRowPropsEqual = (
  prev: Readonly<CocktailListRowProps>,
  next: Readonly<CocktailListRowProps>,
) => {
  const hasOnPress = Boolean(prev.onPress);
  const hasNextOnPress = Boolean(next.onPress);
  const onPressEqual =
    prev.onPress === next.onPress ||
    (!hasOnPress && !hasNextOnPress) ||
    (hasOnPress && hasNextOnPress && prev.cocktail === next.cocktail);

  return (
    prev.cocktail === next.cocktail &&
    prev.ingredients === next.ingredients &&
    prev.highlightColor === next.highlightColor &&
    prev.isReady === next.isReady &&
    prev.missingCount === next.missingCount &&
    prev.recipeNamesCount === next.recipeNamesCount &&
    prev.ingredientLine === next.ingredientLine &&
    prev.ratingValue === next.ratingValue &&
    prev.hasBrandFallback === next.hasBrandFallback &&
    prev.hasStyleFallback === next.hasStyleFallback &&
    onPressEqual
  );
};

const MAX_RATING = 5;
const METHOD_ICON_SIZE = 16;

const CocktailListRowComponent = ({
  cocktail,
  ingredients,
  highlightColor,
  showMethodIcons = false,
  onPress,
  isReady,
  missingCount,
  recipeNamesCount,
  ingredientLine,
  ratingValue,
  hasBrandFallback = false,
  hasStyleFallback = false,
}: CocktailListRowProps) => {
  const Colors = useAppColors();
  const effectiveHighlightColor = highlightColor ?? Colors.highlightFaint;
  const lookup = useMemo(() => {
    return createIngredientLookup(ingredients ?? []);
  }, [ingredients]);
  const glasswareUri = resolveGlasswareUriFromId(cocktail.glassId);

  const subtitle = useMemo(() => {
    if (missingCount === 0 && recipeNamesCount === 0) {
      return 'All ingredients ready';
    }

    return ingredientLine || '\u00A0';
  }, [ingredientLine, missingCount, recipeNamesCount]);

  const normalizedRating = Math.max(0, Math.min(MAX_RATING, Number(ratingValue) || 0));

  const ratingContent = useMemo(() => {
    if (normalizedRating <= 0) {
      return null;
    }

    const totalStars = Math.max(0, Math.min(MAX_RATING, Math.round(normalizedRating)));

    return (
      <View
        style={[
          styles.ratingPill,
          { backgroundColor: Colors.background, borderColor: Colors.outline },
        ]}>
        {Array.from({ length: totalStars }).map((_, index) => (
          <MaterialCommunityIcons
            key={`rating-icon-${index}`}
            name="star"
            size={8}
            color={Colors.tint}
          />
        ))}
      </View>
    );
  }, [
    Colors.background,
    Colors.outline,
    Colors.tint,
    normalizedRating,
  ]);

  const tagColors = useMemo(
    () => (cocktail.tags ?? []).map((tag) => tag?.color).filter(Boolean) as string[],
    [cocktail.tags],
  );

  const methodIds = useMemo(() => {
    const legacyMethodId = (cocktail as { methodId?: CocktailMethodId | null }).methodId ?? null;
    if (cocktail.methodIds && cocktail.methodIds.length > 0) {
      return cocktail.methodIds;
    }

    return legacyMethodId ? [legacyMethodId] : [];
  }, [cocktail.methodIds, cocktail]);

  const methodIconContent = useMemo(() => {
    if (!showMethodIcons) {
      return null;
    }

    const icons = methodIds
      .map((id) => ({ id, icon: METHOD_ICON_MAP[id] }))
      .filter((item) => Boolean(item.icon));
    if (!icons.length) {
      return null;
    }

    return (
      <View style={styles.methodIconRow}>
        {icons.map(({ id, icon }, index) => {
          const isMuddle = id === 'muddle';
          if (icon.type === 'asset') {
            return (
              <Image
                key={`method-icon-${index}`}
                source={icon.source}
                style={[styles.methodIcon, { tintColor: Colors.onSurfaceVariant }]}
                contentFit="contain"
              />
            );
          }

          return (
            <View
              key={`method-icon-${index}`}
              style={styles.methodIconWrapper}>
              <MaterialCommunityIcons
                name={icon.name}
                size={METHOD_ICON_SIZE}
                color={Colors.onSurfaceVariant}
                style={isMuddle ? styles.muddleIcon : undefined}
              />
            </View>
          );
        })}
      </View>
    );
  }, [methodIds, Colors.onSurfaceVariant, showMethodIcons]);

  const { hasBrandedIngredient, hasStyledIngredient } = useMemo(() => {
    const recipe = cocktail.ingredients ?? [];
    if (!recipe.length) {
      return { hasBrandedIngredient: false, hasStyledIngredient: false };
    }

    const normalizeIngredientId = (value?: number | string | null) => {
      if (value == null) {
        return undefined;
      }

      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric < 0) {
        return undefined;
      }

      return Math.trunc(numeric);
    };

    let hasBranded = false;
    let hasStyled = false;

    for (const ingredient of recipe) {
      const candidateIds: number[] = [];
      const ingredientId = normalizeIngredientId(ingredient.ingredientId ?? undefined);
      if (ingredientId != null) {
        candidateIds.push(ingredientId);
      }

      (ingredient.substitutes ?? []).forEach((substitute) => {
        const substituteId = normalizeIngredientId(
          substitute.ingredientId ?? undefined,
        );
        if (substituteId != null) {
          candidateIds.push(substituteId);
        }
      });

      for (const candidateId of candidateIds) {
        const record = lookup.ingredientById.get(candidateId);
        if (record?.baseIngredientId != null) {
          hasBranded = true;
        }

        if (record?.styleIngredientId != null) {
          hasStyled = true;
        }

        if (hasBranded && hasStyled) {
          break;
        }
      }
    }

    return { hasBrandedIngredient: hasBranded, hasStyledIngredient: hasStyled };
  }, [cocktail.ingredients, lookup.ingredientById]);

  const brandIndicatorColor = hasBrandedIngredient ? Colors.primary : hasStyledIngredient ? Colors.styledIngredient : undefined;
  const brandIndicatorBottomColor = hasBrandedIngredient && hasStyledIngredient ? Colors.styledIngredient : undefined;

  const rightIndicatorColor = hasBrandFallback ? Colors.primary : hasStyleFallback ? Colors.styledIngredient : undefined;
  const rightIndicatorBottomColor = hasBrandFallback && hasStyleFallback ? Colors.styledIngredient : undefined;

  const thumbnail = useMemo(
    () => <Thumb label={cocktail.name} uri={cocktail.photoUri} fallbackUri={glasswareUri} />,
    [cocktail.name, cocktail.photoUri, glasswareUri],
  );

  return (
    <ListRow
      title={cocktail.name}
      subtitle={subtitle}
      onPress={onPress}
      selected={isReady}
      highlightColor={effectiveHighlightColor}
      tagColors={tagColors}
      control={ratingContent}
      thumbnail={thumbnail}
      brandIndicatorColor={brandIndicatorColor}
      brandIndicatorBottomColor={brandIndicatorBottomColor}
      rightIndicatorColor={rightIndicatorColor}
      rightIndicatorBottomColor={rightIndicatorBottomColor}
      metaFooter={methodIconContent}
      accessibilityRole={onPress ? 'button' : undefined}
      metaAlignment="center"
    />
  );
};

export const CocktailListRow = memo(CocktailListRowComponent, areCocktailRowPropsEqual);

const styles = StyleSheet.create({
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 2,
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  methodIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
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
});
