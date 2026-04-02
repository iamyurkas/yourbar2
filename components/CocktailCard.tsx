import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { resolveGlasswareUriFromId } from '@/assets/image-manifest';
import { METHOD_ICON_MAP, type CocktailMethodId } from '@/constants/cocktail-methods';
import { useAppColors } from '@/constants/theme';
import { resolveImageSource } from '@/libs/image-source';
import type { Cocktail } from '@/providers/inventory-provider';
import { Image } from 'expo-image';
import { AppImage } from './AppImage';
import { CARD_WIDTH } from './CardLayout';
import { PresenceCheck } from './RowParts';

type CocktailCardProps = {
  cocktail: Cocktail;
  subtitle?: string;
  subtitleNumberOfLines?: number;
  isReady: boolean;
  ratingValue?: number;
  isPartySelected?: boolean;
  showPartySelectionControl?: boolean;
  onPartySelectionToggle?: () => void;
  onPress?: () => void;
};

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
    if (domain.includes('youtu.be') || domain.includes('youtube.com')) return 'youtube';
    if (domain.includes('instagram.com')) return 'instagram';
    if (domain.includes('tiktok.com')) return 'tiktok';
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

function CocktailCardComponent({
  cocktail,
  subtitle,
  subtitleNumberOfLines = 2,
  isReady,
  ratingValue = 0,
  isPartySelected = false,
  showPartySelectionControl = false,
  onPartySelectionToggle,
  onPress,
}: CocktailCardProps) {
  const Colors = useAppColors();
  const stars = Math.max(0, Math.min(5, Math.round(ratingValue)));
  const glasswareUri = useMemo(() => resolveGlasswareUriFromId(cocktail.glassId), [cocktail.glassId]);
  const imageSource = useMemo(
    () => resolveImageSource(cocktail.photoUri) ?? resolveImageSource(glasswareUri),
    [cocktail.photoUri, glasswareUri],
  );
  const videoService = useMemo(() => resolveVideoService(cocktail.video), [cocktail.video]);
  const methodIds = useMemo<CocktailMethodId[]>(() => {
    const legacyMethodId = (cocktail as { methodId?: CocktailMethodId | null }).methodId ?? null;
    const isMethodId = (value: string): value is CocktailMethodId =>
      Object.prototype.hasOwnProperty.call(METHOD_ICON_MAP, value);
    if (cocktail.methodIds && cocktail.methodIds.length > 0) {
      return cocktail.methodIds.filter(isMethodId);
    }
    return legacyMethodId && isMethodId(legacyMethodId) ? [legacyMethodId] : [];
  }, [cocktail]);
  const tags = useMemo(
    () =>
      (cocktail.tags ?? [])
        .map((tag) => ({ name: tag?.name ?? '', color: tag?.color }))
        .filter((tag) => tag.name.length > 0),
    [cocktail.tags],
  );
  const hasManyTags = (cocktail.tags?.length ?? 0) >= 4;

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
        {methodIds.length > 0 ? (
          <View style={styles.overlayMethodRow}>
            {methodIds.map((id, index) => {
              const icon = METHOD_ICON_MAP[id];
              if (!icon) {
                return null;
              }
              if (icon.type === 'asset') {
                return (
                  <Image
                    key={`overlay-method-asset-${index}`}
                    source={icon.source}
                    style={[styles.methodAsset, { tintColor: Colors.primary }]}
                    contentFit="contain"
                  />
                );
              }
              return (
                <MaterialCommunityIcons
                  key={`overlay-method-icon-${index}`}
                  name={icon.name}
                  size={14}
                  color={Colors.primary}
                />
              );
            })}
          </View>
        ) : null}
        {videoService ? (
          <View style={[styles.overlayBadge, styles.overlayRight]}>
            <MaterialCommunityIcons
              name={resolveVideoServiceIcon(videoService)}
              size={14}
              color={Colors.tertiary}
            />
          </View>
        ) : null}
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
          <Text
            style={[styles.subtitle, { color: Colors.onSurfaceVariant }]}
            numberOfLines={subtitleNumberOfLines}>
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
                {hasManyTags ? tag.name.slice(0, 1).toUpperCase() : tag.name}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.footer}>
          <View style={styles.stateRow}>
            {stars > 0 ? (
              <View style={[styles.ratingPill, { backgroundColor: Colors.background, borderColor: Colors.outline }]}>
                {Array.from({ length: stars }).map((_, index) => (
                  <MaterialCommunityIcons key={index} name="star" size={10} color={Colors.tint} />
                ))}
              </View>
            ) : null}
          </View>
          <View style={styles.methodRow}>
            {showPartySelectionControl && onPartySelectionToggle ? (
              <PresenceCheck checked={isPartySelected} onToggle={onPartySelectionToggle} />
            ) : isPartySelected ? (
              <MaterialCommunityIcons
                name="party-popper"
                size={14}
                color={Colors.secondary}
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
    minHeight: 250,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayBadge: {
    position: 'absolute',
    top: 6,
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayRight: {
    right: 6,
  },
  overlayMethodRow: {
    position: 'absolute',
    left: 6,
    top: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  content: {
    padding: 12,
    gap: 6,
    flex: 1,
  },
  title: {
    fontSize: 14,
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
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  methodAsset: {
    width: 14,
    height: 14,
  },
});
