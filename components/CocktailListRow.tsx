import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { resolveGlasswareUriFromId } from '@/assets/image-manifest';
import { METHOD_ICON_MAP } from '@/constants/cocktail-method-icons';
import type { CocktailMethodId } from '@/constants/cocktail-methods';
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
  allowAllSubstitutes?: boolean;
  showMethodIcons?: boolean;
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
    prev.allowAllSubstitutes === next.allowAllSubstitutes &&
    prev.highlightColor === next.highlightColor &&
    onPressEqual
  );
};

const MAX_RATING = 5;
const METHOD_ICON_SIZE = 16;

const CocktailListRowComponent = ({
  cocktail,
  availableIngredientIds,
  ingredients,
  ingredientLookup,
  highlightColor = palette.highlightFaint,
  ignoreGarnish = true,
  allowAllSubstitutes = false,
  showMethodIcons = false,
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

  const { missingCount, recipeNames, isReady, ingredientLine } = useMemo(
    () =>
      summariseCocktailAvailability(cocktail, availableIngredientIds, lookup, undefined, {
        ignoreGarnish,
        allowAllSubstitutes,
      }),
    [availableIngredientIds, cocktail, allowAllSubstitutes, ignoreGarnish, lookup],
  );

  const subtitle = useMemo(() => {
    if (missingCount === 0 && recipeNames.length === 0) {
      return 'All ingredients ready';
    }

    return ingredientLine || '\u00A0';
  }, [ingredientLine, missingCount, recipeNames.length]);

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

    const icons = methodIds.map((id) => METHOD_ICON_MAP[id]).filter(Boolean);
    if (!icons.length) {
      return null;
    }

    return (
      <View style={styles.methodIconRow}>
        {icons.map((icon, index) =>
          icon.type === 'asset' ? (
            <Image
              key={`method-icon-${index}`}
              source={icon.source}
              style={[styles.methodIcon, { tintColor: paletteColors.onSurfaceVariant }]}
              contentFit="contain"
            />
          ) : (
            <MaterialCommunityIcons
              key={`method-icon-${index}`}
              name={icon.name}
              size={METHOD_ICON_SIZE}
              color={paletteColors.onSurfaceVariant}
            />
          ),
        )}
      </View>
    );
  }, [methodIds, paletteColors.onSurfaceVariant, showMethodIcons]);

  const hasBrandedIngredient = useMemo(() => {
    const recipe = cocktail.ingredients ?? [];
    if (!recipe.length) {
      return false;
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

    for (const ingredient of recipe) {
      const candidateIds: number[] = [];
      const ingredientId = normalizeIngredientId(ingredient.ingredientId ?? undefined);
      if (ingredientId != null) {
        candidateIds.push(ingredientId);
      }

      (ingredient.substitutes ?? []).forEach((substitute) => {
        const substituteId = normalizeIngredientId(
          substitute.ingredientId ?? substitute.id ?? undefined,
        );
        if (substituteId != null) {
          candidateIds.push(substituteId);
        }
      });

      for (const candidateId of candidateIds) {
        const record = lookup.ingredientById.get(candidateId);
        if (record?.baseIngredientId != null) {
          return true;
        }
      }
    }

    return false;
  }, [cocktail.ingredients, lookup.ingredientById]);

  const brandIndicatorColor = hasBrandedIngredient ? paletteColors.primary : undefined;

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
      tagColors={tagColors}
      control={ratingContent}
      thumbnail={thumbnail}
      brandIndicatorColor={brandIndicatorColor}
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
});
