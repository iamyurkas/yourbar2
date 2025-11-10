import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
// eslint-disable-next-line import/no-unresolved
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import { useInventory, type Ingredient } from '@/providers/inventory-provider';
import { palette as appPalette } from '@/theme/theme';

const PHOTO_PLACEHOLDER_SIZE = 168;

export default function CreateIngredientScreen() {
  const paletteColors = Colors;
  const router = useRouter();
  const { ingredients } = useInventory();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [baseIngredientId, setBaseIngredientId] = useState<number | null>(null);
  const [isBasePickerVisible, setBasePickerVisible] = useState(false);
  const [baseSearchQuery, setBaseSearchQuery] = useState('');

  const baseIngredients = useMemo(() => {
    return ingredients
      .filter((ingredient) => ingredient.baseIngredientId == null)
      .slice()
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }, [ingredients]);

  const filteredBaseIngredients = useMemo(() => {
    if (!baseSearchQuery.trim()) {
      return baseIngredients;
    }
    const normalized = baseSearchQuery.trim().toLowerCase();
    return baseIngredients.filter((ingredient) =>
      (ingredient.name ?? '').toLowerCase().includes(normalized),
    );
  }, [baseIngredients, baseSearchQuery]);

  const selectedBaseIngredient = useMemo(() => {
    if (baseIngredientId == null) {
      return undefined;
    }
    return baseIngredients.find((ingredient) => Number(ingredient.id ?? -1) === baseIngredientId);
  }, [baseIngredientId, baseIngredients]);

  const handlePickPhoto = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission required',
        'Allow photo library access to choose an ingredient image.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (!result.canceled) {
      const [asset] = result.assets;
      if (asset?.uri) {
        setPhotoUri(asset.uri);
      }
    }
  }, []);

  const handleClearPhoto = useCallback(() => {
    setPhotoUri(null);
  }, []);

  const openBasePicker = useCallback(() => {
    setBasePickerVisible(true);
  }, []);

  const closeBasePicker = useCallback(() => {
    setBasePickerVisible(false);
  }, []);

  const handleSelectBaseIngredient = useCallback((ingredient: Ingredient) => {
    const id = ingredient.id != null ? Number(ingredient.id) : null;
    if (id != null && !Number.isNaN(id)) {
      setBaseIngredientId(id);
    }
    closeBasePicker();
  }, [closeBasePicker]);

  const handleClearBaseIngredient = useCallback(() => {
    setBaseIngredientId(null);
    closeBasePicker();
  }, [closeBasePicker]);

  const handleSubmit = useCallback(() => {
    const summary = [
      `Name: ${name || '—'}`,
      `Description: ${description ? description.slice(0, 80) : '—'}`,
      `Base ingredient: ${selectedBaseIngredient?.name ?? '—'}`,
      `Has photo: ${photoUri ? 'Yes' : 'No'}`,
    ].join('\n');

    Alert.alert('Ingredient draft', summary, [
      {
        text: 'Close',
        style: 'default',
        onPress: () => {
          router.back();
        },
      },
    ]);
  }, [description, name, photoUri, router, selectedBaseIngredient]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: paletteColors.background }]}>
      <Stack.Screen options={{ title: 'New ingredient' }} />
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined, default: undefined })}
        style={styles.flex}
        keyboardVerticalOffset={16}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: paletteColors.onSurface }]}>Ingredient name</Text>
            <TextInput
              style={[styles.textInput, { borderColor: paletteColors.outline, color: paletteColors.onSurface }]}
              placeholder="e.g. Fresh lime juice"
              placeholderTextColor={paletteColors.onSurfaceVariant}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: paletteColors.onSurface }]}>Photo</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add ingredient photo"
              onPress={handlePickPhoto}
              style={[styles.photoPicker, { borderColor: paletteColors.outline, backgroundColor: paletteColors.surface }]}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
              ) : (
                <View style={styles.photoPlaceholderContent}>
                  <MaterialCommunityIcons name="image-plus" size={36} color={paletteColors.onSurfaceVariant} />
                  <Text style={[styles.photoPlaceholderText, { color: paletteColors.onSurfaceVariant }]}>Tap to add photo</Text>
                  <Text style={[styles.photoHint, { color: paletteColors.onSurfaceVariant }]}>Crop a square image</Text>
                </View>
              )}
            </Pressable>
            {photoUri ? (
              <Pressable
                onPress={handleClearPhoto}
                accessibilityRole="button"
                accessibilityLabel="Remove selected photo"
                style={[styles.clearPhotoButton, { backgroundColor: paletteColors.surfaceVariant }]}>
                <MaterialIcons name="delete-outline" size={18} color={paletteColors.error} />
                <Text style={[styles.clearPhotoLabel, { color: paletteColors.error }]}>Remove photo</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: paletteColors.onSurface }]}>Base ingredient</Text>
            <Pressable
              onPress={openBasePicker}
              style={[styles.selectorButton, { borderColor: paletteColors.outline, backgroundColor: paletteColors.surface }]}
              accessibilityRole="button"
              accessibilityLabel="Choose base ingredient">
              <Text
                style={[
                  styles.selectorValue,
                  { color: selectedBaseIngredient ? paletteColors.onSurface : paletteColors.onSurfaceVariant },
                ]}>
                {selectedBaseIngredient ? selectedBaseIngredient.name : 'Select a base ingredient'}
              </Text>
              <MaterialIcons name="keyboard-arrow-right" size={20} color={paletteColors.onSurfaceVariant} />
            </Pressable>
            {selectedBaseIngredient ? (
              <Pressable
                onPress={handleClearBaseIngredient}
                accessibilityRole="button"
                accessibilityLabel="Clear base ingredient"
                style={[styles.clearSelectionButton, { backgroundColor: paletteColors.surfaceVariant }]}>
                <MaterialIcons name="close" size={16} color={paletteColors.onSurfaceVariant} />
                <Text style={[styles.clearSelectionLabel, { color: paletteColors.onSurfaceVariant }]}>Clear selection</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: paletteColors.onSurface }]}>Description</Text>
            <TextInput
              style={[styles.multilineInput, { borderColor: paletteColors.outline, color: paletteColors.onSurface }]}
              placeholder="Add tasting notes or preparation tips"
              placeholderTextColor={paletteColors.onSurfaceVariant}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
              numberOfLines={5}
            />
          </View>
        </ScrollView>
        <View style={[styles.footer, { borderTopColor: paletteColors.outline, backgroundColor: paletteColors.surface }]}> 
          <Pressable
            onPress={handleSubmit}
            style={[styles.primaryButton, { backgroundColor: paletteColors.tint }]}
            accessibilityRole="button"
            accessibilityLabel="Save ingredient">
            <Text style={[styles.primaryButtonLabel, { color: paletteColors.onPrimary }]}>Save ingredient</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={isBasePickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeBasePicker}>
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: paletteColors.surface }]}
          edges={['bottom']}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: paletteColors.onSurface }]}>Choose base ingredient</Text>
            <Pressable onPress={closeBasePicker} accessibilityRole="button" accessibilityLabel="Close">
              <MaterialIcons name="close" size={24} color={paletteColors.onSurfaceVariant} />
            </Pressable>
          </View>
          <View style={styles.modalSearchRow}>
            <MaterialIcons name="search" size={20} color={paletteColors.onSurfaceVariant} style={styles.searchIcon} />
            <TextInput
              style={[styles.modalSearchInput, { color: paletteColors.onSurface }]}
              placeholder="Search ingredients"
              placeholderTextColor={paletteColors.onSurfaceVariant}
              value={baseSearchQuery}
              onChangeText={setBaseSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
          <ScrollView contentContainerStyle={styles.modalList}>
            {filteredBaseIngredients.map((ingredient) => {
              const id = ingredient.id != null ? Number(ingredient.id) : null;
              const isSelected = id != null && id === baseIngredientId;
              return (
                <Pressable
                  key={ingredient.id ?? ingredient.name}
                  onPress={() => handleSelectBaseIngredient(ingredient)}
                  style={[
                    styles.modalItem,
                    {
                      borderColor: isSelected ? paletteColors.tint : paletteColors.outline,
                      backgroundColor: isSelected ? appPalette.highlightSubtle : paletteColors.surface,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${ingredient.name} as base ingredient`}>
                  <Text style={[styles.modalItemLabel, { color: paletteColors.onSurface }]}>{ingredient.name}</Text>
                  {isSelected ? (
                    <MaterialIcons name="check" size={18} color={paletteColors.tint} />
                  ) : null}
                </Pressable>
              );
            })}
            {filteredBaseIngredients.length === 0 ? (
              <View style={styles.modalEmptyState}>
                <MaterialCommunityIcons name="magnify-close" size={28} color={paletteColors.onSurfaceVariant} />
                <Text style={[styles.modalEmptyText, { color: paletteColors.onSurfaceVariant }]}>No matches</Text>
              </View>
            ) : null}
          </ScrollView>
          {selectedBaseIngredient ? (
            <Pressable
              onPress={handleClearBaseIngredient}
              style={[styles.modalClearButton, { borderTopColor: paletteColors.outline }]}
              accessibilityRole="button"
              accessibilityLabel="Remove selected base ingredient">
              <Text style={[styles.modalClearLabel, { color: paletteColors.error }]}>Remove base ingredient</Text>
            </Pressable>
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 120,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  multilineInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 140,
    fontSize: 16,
    lineHeight: 22,
  },
  photoPicker: {
    borderWidth: 1,
    borderRadius: 16,
    height: PHOTO_PLACEHOLDER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholderContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoPlaceholderText: {
    fontSize: 15,
    fontWeight: '500',
  },
  photoHint: {
    fontSize: 13,
  },
  clearPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
    gap: 6,
  },
  clearPhotoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectorButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectorValue: {
    fontSize: 16,
    flex: 1,
  },
  clearSelectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
  },
  clearSelectionLabel: {
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
  },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalSearchRow: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 16,
  },
  modalList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    paddingBottom: 40,
  },
  modalItem: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalItemLabel: {
    fontSize: 16,
    flex: 1,
  },
  modalEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  modalEmptyText: {
    fontSize: 15,
  },
  modalClearButton: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderTopWidth: 1,
  },
  modalClearLabel: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});
