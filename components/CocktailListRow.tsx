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
import { Colors, Fonts, Radii, Shadows, Spacing } from '@/constants/theme';
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
    prev.highlightColor === next.highlightColor &&
    onPressEqual &&
    prev.control === next.control &&
    prev.containerStyle === next.containerStyle
  );
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

  const baseBackgroundColor = paletteColors.surface;
  const backgroundColor = isReady ? highlightColor : baseBackgroundColor;
  const borderColor = isReady ? `${paletteColors.tint}66` : `${paletteColors.outline}80`;

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
          { backgroundColor: `${paletteColors.surfaceVariant}F2`, borderColor: paletteColors.outline },
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

  const hasControl = Boolean(control);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor,
          borderColor,
          shadowColor: palette.shadow,
        },
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
        <Text style={[styles.subtitle, { color: paletteColors.onSurfaceMuted }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={[styles.metaColumn, hasControl ? styles.metaColumnWithControl : null]}>
        {tagDots ? <View style={styles.tagSlot}>{tagDots}</View> : null}
        <View style={[styles.metaMiddleSlot, ratingContent ? null : styles.metaMiddleSlotEmpty]}>
          {ratingContent ?? <View style={styles.ratingPlaceholder} />}
        </View>
        {hasControl ? <View style={styles.metaBottomSlot}>{control}</View> : null}
      </View>
    </Pressable>
  );
};

export const CocktailListRow = memo(CocktailListRowComponent, areCocktailRowPropsEqual);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    gap: Spacing.lg,
    minHeight: 76,
    position: 'relative',
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    ...Shadows.level1,
  },
  thumbSlot: {
    width: 56,
    height: 56,
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  textColumn: {
    flex: 1,
    gap: Spacing.xs,
  },
  metaColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    minHeight: 56,
    alignSelf: 'stretch',
  },
  metaColumnWithControl: {
    justifyContent: 'space-between',
  },
  tagSlot: {
    height: 8,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  metaMiddleSlot: {
    flexGrow: 1,
    minHeight: 12,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  metaMiddleSlotEmpty: {
    flexGrow: 0,
  },
  metaBottomSlot: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: Fonts?.sans,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts?.sans,
    color: Colors.onSurfaceMuted,
  },
  tagDotsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: Radii.pill,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ratingPlaceholder: {
    minHeight: 12,
    minWidth: 8,
  },
});

