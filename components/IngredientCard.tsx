import { MaterialIcons } from '@expo/vector-icons';
import { memo, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAppColors } from '@/constants/theme';
import type { Ingredient } from '@/providers/inventory-provider';
import { CardCheck, CardContent, CardFrame, CardImageSlot, CardTagChips, styles as cardStyles } from './CardParts';

type IngredientCardProps = {
  ingredient: Ingredient;
  isAvailable: boolean;
  isOnShoppingList: boolean;
  showRemoveShoppingIcon?: boolean;
  subtitle?: string;
  onAvailabilityToggle?: () => void;
  onShoppingToggle?: () => void;
  onPress?: () => void;
};

function IngredientCardComponent({
  ingredient,
  isAvailable,
  isOnShoppingList,
  showRemoveShoppingIcon = false,
  subtitle,
  onAvailabilityToggle,
  onShoppingToggle,
  onPress,
}: IngredientCardProps) {
  const Colors = useAppColors();
  const tags = useMemo(
    () =>
      (ingredient.tags ?? [])
        .map((tag) => ({ name: tag?.name ?? '', color: tag?.color }))
        .filter((tag) => tag.name.length > 0)
        .slice(0, 3),
    [ingredient.tags],
  );

  return (
    <CardFrame isActive={isAvailable} onPress={onPress}>
      <CardImageSlot uri={ingredient.photoUri} />
      <CardContent isActive={isAvailable}>
        <Text numberOfLines={2} style={[cardStyles.title, { color: Colors.onSurface }]}>
          {ingredient.name}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} style={[cardStyles.subtitle, { color: Colors.onSurfaceVariant }]}>
            {subtitle}
          </Text>
        ) : null}
        <CardTagChips tags={tags} defaultColor={Colors.secondary} />
        <View style={cardStyles.footer}>
          {isOnShoppingList ? (
            onShoppingToggle ? (
              <Pressable onPress={onShoppingToggle} hitSlop={10}>
                <MaterialIcons
                  name={showRemoveShoppingIcon ? 'remove-shopping-cart' : 'shopping-cart'}
                  size={16}
                  color={showRemoveShoppingIcon ? Colors.error : Colors.tint}
                />
              </Pressable>
            ) : (
              <MaterialIcons
                name={showRemoveShoppingIcon ? 'remove-shopping-cart' : 'shopping-cart'}
                size={16}
                color={showRemoveShoppingIcon ? Colors.error : Colors.tint}
              />
            )
          ) : <View />}
          <CardCheck checked={isAvailable} onPress={onAvailabilityToggle} />
        </View>
      </CardContent>
    </CardFrame>
  );
}

export const IngredientCard = memo(IngredientCardComponent);
