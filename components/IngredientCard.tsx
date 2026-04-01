import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppColors } from '@/constants/theme';
import { resolveImageSource } from '@/libs/image-source';
import type { Ingredient } from '@/providers/inventory-provider';
import { AppImage } from './AppImage';
import { CARD_WIDTH } from './CardLayout';

type IngredientCardProps = {
  ingredient: Ingredient;
  isAvailable: boolean;
  isOnShoppingList: boolean;
  subtitle?: string;
  onAvailabilityToggle?: () => void;
  onPress?: () => void;
};

function IngredientCardComponent({
  ingredient,
  isAvailable,
  isOnShoppingList,
  subtitle,
  onAvailabilityToggle,
  onPress,
}: IngredientCardProps) {
  const Colors = useAppColors();
  const imageSource = useMemo(() => resolveImageSource(ingredient.photoUri), [ingredient.photoUri]);
  const tags = useMemo(
    () =>
      (ingredient.tags ?? [])
        .map((tag) => ({ name: tag?.name ?? '', color: tag?.color }))
        .filter((tag) => tag.name.length > 0)
        .slice(0, 3),
    [ingredient.tags],
  );

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: Colors.surface,
          borderColor: isAvailable ? Colors.tint : Colors.outlineVariant,
        },
      ]}
      accessibilityRole={onPress ? 'button' : undefined}>
      <View style={[styles.image, { backgroundColor: Colors.surfaceBright }]}>
        {imageSource ? (
          <AppImage source={imageSource} style={styles.image} contentFit="contain" />
        ) : (
          <MaterialCommunityIcons name="image-off-outline" size={24} color={Colors.onSurfaceVariant} />
        )}
      </View>
      <View style={styles.content}>
        <Text numberOfLines={2} style={[styles.title, { color: Colors.onSurface }]}>
          {ingredient.name}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} style={[styles.subtitle, { color: Colors.onSurfaceVariant }]}>
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
                  backgroundColor: tag.color ?? Colors.secondary,
                },
              ]}>
              <Text style={[styles.tagText, { color: Colors.onPrimary }]} numberOfLines={1}>
                {tag.name}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.footer}>
          {isOnShoppingList ? <MaterialIcons name="shopping-cart" size={16} color={Colors.tint} /> : <View />}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isAvailable }}
            onPress={onAvailabilityToggle}
            hitSlop={10}
            style={[
              styles.checkbox,
              {
                borderColor: isAvailable ? Colors.tint : Colors.outlineVariant,
                backgroundColor: isAvailable ? Colors.tint : 'transparent',
              },
            ]}>
            <MaterialCommunityIcons
              name="check"
              size={12}
              color={isAvailable ? Colors.background : Colors.outlineVariant}
            />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

export const IngredientCard = memo(IngredientCardComponent);

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    maxWidth: CARD_WIDTH,
    minHeight: 250,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
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
    fontSize: 16,
    fontWeight: '700',
  },
  tagRow: {
    minHeight: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subtitle: {
    fontSize: 12,
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
