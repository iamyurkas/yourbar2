import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

import { ListRow, Thumb } from './RowParts';

type IngredientQuantityRowProps = {
  name: string;
  photoUri?: string | null;
  quantity: string;
  qualifier?: string | null;
};

export function IngredientQuantityRow({
  name,
  photoUri,
  quantity,
  qualifier,
}: IngredientQuantityRowProps) {
  const palette = Colors;

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
      <View style={styles.quantityContainer}>
        <Text style={[styles.quantityLabel, { color: palette.onSurface }]} numberOfLines={1}>
          {quantity}
        </Text>
      </View>
    ),
    [palette.onSurface, quantity],
  );

  return (
    <ListRow
      title={name}
      subtitle={subtitle}
      subtitleStyle={subtitle ? [styles.subtitle, { color: palette.onSurfaceVariant }] : undefined}
      thumbnail={<Thumb label={name} uri={photoUri} />}
      control={quantityDisplay}
    />
  );
}

const styles = StyleSheet.create({
  quantityContainer: {
    minWidth: 88,
    alignItems: 'flex-end',
  },
  quantityLabel: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 13,
  },
});
