import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { resolveGlasswareUriFromId } from '@/assets/image-manifest';
import { Colors } from '@/constants/theme';
import type { Cocktail, Ingredient } from '@/providers/inventory-provider';
import { createIngredientLookup, type IngredientLookup } from '@/libs/ingredient-availability';
import { summariseCocktailAvailability } from '@/libs/cocktail-availability';
import { palette } from '@/theme/theme';

import { ListRow, Thumb } from './RowParts';

type CocktailListRowProps = {
  cocktail: Cocktail;
  availableIngredientIds: Set<number>;
  ingredients?: Ingredient[];
  ingredientLookup?: IngredientLookup;
  highlightColor?: string;
  ignoreGarnish?: boolean;
  onPress?: () => void;
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
    prev.availableIngredientIds === next.availableIngredientIds &&
    prev.ingredientLookup === next.ingredientLookup &&
    prev.ingredients === next.ingredients &&
    prev.ignoreGarnish === next.ignoreGarnish &&
    prev.highlightColor === next.highlightColor &&
    onPressEqual
  );
};

const MAX_RATING = 5;

const CocktailListRowComponent = ({
  cocktail,
  availableIngredientIds,
  ingredients,
  ingredientLookup,
  highlightColor = palette.highlightFaint,
  ignoreGarnish = true,
  onPress,
}: CocktailListRowProps) => {
  const paletteColors = Colors;
  const lookup = useMemo(() => {
    if (ingredientLookup) {
      return ingredientLookup;
    }

    return createIngredientLookup(ingredients ?? []);
  }, [ingredientLookup, ingredients]);
  const glasswareUri = resolveGlasswareUriFromId(cocktail.glassId);

  const { missingCount, missingNames, recipeNames, isReady } = useMemo(
    () =>
      summariseCocktailAvailability(cocktail, availableIngredientIds, lookup, undefined, {
        ignoreGarnish,
      }),
    [availableIngredientIds, cocktail, ignoreGarnish, lookup],
  );

  const subtitle = useMemo(() => {
    if (missingCount === 0) {
      if (recipeNames.length === 0) {
        return 'All ingredients ready';
      }

      return recipeNames.join(', ');
    }

    if (missingCount >= 3) {
      return `Missing ${missingCount} ingredients`;
    }

    if (missingNames.length) {
      return `Missing: ${missingNames.join(', ')}`;
    }

    return 'Missing ingredients';
  }, [missingCount, missingNames, recipeNames]);

  const ratingValueRaw = (cocktail as { userRating?: number }).userRating ?? 0;
  const ratingValue = Math.max(0, Math.min(MAX_RATING, Number(ratingValueRaw) || 0));

  const ratingContent = useMemo(() => {
    if (ratingValue <= 0) {
      return null;
    }

    const totalStars = Math.max(0, Math.min(MAX_RATING, Math.round(ratingValue)));

    return (
      <View
        style={[
          styles.ratingPill,
          { backgroundColor: paletteColors.background, borderColor: paletteColors.outline },
        ]}>
        {Array.from({ length: totalStars }).map((_, index) => (
          <MaterialCommunityIcons
            key={`rating-icon-${index}`}
            name="star"
            size={8}
            color={paletteColors.tint}
          />
        ))}
      </View>
    );
  }, [
    paletteColors.background,
    paletteColors.outline,
    paletteColors.tint,
    ratingValue,
  ]);

  const tagColor = cocktail.tags?.[0]?.color ?? undefined;

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
      highlightColor={highlightColor}
      tagColor={tagColor}
      control={ratingContent}
      thumbnail={thumbnail}
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
});

