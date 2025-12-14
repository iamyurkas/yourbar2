import { MaterialIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { palette as appPalette } from '@/theme/theme';

import { ListRow, Thumb } from './RowParts';

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
      <View style={styles.metaContainer}>
        <View style={styles.shoppingSlot}>
          {isOnShoppingList ? (
            <MaterialIcons
              name="shopping-cart"
              size={16}
              color={palette.tint}
              style={styles.shoppingIcon}
              accessibilityRole="image"
              accessibilityLabel="On shopping list"
            />
          ) : (
            <View style={styles.shoppingIconPlaceholder} />
          )}
        </View>
        <View style={styles.quantityContainer}>
          <Text style={[styles.quantityLabel, { color: palette.onSurfaceVariant }]} numberOfLines={1}>
            {quantity}
          </Text>
        </View>
      </View>
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
  metaContainer: {
    alignItems: 'flex-end',
    gap: 6,
  },
  quantityContainer: {
    minWidth: 88,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  quantityLabel: {
    fontSize: 14,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 12,
  },
  shoppingSlot: {
    height: 16,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    width: 24,
  },
  shoppingIcon: {
    width: 16,
    height: 16,
    alignSelf: 'flex-end',
  },
  shoppingIconPlaceholder: {
    width: 16,
    height: 16,
    alignSelf: 'flex-end',
  },
});
