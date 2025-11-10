import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { memo, useMemo } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { resolveGlasswareUriFromId } from '@/assets/image-manifest';
import { Colors } from '@/constants/theme';
import type { Cocktail } from '@/providers/inventory-provider';
import { palette, tagColors } from '@/theme/theme';

import { TagDot, Thumb } from './RowParts';

type CocktailListRowProps = {
  cocktail: Cocktail;
  availableIngredientIds: Set<number>;
  highlightColor?: string;
  onPress?: () => void;
  control?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

type AvailabilitySummary = {
  missingCount: number;
  missingNames: string[];
  recipeNames: string[];
  isReady: boolean;
};

const REQUIRED_INGREDIENT_FILTER = (item: Cocktail['ingredients'][number]) =>
  !item?.optional && !item?.garnish;

function summariseAvailability(
  cocktail: Cocktail,
  availableIngredientIds: Set<number>,
): AvailabilitySummary {
  const recipe = cocktail.ingredients ?? [];
  const requiredIngredients = recipe.filter(REQUIRED_INGREDIENT_FILTER);

  const recipeNames = recipe
    .map((ingredient) => ingredient.name)
    .filter((name): name is string => Boolean(name))
    .map((name) => name.trim())
    .filter(Boolean);

  if (requiredIngredients.length === 0) {
    return { missingCount: 0, missingNames: [], recipeNames, isReady: false };
  }

  const missingNames: string[] = [];

  requiredIngredients.forEach((ingredient) => {
    const id = typeof ingredient.ingredientId === 'number' ? ingredient.ingredientId : undefined;
    if (id == null) {
      return;
    }

    if (!availableIngredientIds.has(id)) {
      if (ingredient.name) {
        missingNames.push(ingredient.name);
      }
    }
  });

  const missingCount = missingNames.length;
  const isReady = missingCount === 0 && requiredIngredients.length > 0;

  return { missingCount, missingNames, recipeNames, isReady };
}

const MAX_RATING = 5;

const CocktailListRowComponent = ({
  cocktail,
  availableIngredientIds,
  highlightColor = palette.highlightFaint,
  onPress,
  control,
  containerStyle,
}: CocktailListRowProps) => {
  const paletteColors = Colors;
  const glasswareUri = resolveGlasswareUriFromId(cocktail.glassId);

  const { missingCount, missingNames, recipeNames, isReady } = useMemo(
    () => summariseAvailability(cocktail, availableIngredientIds),
    [availableIngredientIds, cocktail],
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

  const backgroundColor = isReady ? highlightColor : paletteColors.surface;
  const borderColor = isReady ? `${paletteColors.tint}66` : `${paletteColors.outline}99`;
  const cardShadowOpacity = isReady ? 0.12 : 0.06;

  const ratingValueRaw = (cocktail as { userRating?: number }).userRating ?? 0;
  const ratingValue = Math.max(0, Math.min(MAX_RATING, Number(ratingValueRaw) || 0));

  const ratingStars = useMemo(() => {
    if (ratingValue <= 0) {
      return null;
    }

    const totalStars = Math.max(0, Math.min(MAX_RATING, Math.round(ratingValue)));

    return (
      <View
        style={[
          styles.ratingOverlay,
          { backgroundColor: `${paletteColors.surfaceVariant}F2`, borderColor: paletteColors.outline },
        ]}>
        {Array.from({ length: totalStars }).map((_, index) => (
          <MaterialCommunityIcons
            key={`rating-icon-${index}`}
            name="star"
            size={12}
            color={paletteColors.tint}
          />
        ))}
      </View>
    );
  }, [paletteColors.outline, paletteColors.surfaceVariant, paletteColors.tint, ratingValue]);

  const tagDots = useMemo(() => {
    const tags = cocktail.tags ?? [];
    if (!tags.length) {
      return null;
    }

    return (
      <View style={styles.tagDotsRow}>
        {tags.map((tag) => (
          <TagDot key={tag.id ?? tag.name} color={tag.color ?? tagColors.default} />
        ))}
      </View>
    );
  }, [cocktail.tags]);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.row,
        { backgroundColor, borderColor, shadowOpacity: cardShadowOpacity },
        containerStyle,
      ]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={styles.thumbSlot}>
        <Thumb label={cocktail.name} uri={cocktail.photoUri} fallbackUri={glasswareUri} />
      </View>
      <View style={styles.textColumn}>
        <Text style={[styles.title, { color: paletteColors.text }]} numberOfLines={1}>
          {cocktail.name}
        </Text>
        <Text style={[styles.subtitle, { color: paletteColors.icon }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.metaColumn}>
        {tagDots}
        {control}
      </View>
      {ratingStars}
    </Pressable>
  );
};

export const CocktailListRow = memo(CocktailListRowComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
    minHeight: 76,
    position: 'relative',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    shadowColor: palette.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  thumbSlot: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
  },
  textColumn: {
    flex: 1,
    gap: 4,
  },
  metaColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    minHeight: 56,
  },
  title: {
    fontSize: 17,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 13,
  },
  tagDotsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  ratingOverlay: {
    position: 'absolute',
    right: 16,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

