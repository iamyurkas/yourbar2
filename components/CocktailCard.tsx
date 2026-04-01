import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppColors } from '@/constants/theme';
import { useI18n } from '@/libs/i18n/use-i18n';
import { resolveImageSource } from '@/libs/image-source';
import type { Cocktail } from '@/providers/inventory-provider';
import { AppImage } from './AppImage';
import { CARD_WIDTH } from './CardLayout';

type CocktailCardProps = {
  cocktail: Cocktail;
  subtitle?: string;
  isReady: boolean;
  ratingValue?: number;
  isPartySelected?: boolean;
  onPress?: () => void;
};

function CocktailCardComponent({
  cocktail,
  subtitle,
  isReady,
  ratingValue = 0,
  isPartySelected = false,
  onPress,
}: CocktailCardProps) {
  const Colors = useAppColors();
  const { t } = useI18n();
  const stars = Math.max(0, Math.min(5, Math.round(ratingValue)));
  const imageSource = useMemo(() => resolveImageSource(cocktail.photoUri), [cocktail.photoUri]);
  const tags = useMemo(
    () =>
      (cocktail.tags ?? [])
        .map((tag) => ({ name: tag?.name ?? '', color: tag?.color }))
        .filter((tag) => tag.name.length > 0)
        .slice(0, 3),
    [cocktail.tags],
  );

  return (
    <Pressable
      style={[
        styles.card,
        {
          backgroundColor: Colors.surface,
          borderColor: isReady ? Colors.tint : Colors.outlineVariant,
        },
      ]}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}>
      <View style={[styles.image, { backgroundColor: Colors.surfaceBright }]}>
        {imageSource ? (
          <AppImage source={imageSource} style={styles.image} contentFit="contain" />
        ) : (
          <MaterialCommunityIcons name="image-off-outline" size={28} color={Colors.onSurfaceVariant} />
        )}
      </View>
      <View
        style={[
          styles.content,
          {
            backgroundColor: isReady ? Colors.highlightFaint : Colors.surface,
          },
        ]}>
        <Text style={[styles.title, { color: Colors.onSurface }]} numberOfLines={2}>
          {cocktail.name}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: Colors.onSurfaceVariant }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        <View style={styles.tagRow}>
          {tags.map((tag, index) => (
            <View
              key={`${tag.name}-${index}`}
              style={[
                styles.tagChip,
                {
                  backgroundColor: tag.color ?? Colors.primary,
                },
              ]}>
              <Text style={[styles.tagText, { color: Colors.onPrimary }]} numberOfLines={1}>
                {tag.name}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.footer}>
          <View style={styles.stateRow}>
            {stars > 0 ? (
              Array.from({ length: stars }).map((_, index) => (
                <MaterialCommunityIcons key={index} name="star" size={12} color={Colors.tint} />
              ))
            ) : null}
            {isPartySelected ? (
              <MaterialCommunityIcons
                name="party-popper"
                size={14}
                color={Colors.secondary}
                accessibilityLabel={t('common.tabParty')}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export const CocktailCard = memo(CocktailCardComponent);

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    maxWidth: CARD_WIDTH,
    minHeight: 300,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 12,
    gap: 6,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
  },
  tagRow: {
    minHeight: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    maxWidth: '100%',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
