import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { resolveGlasswareUriFromId } from '@/assets/image-manifest';
import { METHOD_ICON_MAP, type CocktailMethodId } from '@/constants/cocktail-methods';
import { useAppColors } from '@/constants/theme';
import type { Cocktail } from '@/providers/inventory-provider';

import { ListRow, Thumb } from './RowParts';

type CocktailListRowProps = {
  cocktail: Cocktail;
  isReady: boolean;
  subtitle: string;
  hasBrandedIngredient: boolean;
  rating?: number;
  highlightColor?: string;
  showMethodIcons?: boolean;
  onPress?: (cocktail: Cocktail) => void;
};

const areCocktailRowPropsEqual = (
  prev: Readonly<CocktailListRowProps>,
  next: Readonly<CocktailListRowProps>,
) => {
  return (
    prev.cocktail === next.cocktail &&
    prev.isReady === next.isReady &&
    prev.subtitle === next.subtitle &&
    prev.hasBrandedIngredient === next.hasBrandedIngredient &&
    prev.rating === next.rating &&
    prev.highlightColor === next.highlightColor &&
    prev.showMethodIcons === next.showMethodIcons &&
    prev.onPress === next.onPress
  );
};

const MAX_RATING = 5;
const METHOD_ICON_SIZE = 16;

const CocktailListRowComponent = ({
  cocktail,
  isReady,
  subtitle,
  hasBrandedIngredient,
  rating = 0,
  highlightColor,
  showMethodIcons = false,
  onPress,
}: CocktailListRowProps) => {
  const Colors = useAppColors();
  const effectiveHighlightColor = highlightColor ?? Colors.highlightFaint;
  const glasswareUri = resolveGlasswareUriFromId(cocktail.glassId);

  const ratingValue = Math.max(0, Math.min(MAX_RATING, Number(rating) || 0));

  const ratingContent = useMemo(() => {
    if (ratingValue <= 0) {
      return null;
    }

    const totalStars = Math.max(0, Math.min(MAX_RATING, Math.round(ratingValue)));

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


  const brandIndicatorColor = hasBrandedIngredient ? Colors.primary : undefined;

  const thumbnail = useMemo(
    () => <Thumb label={cocktail.name} uri={cocktail.photoUri} fallbackUri={glasswareUri} />,
    [cocktail.name, cocktail.photoUri, glasswareUri],
  );

  const handlePress = useCallback(() => {
    onPress?.(cocktail);
  }, [onPress, cocktail]);

  return (
    <ListRow
      title={cocktail.name}
      subtitle={subtitle}
      onPress={handlePress}
      selected={isReady}
      highlightColor={effectiveHighlightColor}
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
