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

const THUMB_SIZE = 50;

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
    <View style={[styles.thumb, { backgroundColor: palette.surface }]}>
      {source ? (
        <Image source={source} style={styles.thumbImage} contentFit="cover" />
      ) : fallbackText ? (
        <Text style={[styles.thumbFallback, { color: paletteColors.onSurfaceVariant }]}>{fallbackText}</Text>
      ) : (
        <MaterialCommunityIcons name="image-off" size={22} color={paletteColors.onSurfaceVariant} />
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
  const borderColor = checked ? paletteColors.tint : `${paletteColors.outline}AA`;
  const backgroundColor = checked ? `${paletteColors.tint}22` : palette.surfaceBright;
  const iconColor = checked ? paletteColors.tint : paletteColors.onSurfaceVariant;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      android_ripple={{ color: `${palette.tertiary}59`, borderless: true }}
      style={({ pressed }) => [styles.checkbox, { borderColor, backgroundColor }, pressed && styles.metaPressed]}
      hitSlop={8}>
      <MaterialCommunityIcons
        name={checked ? 'check-circle' : 'checkbox-blank-circle-outline'}
        color={iconColor}
        size={18}
      />
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
      android_ripple={{ color: `${palette.tertiary}59`, borderless: true }}
      style={({ pressed }) => [styles.starButton, pressed && styles.metaPressed]}
      hitSlop={8}>
      <MaterialCommunityIcons name={icon} size={22} color={color} />
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
}: ListRowProps) {
  const paletteColors = Colors;
  const surfaceColor = palette.surface;
  const highlight = selected ? highlightColor ?? `${paletteColors.tint}1F` : surfaceColor;
  const stripeColor = tagColor ?? (selected ? paletteColors.tint : `${paletteColors.outline}55`);
  const metaAlignmentStyle =
    metaAlignment === 'center'
      ? styles.metaColumnCenter
      : metaAlignment === 'flex-start'
      ? styles.metaColumnStart
      : styles.metaColumnSpaceBetween;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      android_ripple={{ color: `${palette.tertiary}59` }}
      style={({ pressed }) => [styles.row, { backgroundColor: highlight }, pressed && styles.rowPressed]}>
      <View style={[styles.brandStripe, { backgroundColor: stripeColor }]} />
      <View style={styles.thumbSlot}>{thumbnail}</View>
      <View style={styles.textColumn}>
        <Text style={[styles.title, { color: paletteColors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: paletteColors.onSurfaceVariant }, subtitleStyle]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.metaColumn, metaAlignmentStyle]}>
        {tagColor ? <TagDot color={tagColor} /> : null}
        {control}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
    minHeight: 74,
    width: '100%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.outline}55`,
    backgroundColor: palette.surface,
    shadowColor: palette.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
    overflow: 'hidden',
  },
  rowPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
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
    alignItems: 'center',
    gap: 10,
    minHeight: THUMB_SIZE,
  },
  metaColumnSpaceBetween: {
    justifyContent: 'space-between',
  },
  metaColumnCenter: {
    justifyContent: 'center',
  },
  metaColumnStart: {
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 13,
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starButton: {
    padding: 4,
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
    fontSize: 16,
    fontWeight: '600',
  },
  brandStripe: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 4,
    marginRight: 8,
  },
  metaPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },
});
