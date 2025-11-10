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

type StatusConfig = {
  label: string;
  backgroundColor: string;
  textColor: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
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

  const statusConfig = useMemo<StatusConfig>(() => {
    if (isReady) {
      return {
        label: 'Ready',
        backgroundColor: `${paletteColors.secondaryContainer}CC`,
        textColor: paletteColors.onSecondaryContainer,
        icon: 'check-circle',
      };
    }

    if (missingCount > 0) {
      return {
        label: 'Missing ingredients',
        backgroundColor: `${paletteColors.errorContainer}E6`,
        textColor: paletteColors.onErrorContainer,
        icon: 'alert-circle',
      };
    }

    return {
      label: 'Draft',
      backgroundColor: `${paletteColors.surfaceVariant}CC`,
      textColor: paletteColors.onSurfaceVariant,
      icon: 'progress-clock',
    };
  }, [isReady, missingCount, paletteColors.errorContainer, paletteColors.onErrorContainer, paletteColors.onSecondaryContainer, paletteColors.onSurfaceVariant, paletteColors.secondaryContainer, paletteColors.surfaceVariant]);

  const ratingValueRaw = (cocktail as { userRating?: number }).userRating ?? 0;
  const ratingValue = Math.max(0, Math.min(MAX_RATING, Number(ratingValueRaw) || 0));

  const ratingStars = useMemo(() => {
    if (ratingValue <= 0) {
      return null;
    }

    return (
      <View
        style={[
          styles.ratingOverlay,
          {
            backgroundColor: paletteColors.surfaceBright,
            borderColor: `${paletteColors.outline}CC`,
          },
        ]}>
        <MaterialCommunityIcons name="star" size={14} color={paletteColors.secondary} />
        <Text style={[styles.ratingLabel, { color: paletteColors.onSurface }]}>{ratingValue.toFixed(1)}</Text>
      </View>
    );
  }, [paletteColors.onSurface, paletteColors.outline, paletteColors.secondary, paletteColors.surfaceBright, ratingValue]);

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
        <Thumb
          label={cocktail.name}
          uri={cocktail.photoUri}
          fallbackUri={glasswareUri}
          backgroundColor={isReady ? `${paletteColors.secondaryContainer}66` : undefined}
        />
      </View>
      <View style={styles.textColumn}>
        <Text style={[styles.title, { color: paletteColors.text }]} numberOfLines={2}>
          {cocktail.name}
        </Text>
        <Text style={[styles.subtitle, { color: paletteColors.onSurfaceVariant }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.metaColumn}>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.backgroundColor }]}>
          <MaterialCommunityIcons name={statusConfig.icon} size={14} color={statusConfig.textColor} />
          <Text style={[styles.statusLabel, { color: statusConfig.textColor }]} numberOfLines={1}>
            {statusConfig.label}
          </Text>
        </View>
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
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 56,
  },
  title: {
    fontSize: 17,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  tagDotsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  ratingOverlay: {
    position: 'absolute',
    right: 16,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 2,
    shadowColor: palette.shadow,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});

