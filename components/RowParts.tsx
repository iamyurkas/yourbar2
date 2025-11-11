import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import React, { type ReactNode } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  type AccessibilityState,
  type TextStyle,
} from 'react-native';

import { resolveAssetFromCatalog } from '@/assets/image-manifest';
import { Colors, Fonts, Radii, Shadows, Spacing } from '@/constants/theme';
import { palette, tagColors } from '@/theme/theme';

const THUMB_SIZE = 56;

export type ThumbProps = {
  uri?: string | null;
  label?: string;
  fallbackUri?: string | null;
  fallbackLabel?: string;
};

export function Thumb({ uri, label, fallbackUri, fallbackLabel }: ThumbProps) {
  const paletteColors = Colors;
  const effectiveLabel = label ?? fallbackLabel;
  const trimmed = effectiveLabel?.trim();
  const fallbackText = trimmed ? trimmed.slice(0, 2).toUpperCase() : undefined;

  const assetSource = resolveAssetFromCatalog(uri);
  const resolvedUri = uri && /^https?:/i.test(uri) ? uri : undefined;
  let source: ImageSource | undefined = assetSource ?? (resolvedUri ? { uri: resolvedUri } : undefined);

  if (!source && fallbackUri) {
    const fallbackAsset = resolveAssetFromCatalog(fallbackUri);
    if (fallbackAsset) {
      source = fallbackAsset;
    } else if (/^https?:/i.test(fallbackUri)) {
      source = { uri: fallbackUri };
    }
  }

  return (
    <View style={[styles.thumb, { backgroundColor: palette.surfaceBright }]}>
      {source ? (
        <Image source={source} style={styles.thumbImage} contentFit="contain" />
      ) : fallbackText ? (
        <Text style={[styles.thumbFallback, { color: paletteColors.onSurfaceMuted }]}>{fallbackText}</Text>
      ) : (
        <MaterialCommunityIcons name="image-off" size={24} color={paletteColors.onSurfaceVariant} />
      )}
    </View>
  );
}

type TagDotProps = {
  color?: string;
};

export function TagDot({ color = tagColors.default }: TagDotProps) {
  return <View style={[styles.tagDot, { backgroundColor: color }]} />;
}

type PresenceCheckProps = {
  checked: boolean;
  onToggle?: () => void;
};

export function PresenceCheck({ checked, onToggle }: PresenceCheckProps) {
  const paletteColors = Colors;
  const idleColor = paletteColors.outlineVariant;
  const borderColor = checked ? paletteColors.tint : idleColor;
  const backgroundColor = checked ? paletteColors.tint : 'transparent';
  const iconColor = checked ? paletteColors.background : idleColor;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={[styles.checkbox, { borderColor, backgroundColor }]}
      hitSlop={8}>
      <MaterialCommunityIcons name="check" color={iconColor} size={12} />
    </Pressable>
  );
}

type FavoriteStarProps = {
  active: boolean;
  onToggle?: () => void;
};

export function FavoriteStar({ active, onToggle }: FavoriteStarProps) {
  const paletteColors = Colors;
  const icon = active ? 'star' : 'star-outline';
  const color = active ? paletteColors.secondary : paletteColors.onSurfaceVariant;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={active ? 'Remove from favorites' : 'Add to favorites'}
      onPress={onToggle}
      style={styles.starButton}
      hitSlop={8}>
      <MaterialCommunityIcons name={icon} size={24} color={color} />
    </Pressable>
  );
}

type ListRowProps = {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  selected?: boolean;
  highlightColor?: string;
  tagColor?: string;
  control?: ReactNode;
  thumbnail?: ReactNode;
  accessibilityRole?: 'button' | 'checkbox';
  accessibilityState?: AccessibilityState;
  subtitleStyle?: StyleProp<TextStyle>;
  metaAlignment?: 'flex-start' | 'center' | 'space-between';
  brandIndicatorColor?: string;
};

export function ListRow({
  title,
  subtitle,
  onPress,
  selected,
  highlightColor,
  tagColor,
  control,
  thumbnail,
  accessibilityRole,
  accessibilityState,
  subtitleStyle,
  metaAlignment = 'space-between',
  brandIndicatorColor,
}: ListRowProps) {
  const paletteColors = Colors;
  const baseBackgroundColor = paletteColors.surface;
  const backgroundColor = selected ? highlightColor ?? `${paletteColors.tint}1F` : baseBackgroundColor;
  const inactiveBorderColor = `${paletteColors.outlineVariant}40`;
  const activeBorderColor = `${paletteColors.tint}4D`;
  const borderColor = selected ? activeBorderColor : inactiveBorderColor;
  const metaAlignmentStyle =
    metaAlignment === 'center'
      ? styles.metaContentCenter
      : metaAlignment === 'flex-start'
      ? styles.metaContentStart
      : styles.metaContentSpaceBetween;
  const showBrandIndicator = brandIndicatorColor != null;
  const indicatorColor = brandIndicatorColor ?? paletteColors.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      style={[styles.row, { backgroundColor, borderColor }]}
    >
      {showBrandIndicator ? (
        <View pointerEvents="none" style={[styles.brandIndicator, { backgroundColor: indicatorColor }]} />
      ) : null}
      <View style={styles.thumbSlot}>{thumbnail}</View>
      <View style={styles.textColumn}>
        <Text style={[styles.title, { color: paletteColors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: paletteColors.onSurfaceMuted }, subtitleStyle]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.metaColumn}>
        {tagColor ? (
          <View pointerEvents="none" style={styles.tagDotOverlay}>
            <TagDot color={tagColor} />
          </View>
        ) : null}
        <View style={[styles.metaContent, metaAlignmentStyle]}>
          {control ?? <View style={styles.metaControlPlaceholder} />}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    gap: Spacing.lg,
    minHeight: 76,
    width: '100%',
    position: 'relative',
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    ...Shadows.level1,
  },
  brandIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  thumbSlot: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
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
    minHeight: THUMB_SIZE,
    alignSelf: 'center',
    position: 'relative',
  },
  metaContent: {
    flex: 1,
    minHeight: THUMB_SIZE,
    alignSelf: 'stretch',
    alignItems: 'flex-end',
  },
  metaContentSpaceBetween: {
    justifyContent: 'space-between',
  },
  metaContentCenter: {
    justifyContent: 'center',
  },
  metaContentStart: {
    justifyContent: 'flex-start',
  },
  metaControlPlaceholder: {
    minHeight: THUMB_SIZE,
    alignSelf: 'stretch',
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
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: Radii.xs,
  },
  tagDotOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starButton: {
    padding: 2,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: Radii.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: Radii.md,
  },
  thumbFallback: {
    fontSize: 16,
    fontFamily: Fonts?.sans,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
