import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppColors } from '@/constants/theme';
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
  const tagNames = useMemo(
    () => (ingredient.tags ?? []).map((tag) => tag?.name).filter(Boolean).slice(0, 3),
    [ingredient.tags],
  );

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: Colors.surface, borderColor: Colors.outlineVariant }]}
      accessibilityRole={onPress ? 'button' : undefined}>
      <AppImage source={{ uri: ingredient.photoUri ?? undefined }} style={styles.image} contentFit="cover" />
      <View style={styles.content}>
        <Text numberOfLines={2} style={[styles.title, { color: Colors.onSurface }]}>
          {ingredient.name}
        </Text>
        <Text numberOfLines={1} style={[styles.tags, { color: Colors.onSurfaceVariant }]}>
          {tagNames.join(' • ')}
        </Text>
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
    minHeight: 250,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 120,
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
  tags: {
    fontSize: 12,
    minHeight: 16,
  },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
  },
});
