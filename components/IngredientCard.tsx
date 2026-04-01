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
  onPress?: () => void;
};

function IngredientCardComponent({ ingredient, isAvailable, isOnShoppingList, onPress }: IngredientCardProps) {
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
        <View style={styles.tagRow}>
          {tags.map((tag, index) => (
            <View
              key={`${tag.name}-${index}`}
              style={[
                styles.tagChip,
                {
                  backgroundColor: `${tag.color ?? Colors.secondary}22`,
                  borderColor: tag.color ?? Colors.secondary,
                },
              ]}>
              <Text style={[styles.tagText, { color: tag.color ?? Colors.secondary }]} numberOfLines={1}>
                {tag.name}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.footer}>
          {isOnShoppingList ? (
            <MaterialIcons name="shopping-cart" size={16} color={Colors.tint} />
          ) : isAvailable ? (
            <MaterialCommunityIcons name="check-circle" size={16} color={Colors.tint} />
          ) : (
            <MaterialCommunityIcons name="close-circle-outline" size={16} color={Colors.error} />
          )}
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
  tagChip: {
    borderWidth: 1,
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
  },
});
