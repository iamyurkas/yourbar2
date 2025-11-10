import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useInventory } from '@/providers/inventory-provider';

export default function CreateIngredientScreen() {
  const palette = Colors;
  const router = useRouter();
  const { addIngredient, ingredients } = useInventory();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseInput, setBaseInput] = useState('');
  const [photoUri, setPhotoUri] = useState('');
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);
  const [imagePermission, requestImagePermission] = ImagePicker.useMediaLibraryPermissions();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolvedBaseIngredient = useMemo(() => {
    const normalizedInput = baseInput.trim();
    if (!normalizedInput) {
      return undefined;
    }

    const numericCandidate = Number(normalizedInput);
    if (!Number.isNaN(numericCandidate)) {
      return ingredients.find((item) => Number(item.id ?? -1) === numericCandidate);
    }

    const normalizedName = normalizedInput.toLowerCase();
    return ingredients.find((item) => item.name?.toLowerCase() === normalizedName);
  }, [baseInput, ingredients]);

  const helperText = useMemo(() => {
    if (!baseInput.trim()) {
      return 'Link this ingredient to an optional base ingredient by ID or exact name.';
    }

    if (resolvedBaseIngredient) {
      return `Linked to ${resolvedBaseIngredient.name}`;
    }

    return 'No matching base ingredient found.';
  }, [baseInput, resolvedBaseIngredient]);

  const helperColor = !baseInput.trim()
    ? palette.onSurfaceVariant
    : resolvedBaseIngredient
      ? palette.primary
      : palette.error;

  const handleCreate = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }

    const baseCandidate = baseInput.trim();
    let baseIngredientId: number | undefined;

    if (baseCandidate) {
      const numericCandidate = Number(baseCandidate);
      if (!Number.isNaN(numericCandidate)) {
        baseIngredientId = Math.trunc(numericCandidate);
      } else if (resolvedBaseIngredient?.id != null) {
        const parsed = Number(resolvedBaseIngredient.id);
        if (!Number.isNaN(parsed)) {
          baseIngredientId = parsed;
        }
      }

      if (baseIngredientId == null) {
        setError('Enter a valid base ingredient ID or exact name.');
        return;
      }

      const exists = ingredients.some((item) => Number(item.id ?? -1) === baseIngredientId);
      if (!exists) {
        setError('The selected base ingredient does not exist.');
        return;
      }
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const created = addIngredient({
        name: trimmedName,
        description: description.trim() || undefined,
        baseIngredientId,
        photoUri: photoUri.trim() || undefined,
      });

      const destinationId = created.id ?? created.name;
      if (destinationId != null) {
        router.replace({
          pathname: '/ingredient/[ingredientId]',
          params: { ingredientId: String(destinationId) },
        });
      } else {
        router.back();
      }
    } catch (createError) {
      console.error(createError);
      setError('Something went wrong while creating the ingredient.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    addIngredient,
    baseInput,
    description,
    ingredients,
    isSubmitting,
    name,
    photoUri,
    resolvedBaseIngredient?.id,
    router,
  ]);

  const handlePickPhoto = useCallback(async () => {
    if (isPickingPhoto) {
      return;
    }

    try {
      setIsPickingPhoto(true);

      if (!imagePermission || imagePermission.status !== ImagePicker.PermissionStatus.GRANTED) {
        const permissionResult = await requestImagePermission();
        if (!permissionResult || permissionResult.status !== ImagePicker.PermissionStatus.GRANTED) {
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: [ImagePicker.MediaTypeOptions.Images],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const [asset] = result.assets;
      if (!asset?.uri) {
        return;
      }

      const manipulated = await ImageManipulator.manipulateAsync(asset.uri, [], {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      });

      if (manipulated?.uri) {
        setPhotoUri(manipulated.uri);
      }
    } catch (pickError) {
      console.error(pickError);
    } finally {
      setIsPickingPhoto(false);
    }
  }, [imagePermission, isPickingPhoto, requestImagePermission]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Create ingredient' }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: 'padding', default: undefined })}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: palette.onSurfaceVariant }]}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Homemade Orgeat"
              placeholderTextColor={`${palette.onSurfaceVariant}99`}
              autoCapitalize="words"
              style={[styles.input, { borderColor: palette.outline, color: palette.onSurface }]}
              accessibilityLabel="Ingredient name"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: palette.onSurfaceVariant }]}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Add tasting notes or production details"
              placeholderTextColor={`${palette.onSurfaceVariant}99`}
              multiline
              numberOfLines={4}
              style={[
                styles.input,
                styles.multiline,
                { borderColor: palette.outline, color: palette.onSurface },
              ]}
              textAlignVertical="top"
              accessibilityLabel="Ingredient description"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: palette.onSurfaceVariant }]}>Base ingredient</Text>
            <TextInput
              value={baseInput}
              onChangeText={setBaseInput}
              placeholder="Enter base ingredient ID or name"
              placeholderTextColor={`${palette.onSurfaceVariant}99`}
              style={[styles.input, { borderColor: palette.outline, color: palette.onSurface }]}
              accessibilityLabel="Base ingredient"
            />
            <Text style={[styles.helper, { color: helperColor }]}>
              {helperText}
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: palette.onSurfaceVariant }]}>Photo</Text>
            <Pressable
              onPress={handlePickPhoto}
              disabled={isPickingPhoto}
              style={({ pressed }) => [
                styles.photoPlaceholder,
                { borderColor: palette.outline, backgroundColor: palette.surfaceVariant },
                pressed && !isPickingPhoto ? { opacity: 0.85 } : null,
              ]}
              accessibilityRole="button"
              accessibilityState={
                isPickingPhoto ? { disabled: true, busy: true } : undefined
              }
              accessibilityLabel={photoUri ? 'Change ingredient photo' : 'Add ingredient photo'}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoPreview} contentFit="cover" />
              ) : (
                <Text style={[styles.photoPlaceholderLabel, { color: palette.onSurfaceVariant }]}>Tap to add photo</Text>
              )}
            </Pressable>
          </View>

          {error ? <Text style={[styles.errorText, { color: palette.error }]}>{error}</Text> : null}

          <Pressable
            onPress={handleCreate}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityState={isSubmitting ? { disabled: true } : undefined}
            style={({ pressed }) => [
              styles.submitButton,
              { backgroundColor: palette.primary },
              pressed && !isSubmitting ? { opacity: 0.85 } : null,
              isSubmitting ? styles.submitButtonDisabled : null,
            ]}>
            <Text style={[styles.submitLabel, { color: palette.onPrimary }]}>
              {isSubmitting ? 'Creating…' : 'Create ingredient'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 20,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: Colors.surface,
  },
  multiline: {
    minHeight: 120,
  },
  photoPlaceholder: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPlaceholderLabel: {
    fontSize: 14,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  helper: {
    fontSize: 12,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  submitButton: {
    marginTop: 12,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
