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
import { Colors } from '@/constants/theme';
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
        <Text style={[styles.thumbFallback, { color: paletteColors.onSurfaceVariant }]}>{fallbackText}</Text>
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
  metaFooter?: ReactNode;
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
  metaFooter,
  thumbnail,
  accessibilityRole,
  accessibilityState,
  subtitleStyle,
  metaAlignment = 'space-between',
  brandIndicatorColor,
}: ListRowProps) {
  const paletteColors = Colors;
  const backgroundColor = selected ? highlightColor ?? `${paletteColors.tint}1F` : paletteColors.background;
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
      style={[styles.row, { backgroundColor }]}
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
          <Text style={[styles.subtitle, { color: paletteColors.icon }, subtitleStyle]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.metaColumn}>
        <View style={styles.metaContent}>
          <View style={styles.metaTop}>
            {tagColor ? (
              <TagDot color={tagColor} />
            ) : (
              <View style={styles.tagDotPlaceholder} />
            )}
          </View>
          <View style={[styles.metaMiddle, metaAlignmentStyle]}>
            {control ?? <View style={styles.metaControlPlaceholder} />}
          </View>
          <View style={styles.metaFooter}>
            {metaFooter ?? <View style={styles.metaFooterPlaceholder} />}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
    minHeight: 76,
    width: '100%',
    position: 'relative',
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
    borderRadius: 8,
    overflow: 'hidden',
  },
  textColumn: {
    flex: 1,
    gap: 4,
  },
  metaColumn: {
    justifyContent: 'center',
    minHeight: THUMB_SIZE,
    alignSelf: 'center',
  },
  metaContent: {
    height: THUMB_SIZE,
    alignSelf: 'stretch',
    alignItems: 'stretch',
  },
  metaTop: {
    height: 16,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  metaMiddle: {
    flex: 1,
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
    minHeight: 24,
    minWidth: 32,
  },
  metaFooter: {
    minHeight: 16,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  metaFooterPlaceholder: {
    minHeight: 16,
    minWidth: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: '400',
  },
  subtitle: {
    fontSize: 12,
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },
  tagDotPlaceholder: {
    width: 16,
    height: 16,
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
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  thumbFallback: {
    fontSize: 14,
    fontWeight: '600',
  },
});
