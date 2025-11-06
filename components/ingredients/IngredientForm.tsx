import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  findNodeHandle,
} from 'react-native';

import { Colors } from '@/constants/theme';
import type {
  Ingredient,
  IngredientDraft,
  IngredientTag,
} from '@/providers/inventory-provider';
import { TagPill } from '@/components/ui/TagPill';

const PHOTO_SIZE = 150;

export type IngredientFormProps = {
  initialIngredient?: Ingredient | null;
  availableTags: IngredientTag[];
  availableIngredients: Ingredient[];
  saving?: boolean;
  submitLabel: string;
  onSubmit: (draft: IngredientDraft) => Promise<void> | void;
  onRequestCreateTag?: (name: string) => IngredientTag | Promise<IngredientTag>;
};

type Focusable = TextInput | View | null;

type TagSelectionState = {
  selected: IngredientTag[];
  available: IngredientTag[];
};

export function IngredientForm({
  initialIngredient,
  availableTags,
  availableIngredients,
  saving = false,
  submitLabel,
  onSubmit,
  onRequestCreateTag,
}: IngredientFormProps) {
  const scrollRef = useRef<ScrollView>(null);
  const nameRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);

  const [name, setName] = useState(initialIngredient?.name ?? '');
  const [description, setDescription] = useState(initialIngredient?.description ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(initialIngredient?.photoUri ?? null);
  const [baseIngredientId, setBaseIngredientId] = useState<number | null | undefined>(
    initialIngredient?.baseIngredientId ?? null,
  );
  const [addTagModalVisible, setAddTagModalVisible] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const [selectedTags, setSelectedTags] = useState<IngredientTag[]>(() =>
    [...(initialIngredient?.tags ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
  );

  const tagSelection = useMemo<TagSelectionState>(() => {
    const selectedIds = new Set(selectedTags.map((tag) => tag.id));
    const available = availableTags.filter((tag) => !selectedIds.has(tag.id));
    return { selected: selectedTags, available };
  }, [availableTags, selectedTags]);

  const focusField = useCallback((field: Focusable) => {
    if (!field) {
      return;
    }

    requestAnimationFrame(() => {
      const handle = findNodeHandle(field);
      if (handle && scrollRef.current) {
        scrollRef.current.scrollResponderScrollNativeHandleToKeyboard(handle, 100, true);
      }
    });
  }, []);

  const toggleTag = useCallback(
    (tag: IngredientTag) => {
      setSelectedTags((prev) => {
        const exists = prev.some((item) => item.id === tag.id);
        if (exists) {
          return prev.filter((item) => item.id !== tag.id);
        }
        return [...prev, tag].sort((a, b) => a.name.localeCompare(b.name));
      });
    },
    [],
  );

  const resetNewTagModal = useCallback(() => {
    setNewTagName('');
    setAddTagModalVisible(false);
  }, []);

  const handleCreateTag = useCallback(async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) {
      Alert.alert('Tag name required', 'Please enter a name for the new tag.');
      return;
    }

    const colorPalette = ['#FFB74D', '#9575CD', '#4DB6AC', '#F06292', '#64B5F6'];
    const fallbackColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    const tag: IngredientTag = {
      id: Date.now(),
      name: trimmed,
      color: fallbackColor,
    };

    try {
      const created = (await onRequestCreateTag?.(trimmed)) ?? tag;
      toggleTag(created);
      resetNewTagModal();
    } catch (error) {
      console.warn('Unable to create tag', error);
      Alert.alert('Unable to create tag', 'Please try again later.');
    }
  }, [newTagName, onRequestCreateTag, resetNewTagModal, toggleTag]);

  const handleSubmit = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Please enter a name for the ingredient.');
      focusField(nameRef.current);
      return;
    }

    const draft: IngredientDraft = {
      id: initialIngredient?.id ?? Date.now(),
      name: trimmedName,
      description: description?.trim() ?? '',
      photoUri: photoUri ?? undefined,
      baseIngredientId: baseIngredientId ?? undefined,
      tags: selectedTags,
      searchName: trimmedName,
      searchTokens: trimmedName.toLowerCase().split(/\s+/).filter(Boolean),
      usageCount: initialIngredient?.usageCount ?? 0,
    };

    onSubmit(draft);
  }, [
    baseIngredientId,
    description,
    focusField,
    initialIngredient?.id,
    initialIngredient?.usageCount,
    name,
    onSubmit,
    photoUri,
    selectedTags,
  ]);

  const availableBaseIngredients = useMemo(
    () =>
      availableIngredients.filter((ingredient) =>
        initialIngredient ? ingredient.id !== initialIngredient.id : true,
      ),
    [availableIngredients, initialIngredient],
  );

  const baseIngredient = baseIngredientId
    ? availableIngredients.find((item) => item.id === baseIngredientId)
    : undefined;

  const handlePickImage = useCallback(() => {
    Alert.alert('Image picker', 'Image selection is not available in this demo environment.');
    if (!photoUri) {
      setPhotoUri('https://placehold.co/300x300.png');
    }
  }, [photoUri]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      keyboardVerticalOffset={60}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: Colors.onSurface }]}>Name</Text>
          <TextInput
            ref={nameRef}
            placeholder="e.g. Lemon juice"
            value={name}
            onChangeText={setName}
            onFocus={() => focusField(nameRef.current)}
            style={[styles.input, { color: Colors.onSurface, borderColor: Colors.outline }]}
            placeholderTextColor={`${Colors.onSurface}66`}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: Colors.onSurface }]}>Photo</Text>
          <Pressable
            accessibilityRole="button"
            onPress={handlePickImage}
            style={[
              styles.photoButton,
              {
                backgroundColor: Colors.surface,
                borderColor: Colors.outline,
                width: PHOTO_SIZE,
                height: PHOTO_SIZE,
              },
            ]}
            android_ripple={{ color: `${Colors.onSurface}22` }}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
            ) : (
              <Text style={[styles.photoPlaceholder, { color: Colors.onSurfaceVariant }]}>Tap to select image</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.rowBetween}>
            <Text style={[styles.label, { color: Colors.onSurface }]}>Tags</Text>
            <Pressable
              onPress={() =>
                Alert.alert('Manage tags', 'Tap a tag below to add or remove it from the ingredient.')
              }>
              <Text style={[styles.linkLabel, { color: Colors.tint }]}>Manage tags</Text>
            </Pressable>
          </View>
          <View style={styles.tagContainer}>
            {tagSelection.selected.map((tag) => (
              <TagPill
                key={tag.id}
                label={tag.name}
                color={tag.color}
                selected
                onPress={() => toggleTag(tag)}
              />
            ))}
            <TagPill label="+Add" selected={false} onPress={() => setAddTagModalVisible(true)} />
          </View>
          {tagSelection.available.length ? (
            <View style={styles.tagContainer}>
              {tagSelection.available.map((tag) => (
                <TagPill key={tag.id} label={tag.name} color={tag.color} onPress={() => toggleTag(tag)} />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: Colors.onSurface }]}>Base Ingredient</Text>
          <View style={[styles.baseSelector, { borderColor: Colors.outline, backgroundColor: Colors.surface }]}>
            <Text style={[styles.baseLabel, { color: Colors.onSurface }]}>
              {baseIngredient ? baseIngredient.name : 'None'}
            </Text>
          </View>
          <View style={styles.baseList}>
            {availableBaseIngredients.map((ingredient) => {
              const selected = ingredient.id === baseIngredientId;
              return (
                <Pressable
                  key={ingredient.id}
                  style={[styles.baseRow, selected && { backgroundColor: `${Colors.tint}11` }]}
                  onPress={() => setBaseIngredientId(selected ? null : ingredient.id)}
                  android_ripple={{ color: `${Colors.onSurface}1F` }}>
                  <Text style={[styles.baseRowText, { color: Colors.onSurface }]}>{ingredient.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: Colors.onSurface }]}>Description</Text>
          <TextInput
            ref={descriptionRef}
            value={description}
            onChangeText={setDescription}
            onFocus={() => focusField(descriptionRef.current)}
            multiline
            numberOfLines={4}
            style={[styles.multilineInput, { color: Colors.onSurface, borderColor: Colors.outline }]}
            placeholder="Add a description"
            placeholderTextColor={`${Colors.onSurface}66`}
            textAlignVertical="top"
          />
        </View>

        <Pressable
          style={[styles.submitButton, { backgroundColor: Colors.tint }]}
          onPress={handleSubmit}
          disabled={saving}
          accessibilityRole="button"
          android_ripple={{ color: `${Colors.surface}22` }}>
          <Text style={[styles.submitLabel, { color: Colors.surface }]}>
            {saving ? 'Saving...' : submitLabel}
          </Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={addTagModalVisible}
        transparent
        animationType="fade"
        onRequestClose={resetNewTagModal}>
        <View style={styles.modalBackdrop}>
          <View
            style={[styles.modalCard, { backgroundColor: Colors.surface }]}
            accessible
            accessibilityRole="dialog"
            accessibilityLabel="Add tag">
            <Text style={[styles.modalTitle, { color: Colors.onSurface }]}>Add Tag</Text>
            <TextInput
              value={newTagName}
              onChangeText={setNewTagName}
              placeholder="Tag name"
              placeholderTextColor={`${Colors.onSurface}66`}
              style={[styles.modalInput, { color: Colors.onSurface, borderColor: Colors.outline }]}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={resetNewTagModal}
                style={styles.modalActionButton}
                android_ripple={{ color: `${Colors.onSurface}22` }}>
                <Text style={[styles.modalActionText, { color: Colors.onSurfaceVariant }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateTag}
                style={styles.modalActionButton}
                android_ripple={{ color: `${Colors.onSurface}22` }}>
                <Text style={[styles.modalActionText, { color: Colors.tint }]}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 120,
  },
  fieldGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
  },
  photoButton: {
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  photoPlaceholder: {
    textAlign: 'center',
    fontSize: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  baseSelector: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  baseLabel: {
    fontSize: 15,
  },
  baseList: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${Colors.outline}55`,
  },
  baseRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  baseRowText: {
    fontSize: 14,
  },
  multilineInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 100,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#00000055',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    elevation: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: Colors.surface,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalActionText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
