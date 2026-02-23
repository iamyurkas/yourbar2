import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  InteractionManager,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ListRow, Thumb } from '@/components/RowParts';
import { useAppColors } from '@/constants/theme';
import { normalizeSearchText } from '@/libs/search-normalization';
import { useI18n } from '@/libs/i18n/use-i18n';
import { useInventory, type Cocktail, type Ingredient } from '@/providers/inventory-provider';
import { tagColors } from '@/theme/theme';

const MIN_AUTOCOMPLETE_LENGTH = 2;
const MAX_SUGGESTIONS = 8;

function filterIngredientsByQuery(options: Ingredient[], query: string) {
  if (!query) {
    return options;
  }

  return options.filter((candidate) => {
    const nameNormalized = candidate.searchNameNormalized ?? normalizeSearchText(candidate.name ?? '');
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
  selectedSubstituteIds?: Set<number>;
  selectedSubstituteNames?: Set<string>;
};

export function SubstituteModal({
  visible,
  ingredientName,
  excludedIngredientId,
  onClose,
  onSelect,
  selectedSubstituteIds,
  selectedSubstituteNames,
}: SubstituteModalProps) {
  const { ingredients, availableIngredientIds, shoppingIngredientIds, cocktails } = useInventory();
  const Colors = useAppColors();
  const { t } = useI18n();
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
      const cocktailKey = id != null ? String(id) : normalizeSearchText(cocktail.name ?? '');
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

  const styleBaseIngredientIds = useMemo(() => {
    return new Set(
      ingredients
        .filter((item) => Number(item.styleIngredientId ?? -1) >= 0)
        .map((item) => Number(item.styleIngredientId)),
    );
  }, [ingredients]);

  const brandedBaseIngredientIds = useMemo(() => {
    return new Set(
      ingredients
        .filter((item) => Number(item.baseIngredientId ?? -1) >= 0)
        .map((item) => Number(item.baseIngredientId)),
    );
  }, [ingredients]);

  const excludedIngredientNumericId = useMemo(() => {
    if (excludedIngredientId == null) {
      return undefined;
    }

    const id = Number(excludedIngredientId);
    if (!Number.isFinite(id) || id < 0) {
      return undefined;
    }

    return Math.trunc(id);
  }, [excludedIngredientId]);

  const excludedBaseIngredientId = useMemo(() => {
    if (excludedIngredientNumericId == null) {
      return undefined;
    }

    const ingredientRecord = ingredientById.get(excludedIngredientNumericId);
    const baseId = ingredientRecord?.baseIngredientId;
    if (baseId == null) {
      return undefined;
    }

    const numericBaseId = Number(baseId);
    if (!Number.isFinite(numericBaseId) || numericBaseId < 0) {
      return undefined;
    }

    return Math.trunc(numericBaseId);
  }, [excludedIngredientNumericId, ingredientById]);

  const candidateIngredients = useMemo(() => {
    const normalized = normalizeSearchText(searchValue);
    const filtered = normalized.length >= MIN_AUTOCOMPLETE_LENGTH
      ? filterIngredientsByQuery(ingredients, normalized)
      : ingredients;

    return filtered
      .filter((item) => {
        const candidateId = Number(item.id ?? -1);
        const normalizedCandidateId = Number.isFinite(candidateId) && candidateId >= 0 ? Math.trunc(candidateId) : undefined;

        if (normalizedCandidateId != null && normalizedCandidateId === excludedIngredientNumericId) {
          return false;
        }

        if (excludedBaseIngredientId != null && normalizedCandidateId === excludedBaseIngredientId) {
          return false;
        }

        if (candidateId >= 0 && selectedSubstituteIds?.has(candidateId)) {
          return false;
        }

        const normalizedName = normalizeSearchText(item.name ?? '');
        if (normalizedName && selectedSubstituteNames?.has(normalizedName)) {
          return false;
        }

        return Boolean(item.name?.trim());
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [
    excludedBaseIngredientId,
    excludedIngredientNumericId,
    ingredients,
    searchValue,
    selectedSubstituteIds,
    selectedSubstituteNames,
  ]);

  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const secondaryFocusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearFocusTimers = useCallback(() => {
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
      focusTimeoutRef.current = null;
    }
    if (secondaryFocusTimeoutRef.current) {
      clearTimeout(secondaryFocusTimeoutRef.current);
      secondaryFocusTimeoutRef.current = null;
    }
  }, []);

  const handleFocusInput = useCallback(() => {
    clearFocusTimers();
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        focusTimeoutRef.current = setTimeout(() => {
          inputRef.current?.focus();
          secondaryFocusTimeoutRef.current = setTimeout(() => inputRef.current?.focus(), 80);
        }, 120);
      });
    });
  }, [clearFocusTimers]);

  useEffect(() => {
    if (visible) {
      handleFocusInput();
    } else {
      clearFocusTimers();
      inputRef.current?.blur();
      setSearchValue('');
    }
  }, [clearFocusTimers, handleFocusInput, visible]);

  useEffect(() => clearFocusTimers, [clearFocusTimers]);

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
      const tagColor = item.tags?.[0]?.color ?? tagColors.yellow;
      const subtitle = renderSubtitle(baseGroupId);
      const brandIndicatorColor = item.styleIngredientId != null
        ? Colors.styledIngredient
        : item.baseIngredientId != null
          ? Colors.primary
          : undefined;
      const rightIndicatorColor = candidateId >= 0
        ? brandedBaseIngredientIds.has(candidateId)
          ? Colors.primary
          : styleBaseIngredientIds.has(candidateId)
            ? Colors.styledIngredient
            : undefined
        : undefined;
      const rightIndicatorBottomColor = candidateId >= 0 && brandedBaseIngredientIds.has(candidateId) && styleBaseIngredientIds.has(candidateId)
        ? Colors.styledIngredient
        : undefined;

      return (
        <ListRow
          title={item.name ?? ''}
          subtitle={subtitle}
          onPress={() => onSelect(item)}
          selected={isAvailable}
          highlightColor={Colors.highlightFaint}
          tagColor={tagColor}
          thumbnail={<Thumb label={item.name ?? undefined} uri={item.photoUri} />}
          brandIndicatorColor={brandIndicatorColor}
          rightIndicatorColor={rightIndicatorColor}
          rightIndicatorBottomColor={rightIndicatorBottomColor}
          control={null}
          metaFooter={
            isOnShoppingList ? (
              <MaterialIcons
                name="shopping-cart"
                size={16}
                color={Colors.tint}
                style={styles.shoppingIcon}
                accessibilityRole="image"
                accessibilityLabel={t("cocktailForm.onShoppingList")}
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
      brandedBaseIngredientIds,
      styleBaseIngredientIds,
      Colors,
      t,
    ],
  );

  const renderSeparator = useCallback(
    ({ leadingItem }: { leadingItem?: Ingredient | null }) => {
      const ingredientId = Number(leadingItem?.id ?? -1);
      const isAvailable = ingredientId >= 0 && availableIngredientIds.has(ingredientId);
      const backgroundColor = isAvailable ? Colors.outline : Colors.outlineVariant;

      return <View style={[styles.modalSeparator, { backgroundColor }]} />;
    },
    [availableIngredientIds, Colors],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={handleFocusInput}>
      <Pressable style={styles.modalOverlay} onPress={onClose} accessibilityRole="button">
        <Pressable
          style={[
            styles.modalCard,
            {
              backgroundColor: Colors.surface,
              borderColor: Colors.outline,
              shadowColor: Colors.shadow,
            },
          ]}
          onPress={() => {}}
          accessibilityRole="menu">
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <Text style={[styles.modalTitle, { color: Colors.onSurface, flex: 1 }]}>{t("cocktailForm.addSubstitute")}</Text>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t("common.close")}>
                <MaterialCommunityIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </Pressable>
            </View>
            {ingredientName ? (
              <Text style={[styles.modalSubtitle, { color: Colors.onSurfaceVariant }]}>{t("substituteModal.forNamed", { name: ingredientName })}</Text>
            ) : null}
          </View>
          <TextInput
            ref={inputRef}
            value={searchValue}
            onChangeText={setSearchValue}
            placeholder={t("substituteModal.searchIngredients")}
            placeholderTextColor={`${Colors.onSurfaceVariant}99`}
            style={[
              styles.input,
              {
                borderColor: Colors.outlineVariant,
                color: Colors.text,
                backgroundColor: Colors.surfaceBright,
              },
            ]}
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
              <Text style={[styles.modalEmptyText, { color: Colors.onSurfaceVariant }]}>{t("ingredientForm.noIngredientsFound")}</Text>
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 12,
    paddingTop: 12,
    paddingRight: 16,
    paddingBottom: 20,
    paddingLeft: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  modalHeader: {
    gap: 8,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
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
