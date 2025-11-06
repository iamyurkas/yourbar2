import { MaterialIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { IngredientForm } from '@/components/ingredients/IngredientForm';
import { Colors } from '@/constants/theme';
import type { IngredientDraft, IngredientTag } from '@/providers/inventory-provider';
import { useInventory } from '@/providers/inventory-provider';

export default function EditIngredientScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { ingredients, tags, findIngredientById, upsertIngredient, removeIngredient, upsertTag } = useInventory();
  const [saving, setSaving] = useState(false);

  const ingredientId = useMemo(() => {
    const numeric = Number(id);
    return Number.isFinite(numeric) ? numeric : null;
  }, [id]);

  const ingredient = useMemo(() => {
    if (ingredientId == null) {
      return undefined;
    }
    return findIngredientById(ingredientId);
  }, [findIngredientById, ingredientId]);

  const availableTags = useMemo(() => tags.slice().sort((a, b) => a.name.localeCompare(b.name)), [tags]);

  const handleSubmit = useCallback(
    async (draft: IngredientDraft) => {
      if (!ingredient) {
        return;
      }
      if (saving) {
        return;
      }
      setSaving(true);
      try {
        const updated = upsertIngredient(draft);
        if (updated) {
          router.replace({ pathname: '/ingredients/[id]', params: { id: String(updated.id) } });
        }
      } finally {
        setSaving(false);
      }
    },
    [ingredient, router, saving, upsertIngredient],
  );

  const handleCreateTag = useCallback(
    async (name: string) => {
      const tag: IngredientTag = {
        id: Date.now(),
        name,
        color: '#9575CD',
      };
      return upsertTag(tag);
    },
    [upsertTag],
  );

  const handleDelete = useCallback(() => {
    if (!ingredient) {
      return;
    }
    Alert.alert('Delete ingredient', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeIngredient(ingredient.id);
          router.replace('/(tabs)/ingredients');
        },
      },
    ]);
  }, [ingredient, removeIngredient, router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  if (!ingredient) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: Colors.onSurfaceVariant }]}>Ingredient not found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit Ingredient',
          gestureEnabled: false,
          headerLeft: () => (
            <Pressable onPress={handleBack} accessibilityRole="button" style={styles.headerButton}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={handleDelete} accessibilityRole="button" style={styles.headerButton}>
              <MaterialIcons name="delete" size={22} color={Colors.error ?? '#D32F2F'} />
            </Pressable>
          ),
        }}
      />
      <IngredientForm
        initialIngredient={ingredient}
        availableIngredients={ingredients}
        availableTags={availableTags}
        saving={saving}
        submitLabel="Save Changes"
        onSubmit={handleSubmit}
        onRequestCreateTag={handleCreateTag}
      />
    </>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
  },
  headerButton: {
    padding: 6,
    marginHorizontal: 8,
  },
});
