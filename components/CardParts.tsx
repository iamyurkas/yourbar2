import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo, useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppColors } from '@/constants/theme';
import { resolveImageSource } from '@/libs/image-source';
import { AppImage } from './AppImage';

export const CARD_WIDTH = 160;
export const CARD_GAP = 12;

export type CardTag = {
  name: string;
  color?: string;
};

type CardFrameProps = {
  isActive: boolean;
  onPress?: () => void;
  children: ReactNode;
};

function CardFrameComponent({ isActive, onPress, children }: CardFrameProps) {
  const Colors = useAppColors();

  return (
    <Pressable
      style={styles.cardShell}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: Colors.surface,
            borderColor: isActive ? Colors.tint : Colors.outlineVariant,
          },
        ]}>
        {children}
      </View>
    </Pressable>
  );
}

export const CardFrame = memo(CardFrameComponent);

type CardImageSlotProps = {
  uri?: string | null;
  fallbackUri?: string | null;
  fallbackIconSize?: number;
  children?: ReactNode;
};

function CardImageSlotComponent({ uri, fallbackUri, fallbackIconSize = 24, children }: CardImageSlotProps) {
  const Colors = useAppColors();
  const imageSource = useMemo(() => resolveImageSource(uri) ?? resolveImageSource(fallbackUri), [uri, fallbackUri]);

  return (
    <View style={[styles.image, { backgroundColor: Colors.surfaceBright }]}>
      {imageSource ? (
        <AppImage source={imageSource} style={styles.image} contentFit="contain" />
      ) : (
        <MaterialCommunityIcons name="image-off-outline" size={fallbackIconSize} color={Colors.onSurfaceVariant} />
      )}
      {children}
    </View>
  );
}

export const CardImageSlot = memo(CardImageSlotComponent);

type CardContentProps = {
  isActive: boolean;
  children: ReactNode;
};

function CardContentComponent({ isActive, children }: CardContentProps) {
  const Colors = useAppColors();
  return <View style={[styles.content, { backgroundColor: isActive ? Colors.highlightFaint : Colors.surface }]}>{children}</View>;
}

export const CardContent = memo(CardContentComponent);

type CardTagChipsProps = {
  tags: CardTag[];
  defaultColor: string;
  maxCount?: number;
  transformLabel?: (name: string) => string;
};

function CardTagChipsComponent({ tags, defaultColor, maxCount, transformLabel }: CardTagChipsProps) {
  const Colors = useAppColors();
  const visibleTags = maxCount != null ? tags.slice(0, maxCount) : tags;

  return (
    <View style={styles.tagRow}>
      {visibleTags.map((tag, index) => (
        <View
          key={`${tag.name}-${index}`}
          style={[
            styles.tagChip,
            {
              backgroundColor: tag.color ?? defaultColor,
            },
          ]}>
          <Text style={[styles.tagText, { color: Colors.onPrimary }]} numberOfLines={1}>
            {transformLabel ? transformLabel(tag.name) : tag.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

export const CardTagChips = memo(CardTagChipsComponent);

type CardCheckProps = {
  checked: boolean;
  onPress?: () => void;
};

function CardCheckComponent({ checked, onPress }: CardCheckProps) {
  const Colors = useAppColors();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      hitSlop={10}
      style={[
        styles.checkbox,
        {
          borderColor: Colors.tint,
          backgroundColor: checked ? Colors.tint : 'transparent',
        },
      ]}>
      <MaterialCommunityIcons name="check" size={12} color={checked ? Colors.background : Colors.tint} />
    </Pressable>
  );
}

export const CardCheck = memo(CardCheckComponent);

export const styles = StyleSheet.create({
  cardShell: {
    width: CARD_WIDTH,
    maxWidth: CARD_WIDTH,
    minHeight: 250,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },
  card: {
    flex: 1,
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
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
