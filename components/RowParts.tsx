import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type ImageSource } from 'expo-image';
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

import { AppImage } from './AppImage';
import { Colors } from '@/constants/theme';
import { resolveImageSource } from '@/libs/image-source';
import { useThemedStyles } from '@/libs/use-themed-styles';
import { tagColors } from '@/theme/theme';

const THUMB_SIZE = 56;
const useStyles = () => useThemedStyles(createStyles);

export type ThumbProps = {
  uri?: string | null;
  label?: string;
  fallbackUri?: string | null;
  fallbackLabel?: string;
};

export function Thumb({ uri, label, fallbackUri, fallbackLabel }: ThumbProps) {
  const styles = useStyles();
  const effectiveLabel = label ?? fallbackLabel;
  const trimmed = effectiveLabel?.trim();
  const fallbackText = trimmed ? trimmed.slice(0, 2).toUpperCase() : undefined;

  const primarySource = resolveImageSource(uri);
  let source: ImageSource | undefined = primarySource;

  if (!source && fallbackUri) {
    source = resolveImageSource(fallbackUri);
  }

  return (
    <View style={[styles.thumb, { backgroundColor: Colors.surfaceBright }]}>
      {source ? (
        <AppImage source={source} style={styles.thumbImage} contentFit="contain" />
      ) : fallbackText ? (
        <Text style={[styles.thumbFallback, { color: Colors.onSurfaceVariant }]}>{fallbackText}</Text>
      ) : (
        <MaterialCommunityIcons name="image-off" size={24} color={Colors.onSurfaceVariant} />
      )}
    </View>
  );
}

type TagDotProps = {
  color?: string;
};

export function TagDot({ color = tagColors.default }: TagDotProps) {
  const styles = useStyles();
  return <View style={[styles.tagDot, { backgroundColor: color }]} />;
}

type PresenceCheckProps = {
  checked: boolean;
  onToggle?: () => void;
};

export function PresenceCheck({ checked, onToggle }: PresenceCheckProps) {
  const styles = useStyles();
  const idleColor = Colors.outlineVariant;
  const borderColor = checked ? Colors.tint : idleColor;
  const backgroundColor = checked ? Colors.tint : 'transparent';
  const iconColor = checked ? Colors.background : idleColor;

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
  const styles = useStyles();
  const icon = active ? 'star' : 'star-outline';
  const color = active ? Colors.secondary : Colors.onSurfaceVariant;

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
  subtitleContent?: ReactNode;
  subtitleNumberOfLines?: number;
  onPress?: () => void;
  selected?: boolean;
  highlightColor?: string;
  tagColor?: string;
  tagColors?: string[];
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
  subtitleContent,
  subtitleNumberOfLines,
  onPress,
  selected,
  highlightColor,
  tagColor,
  tagColors,
  control,
  metaFooter,
  thumbnail,
  accessibilityRole,
  accessibilityState,
  subtitleStyle,
  metaAlignment = 'space-between',
  brandIndicatorColor,
}: ListRowProps) {
  const styles = useStyles();
  const backgroundColor = selected ? highlightColor ?? `${Colors.tint}1F` : Colors.background;
  const metaAlignmentStyle =
    metaAlignment === 'center'
      ? styles.metaContentCenter
      : metaAlignment === 'flex-start'
      ? styles.metaContentStart
      : styles.metaContentSpaceBetween;
  const showBrandIndicator = brandIndicatorColor != null;
  const indicatorColor = brandIndicatorColor ?? Colors.primary;
  const resolvedTagColors = tagColors?.filter(Boolean) ?? (tagColor ? [tagColor] : []);

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
        <Text style={[styles.title, { color: Colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitleContent ? (
          subtitleContent
        ) : subtitle ? (
          <Text
            style={[styles.subtitle, { color: Colors.icon }, subtitleStyle]}
            numberOfLines={subtitleNumberOfLines ?? 1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.metaColumn}>
        <View style={styles.metaContent}>
          <View style={styles.metaTop}>
            {resolvedTagColors.length ? (
              <View style={styles.tagDots}>
                {resolvedTagColors.map((color, index) => (
                  <TagDot key={`${color}-${index}`} color={color} />
                ))}
              </View>
            ) : null}
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

const createStyles = () =>
  StyleSheet.create({
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
    backgroundColor: '#FFFFFF',
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
    justifyContent: 'center',
  },
  tagDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
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
