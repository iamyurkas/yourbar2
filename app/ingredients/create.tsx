import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';

import { IngredientForm } from '@/components/ingredients/IngredientForm';
import type { IngredientDraft, IngredientTag } from '@/providers/inventory-provider';
import { useInventory } from '@/providers/inventory-provider';

export default function CreateIngredientScreen() {
  const router = useRouter();
  const { ingredients, tags, upsertIngredient, upsertTag } = useInventory();
  const [saving, setSaving] = useState(false);

  const availableTags = useMemo(() => tags.slice().sort((a, b) => a.name.localeCompare(b.name)), [tags]);

  const handleSubmit = useCallback(
    async (draft: IngredientDraft) => {
      if (saving) {
        return;
      }
      setSaving(true);
      try {
        const created = upsertIngredient({ ...draft, id: draft.id ?? Date.now() });
        if (created) {
          router.replace({ pathname: '/ingredients/[id]', params: { id: String(created.id) } });
        }
      } finally {
        setSaving(false);
      }
    },
    [router, saving, upsertIngredient],
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

  return (
    <>
      <Stack.Screen options={{ title: 'Create Ingredient' }} />
      <IngredientForm
        availableIngredients={ingredients}
        availableTags={availableTags}
        saving={saving}
        submitLabel="Save Ingredient"
        onSubmit={handleSubmit}
        onRequestCreateTag={handleCreateTag}
      />
    </>
  );
}
