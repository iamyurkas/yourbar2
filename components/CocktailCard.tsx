import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppColors } from '@/constants/theme';
import { useI18n } from '@/libs/i18n/use-i18n';
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
  const tagNames = useMemo(
    () => (cocktail.tags ?? []).map((tag) => tag?.name).filter(Boolean).slice(0, 2),
    [cocktail.tags],
  );

  return (
    <Pressable
      style={[styles.card, { backgroundColor: Colors.surface, borderColor: Colors.outlineVariant }]}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}>
      <AppImage source={{ uri: cocktail.photoUri ?? undefined }} style={styles.image} contentFit="cover" />
      <View style={styles.content}>
        <Text style={[styles.title, { color: Colors.onSurface }]} numberOfLines={2}>
          {cocktail.name}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: Colors.onSurfaceVariant }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        <Text style={[styles.meta, { color: Colors.onSurfaceVariant }]} numberOfLines={1}>
          {tagNames.join(' • ')}
        </Text>
        <View style={styles.footer}>
          <View style={styles.stateRow}>
            <MaterialCommunityIcons
              name={isReady ? 'check-circle' : 'alert-circle-outline'}
              size={14}
              color={isReady ? Colors.tint : Colors.error}
            />
            <Text style={[styles.stateText, { color: Colors.onSurfaceVariant }]}>
              {isReady ? t('cocktailListRow.allIngredientsReady') : t('common.missing')}
            </Text>
          </View>
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
    minHeight: 300,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 140,
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
  meta: {
    fontSize: 12,
    minHeight: 16,
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
  stateText: {
    fontSize: 11,
  },
});
