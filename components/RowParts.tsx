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
import { useColorScheme } from '@/hooks/use-color-scheme';
import { palette, tagColors } from '@/theme/theme';

const THUMB_SIZE = 56;

export type ThumbProps = {
  uri?: string | null;
  label?: string;
  fallbackUri?: string | null;
  fallbackLabel?: string;
};

export function Thumb({ uri, label, fallbackUri, fallbackLabel }: ThumbProps) {
  const colorScheme = useColorScheme();
  const paletteColors = Colors[colorScheme ?? 'light'];
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
  const colorScheme = useColorScheme();
  const paletteColors = Colors[colorScheme ?? 'light'];
  const borderColor = checked ? paletteColors.tint : paletteColors.outline;
  const backgroundColor = checked ? paletteColors.tint : 'transparent';
  const iconColor = checked ? '#FFFFFF' : 'transparent';

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={[styles.checkbox, { borderColor, backgroundColor }]}
      hitSlop={8}>
      <MaterialCommunityIcons name="check" color={iconColor} size={16} />
    </Pressable>
  );
}

type FavoriteStarProps = {
  active: boolean;
  onToggle?: () => void;
};

export function FavoriteStar({ active, onToggle }: FavoriteStarProps) {
  const colorScheme = useColorScheme();
  const paletteColors = Colors[colorScheme ?? 'light'];
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
}: ListRowProps) {
  const colorScheme = useColorScheme();
  const paletteColors = Colors[colorScheme ?? 'light'];
  const backgroundColor = selected ? highlightColor ?? `${paletteColors.tint}1F` : paletteColors.background;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      style={[styles.row, { backgroundColor }]}>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
    minHeight: 76,
    width: '100%',
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
    justifyContent: 'space-between',
    gap: 12,
    minHeight: THUMB_SIZE,
  },
  title: {
    fontSize: 17,
    fontWeight: '400',
  },
  subtitle: {
    fontSize: 13,
  },
  tagDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
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
    fontSize: 16,
    fontWeight: '600',
  },
});
