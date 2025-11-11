import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
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

  const backgroundColor = isReady ? highlightColor : paletteColors.background;

  const ratingValueRaw = (cocktail as { userRating?: number }).userRating ?? 0;
  const ratingValue = Math.max(0, Math.min(MAX_RATING, Number(ratingValueRaw) || 0));

  const ratingStars = useMemo(() => {
    if (ratingValue <= 0) {
      return null;
    }

    const totalStars = Math.max(0, Math.min(MAX_RATING, Math.round(ratingValue)));

    return (
      <View style={styles.ratingRow}>
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
  }, [paletteColors.tint, ratingValue]);

  const shoppingStatus = useMemo(() => {
    const color = isReady ? paletteColors.tint : paletteColors.onSurfaceVariant;
    const label = isReady ? 'All ingredients ready' : 'Missing ingredients';

    return (
      <MaterialIcons
        name="shopping-cart"
        size={16}
        color={color}
        accessibilityRole="image"
        accessibilityLabel={label}
      />
    );
  }, [isReady, paletteColors.onSurfaceVariant, paletteColors.tint]);

  const statusContent = useMemo(() => {
    return (
      <>
        <View style={styles.shoppingStatusSlot}>{shoppingStatus}</View>
        <View style={styles.ratingSlot}>{ratingStars ?? <View style={styles.ratingPlaceholder} />}</View>
      </>
    );
  }, [ratingStars, shoppingStatus]);

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
      style={[styles.row, { backgroundColor }, containerStyle]}
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
        <View style={styles.tagDotsSlot}>{tagDots ?? <View style={styles.tagDotsPlaceholder} />}</View>
        <View style={styles.metaBody}>{control ?? <View style={styles.controlPlaceholder} />}</View>
        <View style={styles.statusSlot}>{statusContent}</View>
      </View>
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
    minHeight: 56,
    alignItems: 'flex-end',
    width: 56,
    paddingVertical: 4,
    alignSelf: 'stretch',
    gap: 4,
  },
  tagDotsSlot: {
    height: 16,
    width: '100%',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  tagDotsPlaceholder: {
    width: 8,
    height: 8,
  },
  metaBody: {
    flex: 1,
    width: '100%',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  controlPlaceholder: {
    width: 24,
    height: 24,
  },
  statusSlot: {
    minHeight: 28,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    gap: 4,
  },
  shoppingStatusSlot: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingPlaceholder: {
    width: 8,
    height: 8,
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
});

