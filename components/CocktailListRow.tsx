import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { resolveGlasswareUriFromId } from '@/assets/image-manifest';
import { METHOD_ICON_MAP, type CocktailMethodId } from '@/constants/cocktail-methods';
import { useAppColors } from '@/constants/theme';
import type { Cocktail, Ingredient } from '@/providers/inventory-provider';
import { createIngredientLookup } from '@/libs/ingredient-availability';
import { useI18n } from '@/libs/i18n/use-i18n';

import { ListRow, PresenceCheck, Thumb } from './RowParts';

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
  hasComment?: boolean;
  hasBrandFallback?: boolean;
  hasStyleFallback?: boolean;
  isPartySelected?: boolean;
  showPartySelectionControl?: boolean;
  onPartySelectionToggle?: () => void;
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
    prev.hasComment === next.hasComment &&
    prev.hasBrandFallback === next.hasBrandFallback &&
    prev.hasStyleFallback === next.hasStyleFallback &&
    prev.isPartySelected === next.isPartySelected &&
    onPressEqual
  );
};

const MAX_RATING = 5;
const METHOD_ICON_SIZE = 16;
const TAG_DOT_SIZE = 8;

type VideoService = 'youtube' | 'instagram' | 'tiktok' | 'generic';

function resolveVideoService(link?: string | null): VideoService | null {
  const value = link?.trim();
  if (!value) {
    return null;
  }

  try {
    const withProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(value) ? value : `https://${value}`;
    const { hostname } = new URL(withProtocol);
    const domain = hostname.toLowerCase().replace(/^www\./, '');

    if (domain.includes('youtu.be') || domain.includes('youtube.com')) {
      return 'youtube';
    }
    if (domain.includes('instagram.com')) {
      return 'instagram';
    }
    if (domain.includes('tiktok.com')) {
      return 'tiktok';
    }
    return 'generic';
  } catch {
    return 'generic';
  }
}

function resolveVideoServiceIcon(service: VideoService): 'youtube' | 'instagram' | 'music-note' | 'video-outline' {
  switch (service) {
    case 'youtube':
      return 'youtube';
    case 'instagram':
      return 'instagram';
    case 'tiktok':
      return 'music-note';
    default:
      return 'video-outline';
  }
}

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
  hasComment = false,
  hasBrandFallback = false,
  hasStyleFallback = false,
  isPartySelected = false,
  showPartySelectionControl = false,
  onPartySelectionToggle,
}: CocktailListRowProps) => {
  const Colors = useAppColors();
  const { t } = useI18n();
  const effectiveHighlightColor = highlightColor ?? Colors.highlightFaint;
  const lookup = useMemo(() => {
    return createIngredientLookup(ingredients ?? []);
  }, [ingredients]);
  const glasswareUri = resolveGlasswareUriFromId(cocktail.glassId);

  const subtitle = useMemo(() => {
    if (missingCount === 0 && recipeNamesCount === 0) {
      return t("cocktailListRow.allIngredientsReady");
    }

    return ingredientLine || '\u00A0';
  }, [ingredientLine, missingCount, recipeNamesCount, t]);

  const normalizedRating = Math.max(0, Math.min(MAX_RATING, Number(ratingValue) || 0));

  const ratingContent = useMemo(() => {
    if (normalizedRating <= 0 && !showPartySelectionControl) {
      return null;
    }

    const totalStars = Math.max(0, Math.min(MAX_RATING, Math.round(normalizedRating)));
    const pillStyle = [
      styles.metaPill,
      { backgroundColor: Colors.background, borderColor: Colors.outline },
    ];

    return (
      <View style={styles.metaControlRow}>
        {totalStars > 0 ? (
          <View style={pillStyle}>
            {Array.from({ length: totalStars }).map((_, index) => (
              <MaterialCommunityIcons
                key={`rating-icon-${index}`}
                name="star"
                size={8}
                color={Colors.tint}
              />
            ))}
          </View>
        ) : showPartySelectionControl ? (
          <View style={styles.metaPillPlaceholder} />
        ) : null}
        {showPartySelectionControl && onPartySelectionToggle ? (
          <PresenceCheck checked={isPartySelected} onToggle={onPartySelectionToggle} />
        ) : isPartySelected ? (
          <MaterialCommunityIcons
            name="party-popper"
            size={12}
            color={Colors.styledIngredient}
            accessibilityRole="image"
            accessibilityLabel={t('common.tabParty')}
          />
        ) : null}
      </View>
    );
  }, [
    Colors.background,
    Colors.outline,
    Colors.tint,
    normalizedRating,
    Colors.styledIngredient,
    isPartySelected,
    showPartySelectionControl,
    onPartySelectionToggle,
    t,
  ]);

  const tagColors = useMemo(
    () => (cocktail.tags ?? []).map((tag) => tag?.color).filter(Boolean) as string[],
    [cocktail.tags],
  );

  const methodIds = useMemo<CocktailMethodId[]>(() => {
    const legacyMethodId = (cocktail as { methodId?: CocktailMethodId | null }).methodId ?? null;
    const isMethodId = (value: string): value is CocktailMethodId =>
      Object.prototype.hasOwnProperty.call(METHOD_ICON_MAP, value);

    if (cocktail.methodIds && cocktail.methodIds.length > 0) {
      return cocktail.methodIds.filter(isMethodId);
    }

    return legacyMethodId && isMethodId(legacyMethodId) ? [legacyMethodId] : [];
  }, [cocktail]);

  const videoService = useMemo(
    () => resolveVideoService(cocktail.video),
    [cocktail.video],
  );

  const metaTopLeading = useMemo(() => {
    if (!hasComment) {
      return null;
    }

    return (
      <MaterialCommunityIcons
        name="comment"
        size={TAG_DOT_SIZE}
        color={Colors.onSurfaceVariant}
      />
    );
  }, [Colors.onSurfaceVariant, hasComment]);

  const methodIconContent = useMemo(() => {
    if (!showMethodIcons) {
      return null;
    }

    const icons = methodIds
      .map((id) => ({ id, icon: METHOD_ICON_MAP[id] }))
      .filter((item) => Boolean(item.icon));
    if (!icons.length && !videoService) {
      return null;
    }

    return (
      <View style={styles.methodIconRow}>
        {videoService ? (
          <MaterialCommunityIcons
            name={resolveVideoServiceIcon(videoService)}
            size={METHOD_ICON_SIZE}
            color={Colors.onSurfaceVariant}
          />
        ) : null}
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
  }, [methodIds, Colors.onSurfaceVariant, showMethodIcons, videoService]);

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
      metaTopLeading={metaTopLeading}
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
  metaControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 2,
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metaPillPlaceholder: {
    width: 8,
    height: 8,
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
