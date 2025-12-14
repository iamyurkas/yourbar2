import { MaterialIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Colors } from '@/constants/theme';
import { palette as appPalette } from '@/theme/theme';

import { ListRow, MetaStack, Thumb } from './RowParts';

type IngredientQuantityRowProps = {
  name: string;
  photoUri?: string | null;
  fallbackPhotoUri?: string | null;
  quantity: string;
  qualifier?: string | null;
  onPress?: () => void;
  selected?: boolean;
  highlightColor?: string;
  tagColor?: string;
  isOnShoppingList?: boolean;
};

export function IngredientQuantityRow({
  name,
  photoUri,
  fallbackPhotoUri,
  quantity,
  qualifier,
  onPress,
  selected = false,
  highlightColor,
  tagColor,
  isOnShoppingList = false,
}: IngredientQuantityRowProps) {
  const palette = Colors;
  const resolvedHighlight = highlightColor ?? appPalette.highlightSubtle;

  const subtitle = useMemo(() => {
    if (!qualifier) {
      return undefined;
    }

    const trimmed = qualifier.trim();
    if (!trimmed) {
      return undefined;
    }

    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }, [qualifier]);

  const quantityDisplay = useMemo(
    () => (
      <MetaStack
        gap={6}
        items={[
          {
            minWidth: 88,
            content: (
              <Text style={[styles.quantityLabel, { color: palette.onSurfaceVariant }]} numberOfLines={1}>
                {quantity}
              </Text>
            ),
          },
          {
            minWidth: 24,
            minHeight: 16,
            content: isOnShoppingList ? (
              <MaterialIcons
                name="shopping-cart"
                size={16}
                color={palette.tint}
                style={styles.shoppingIcon}
                accessibilityRole="image"
                accessibilityLabel="On shopping list"
              />
            ) : undefined,
          },
        ]}
      />
    ),
    [isOnShoppingList, palette.onSurfaceVariant, palette.tint, quantity],
  );

  return (
    <ListRow
      title={name}
      subtitle={subtitle}
      subtitleStyle={subtitle ? [styles.subtitle, { color: palette.onSurfaceVariant }] : undefined}
      thumbnail={<Thumb label={name} uri={photoUri} fallbackUri={fallbackPhotoUri} />}
      control={quantityDisplay}
      onPress={onPress}
      selected={selected}
      highlightColor={resolvedHighlight}
      tagColor={tagColor}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={selected ? { selected: true } : undefined}
      metaAlignment="center"
    />
  );
}

const styles = StyleSheet.create({
  quantityLabel: {
    fontSize: 14,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 12,
  },
  shoppingIcon: {
    width: 16,
    height: 16,
    alignSelf: 'flex-end',
  },
});
