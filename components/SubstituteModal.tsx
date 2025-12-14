import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ListRow, Thumb } from '@/components/RowParts';
import { Colors } from '@/constants/theme';
import { useInventory, type Cocktail, type Ingredient } from '@/providers/inventory-provider';
import { palette } from '@/theme/theme';

const MIN_AUTOCOMPLETE_LENGTH = 2;
const MAX_SUGGESTIONS = 8;

function filterIngredientsByQuery(options: Ingredient[], query: string) {
  if (!query) {
    return options;
  }

  return options.filter((candidate) => {
    const nameNormalized = candidate.searchNameNormalized ?? candidate.name?.toLowerCase() ?? '';
    if (nameNormalized.includes(query)) {
      return true;
    }

    return (candidate.searchTokensNormalized ?? []).some((token) => token.includes(query));
  });
}

type SubstituteModalProps = {
  visible: boolean;
  ingredientName?: string;
  excludedIngredientId?: number;
  onClose: () => void;
  onSelect: (ingredient: Ingredient) => void;
};

export function SubstituteModal({
  visible,
  ingredientName,
  excludedIngredientId,
  onClose,
  onSelect,
}: SubstituteModalProps) {
  const paletteColors = Colors;
  const { ingredients, availableIngredientIds, shoppingIngredientIds, cocktails } = useInventory();
  const [searchValue, setSearchValue] = useState('');
  const inputRef = useRef<TextInput | null>(null);

  const ingredientById = useMemo(() => {
    const map = new Map<number, Ingredient>();
    ingredients.forEach((item) => {
      const id = Number(item.id ?? -1);
      if (Number.isFinite(id) && id >= 0) {
        map.set(id, item);
      }
    });
    return map;
  }, [ingredients]);

  const getBaseGroupId = useCallback(
    (rawId: number | string | null | undefined) => {
      if (rawId == null) {
        return undefined;
      }

      const id = Number(rawId);
      if (!Number.isFinite(id) || id < 0) {
        return undefined;
      }

      const ingredientRecord = ingredientById.get(id);
      if (ingredientRecord?.baseIngredientId != null) {
        const baseId = Number(ingredientRecord.baseIngredientId);
        if (Number.isFinite(baseId) && baseId >= 0) {
          return baseId;
        }
      }

      if (ingredientRecord?.id != null) {
        const normalizedId = Number(ingredientRecord.id);
        if (Number.isFinite(normalizedId) && normalizedId >= 0) {
          return normalizedId;
        }
      }

      return id;
    },
    [ingredientById],
  );

  const cocktailsByBaseGroup = useMemo(() => {
    const map = new Map<number, Set<string>>();

    cocktails.forEach((cocktail: Cocktail) => {
      const id = cocktail.id;
      const cocktailKey = id != null ? String(id) : cocktail.name?.trim().toLowerCase();
      if (!cocktailKey) {
        return;
      }

      const seenBaseIds = new Set<number>();
      (cocktail.ingredients ?? []).forEach((item) => {
        const baseGroupId = getBaseGroupId(item.ingredientId);
        if (baseGroupId == null || seenBaseIds.has(baseGroupId)) {
          return;
        }

        seenBaseIds.add(baseGroupId);
        let set = map.get(baseGroupId);
        if (!set) {
          set = new Set<string>();
          map.set(baseGroupId, set);
        }

        set.add(cocktailKey);
      });
    });

    return map;
  }, [cocktails, getBaseGroupId]);

  const excludedBaseGroupId = useMemo(
    () => (excludedIngredientId != null ? getBaseGroupId(excludedIngredientId) : undefined),
    [excludedIngredientId, getBaseGroupId],
  );

  const candidateIngredients = useMemo(() => {
    const normalized = searchValue.trim().toLowerCase();
    const filtered = normalized.length >= MIN_AUTOCOMPLETE_LENGTH
      ? filterIngredientsByQuery(ingredients, normalized)
      : ingredients;

    return filtered
      .filter((item) => {
        const baseGroupId = getBaseGroupId(item.id);
        if (excludedBaseGroupId != null && baseGroupId === excludedBaseGroupId) {
          return false;
        }

        return Boolean(item.name?.trim());
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [excludedBaseGroupId, getBaseGroupId, ingredients, searchValue]);

  const handleFocusInput = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (visible) {
      handleFocusInput();
    } else {
      setSearchValue('');
    }
  }, [handleFocusInput, visible]);

  const renderSubtitle = useCallback(
    (baseGroupId: number | undefined) => {
      if (baseGroupId == null) {
        return undefined;
      }

      const count = cocktailsByBaseGroup.get(baseGroupId)?.size ?? 0;
      if (count <= 0) {
        return undefined;
      }

      const label = count === 1 ? 'recipe' : 'recipes';
      return `${count} ${label}`;
    },
    [cocktailsByBaseGroup],
  );

  const keyExtractor = useCallback((item: Ingredient) => String(item.id ?? item.name), []);

  const renderCandidate = useCallback(
    ({ item }: { item: Ingredient }) => {
      const candidateId = Number(item.id ?? -1);
      const baseGroupId = getBaseGroupId(item.id);
      const isAvailable = candidateId >= 0 && availableIngredientIds.has(candidateId);
      const isOnShoppingList = candidateId >= 0 && shoppingIngredientIds.has(candidateId);
      const tagColor = item.tags?.[0]?.color ?? palette.tagYellow;
      const subtitle = renderSubtitle(baseGroupId);
      const brandIndicatorColor = item.baseIngredientId != null ? Colors.primary : undefined;

      return (
        <ListRow
          title={item.name ?? ''}
          subtitle={subtitle}
          onPress={() => onSelect(item)}
          selected={isAvailable}
          highlightColor={palette.highlightSubtle}
          tagColor={tagColor}
          thumbnail={<Thumb label={item.name ?? undefined} uri={item.photoUri} />}
          brandIndicatorColor={brandIndicatorColor}
          control={null}
          metaFooter={
            isOnShoppingList ? (
              <MaterialIcons
                name="shopping-cart"
                size={16}
                color={Colors.tint}
                style={styles.shoppingIcon}
                accessibilityRole="image"
                accessibilityLabel="On shopping list"
              />
            ) : (
              <View style={styles.shoppingIconPlaceholder} />
            )
          }
          metaAlignment="center"
        />
      );
    },
    [
      availableIngredientIds,
      getBaseGroupId,
      onSelect,
      renderSubtitle,
      shoppingIngredientIds,
    ],
  );

  const renderSeparator = useCallback(
    () => <View style={[styles.modalSeparator, { backgroundColor: paletteColors.outline }]} />,
    [paletteColors.outline],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: paletteColors.surface }]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.modalTitle, { color: paletteColors.onSurface }]}>Add substitute</Text>
              {ingredientName ? (
                <Text style={[styles.modalSubtitle, { color: paletteColors.onSurfaceVariant }]}>For {ingredientName}</Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close">
              <MaterialCommunityIcons name="close" size={22} color={paletteColors.onSurfaceVariant} />
            </Pressable>
          </View>
          <TextInput
            ref={inputRef}
            value={searchValue}
            onChangeText={setSearchValue}
            placeholder="Search ingredients"
            placeholderTextColor={`${paletteColors.onSurfaceVariant}99`}
            style={[styles.input, { borderColor: paletteColors.outlineVariant, color: paletteColors.text }]}
            autoFocus
          />
          <FlatList
            data={candidateIngredients}
            keyExtractor={keyExtractor}
            renderItem={renderCandidate}
            ItemSeparatorComponent={renderSeparator}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalListContent}
            ListEmptyComponent={
              <Text style={[styles.modalEmptyText, { color: paletteColors.onSurfaceVariant }]}>No ingredients found</Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: Colors.backdrop,
  },
  modalCard: {
    width: '100%',
    maxHeight: '92%',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  modalListContent: {
    paddingVertical: 8,
  },
  modalEmptyText: {
    textAlign: 'center',
    paddingVertical: 24,
  },
  input: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  shoppingIcon: {
    marginTop: 4,
  },
  shoppingIconPlaceholder: {
    minHeight: 16,
    minWidth: 16,
    marginTop: 4,
  },
  modalSeparator: {
    height: StyleSheet.hairlineWidth,
  },
});
