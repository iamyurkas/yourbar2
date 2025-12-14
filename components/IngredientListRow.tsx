import { MaterialIcons } from '@expo/vector-icons';
import React, { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import { useRouter } from 'expo-router';

import { Colors } from '@/constants/theme';
import { ListRow, PresenceCheck, Thumb } from '@/components/RowParts';
import type { Ingredient } from '@/providers/inventory-provider';
import { palette } from '@/theme/theme';

export type IngredientListRowProps = {
  ingredient: Ingredient;
  highlightColor: string;
  availableIngredientIds: Set<number>;
  onToggleAvailability: (id: number) => void;
  subtitle?: string;
  subtitleStyle?: StyleProp<TextStyle>;
  surfaceVariantColor?: string;
  isOnShoppingList: boolean;
  showAvailabilityToggle?: boolean;
  onShoppingToggle?: (id: number) => void;
};

const areIngredientPropsEqual = (
  prev: Readonly<IngredientListRowProps>,
  next: Readonly<IngredientListRowProps>,
) =>
  prev.ingredient === next.ingredient &&
  prev.highlightColor === next.highlightColor &&
  prev.availableIngredientIds === next.availableIngredientIds &&
  prev.onToggleAvailability === next.onToggleAvailability &&
  prev.subtitle === next.subtitle &&
  prev.subtitleStyle === next.subtitleStyle &&
  prev.surfaceVariantColor === next.surfaceVariantColor &&
  prev.isOnShoppingList === next.isOnShoppingList &&
  prev.showAvailabilityToggle === next.showAvailabilityToggle &&
  prev.onShoppingToggle === next.onShoppingToggle;

const IngredientListRowComponent = ({
  ingredient,
  highlightColor,
  availableIngredientIds,
  onToggleAvailability,
  subtitle,
  subtitleStyle,
  surfaceVariantColor,
  isOnShoppingList,
  showAvailabilityToggle = true,
  onShoppingToggle,
}: IngredientListRowProps) => {
  const router = useRouter();
  const id = Number(ingredient.id ?? -1);
  const isAvailable = id >= 0 && availableIngredientIds.has(id);
  const tagColor = ingredient.tags?.[0]?.color ?? palette.tagYellow;

  const handleToggleAvailability = useCallback(() => {
    if (id >= 0) {
      onToggleAvailability(id);
    }
  }, [id, onToggleAvailability]);

  const handleShoppingToggle = useCallback(() => {
    if (id >= 0 && onShoppingToggle) {
      onShoppingToggle(id);
    }
  }, [id, onShoppingToggle]);

  const composedSubtitleStyle = surfaceVariantColor
    ? [{ color: surfaceVariantColor }, subtitleStyle]
    : subtitleStyle;

  const thumbnail = useMemo(
    () => <Thumb label={ingredient.name} uri={ingredient.photoUri} />,
    [ingredient.name, ingredient.photoUri],
  );

  const brandIndicatorColor = ingredient.baseIngredientId != null ? Colors.primary : undefined;

  const control = useMemo(() => {
    return (
      <View style={styles.presenceSlot}>
        {showAvailabilityToggle ? (
          <PresenceCheck checked={isAvailable} onToggle={handleToggleAvailability} />
        ) : (
          <View style={styles.presencePlaceholder} />
        )}
      </View>
    );
  }, [handleToggleAvailability, isAvailable, showAvailabilityToggle]);

  const shoppingControl = useMemo(() => {
    const shoppingLabel = onShoppingToggle ? 'Remove from shopping list' : 'On shopping list';
    const isShoppingTab = Boolean(onShoppingToggle);
    const shoppingIconName = isShoppingTab ? 'remove-shopping-cart' : 'shopping-cart';
    const shoppingIconColor = isShoppingTab ? Colors.error : Colors.tint;

    if (!isOnShoppingList) {
      return <View style={styles.shoppingIconPlaceholder} />;
    }

    if (onShoppingToggle) {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={shoppingLabel}
          onPress={handleShoppingToggle}
          hitSlop={8}
          style={({ pressed }) => [styles.shoppingButton, pressed ? styles.shoppingButtonPressed : null]}>
          <MaterialIcons
            name={shoppingIconName}
            size={16}
            color={shoppingIconColor}
            style={styles.shoppingIcon}
          />
        </Pressable>
      );
    }

    return (
      <MaterialIcons
        name={shoppingIconName}
        size={16}
        color={shoppingIconColor}
        style={styles.shoppingIcon}
        accessibilityRole="image"
        accessibilityLabel={shoppingLabel}
      />
    );
  }, [handleShoppingToggle, isOnShoppingList, onShoppingToggle]);

  const handlePress = useCallback(() => {
    const routeParam = ingredient.id ?? ingredient.name;
    if (routeParam == null) {
      return;
    }

    router.push({ pathname: '/ingredient/[ingredientId]', params: { ingredientId: String(routeParam) } });
  }, [ingredient.id, ingredient.name, router]);

  return (
    <ListRow
      title={ingredient.name}
      subtitle={subtitle}
      subtitleStyle={composedSubtitleStyle}
      onPress={handlePress}
      selected={isAvailable}
      highlightColor={highlightColor}
      tagColor={tagColor}
      accessibilityRole="button"
      accessibilityState={showAvailabilityToggle && isAvailable ? { selected: true } : undefined}
      thumbnail={thumbnail}
      control={control}
      metaFooter={shoppingControl}
      brandIndicatorColor={brandIndicatorColor}
      metaAlignment="center"
    />
  );
};

export const IngredientListRow = memo(IngredientListRowComponent, areIngredientPropsEqual);

const styles = StyleSheet.create({
  presenceSlot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presencePlaceholder: {
    width: 24,
    height: 24,
  },
  shoppingButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceVariant,
  },
  shoppingButtonPressed: {
    opacity: 0.7,
  },
  shoppingIconPlaceholder: {
    width: 16,
    height: 16,
  },
  shoppingIcon: {
    opacity: 0.9,
  },
});
