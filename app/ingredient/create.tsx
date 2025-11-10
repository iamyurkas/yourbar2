import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
// eslint-disable-next-line import/no-unresolved
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListRow, Thumb } from '@/components/RowParts';
import { Colors } from '@/constants/theme';
import { useInventory, type Ingredient } from '@/providers/inventory-provider';
import { palette as appPalette } from '@/theme/theme';

const PHOTO_PLACEHOLDER_SIZE = 168;

export default function CreateIngredientScreen() {
  const paletteColors = Colors;
  const router = useRouter();
  const { ingredients } = useInventory();

  const scrollRef = useRef<ScrollView>(null);
  const baseFieldContainerRef = useRef<View>(null);
  const baseInputRef = useRef<TextInput>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [baseIngredientId, setBaseIngredientId] = useState<number | null>(null);
  const [baseInputValue, setBaseInputValue] = useState('');
  const [baseFieldLayout, setBaseFieldLayout] = useState<{ y: number; height: number } | null>(null);
  const [baseFieldWindowLayout, setBaseFieldWindowLayout] =
    useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isBaseDropdownVisible, setBaseDropdownVisible] = useState(false);

  const updateBaseFieldWindowLayout = useCallback(() => {
    requestAnimationFrame(() => {
      baseFieldContainerRef.current?.measureInWindow((x, y, width, height) => {
        setBaseFieldWindowLayout({ x, y, width, height });
      });
    });
  }, []);

  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', updateBaseFieldWindowLayout);
    const hideListener = Keyboard.addListener('keyboardDidHide', updateBaseFieldWindowLayout);
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, [updateBaseFieldWindowLayout]);

  const baseIngredients = useMemo(() => {
    return ingredients
      .filter((ingredient) => ingredient.baseIngredientId == null)
      .slice()
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }, [ingredients]);

  const filteredBaseIngredients = useMemo(() => {
    const normalized = baseInputValue.trim().toLowerCase();
    if (normalized.length < 3) {
      return [];
    }
    return baseIngredients.filter((ingredient) => {
      const name = (ingredient.name ?? '').toLowerCase();
      if (name.startsWith(normalized)) {
        return true;
      }
      return name
        .split(/\s+/)
        .some((word) => word.startsWith(normalized));
    });
  }, [baseIngredients, baseInputValue]);

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

  const handleSelectBaseIngredient = useCallback((ingredient: Ingredient) => {
    const id = ingredient.id != null ? Number(ingredient.id) : null;
    if (id != null && !Number.isNaN(id)) {
      setBaseIngredientId(id);
      setBaseInputValue(ingredient.name ?? '');
    }
    setBaseDropdownVisible(false);
    baseInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const handleClearBaseIngredient = useCallback(() => {
    setBaseIngredientId(null);
    setBaseInputValue('');
    setBaseDropdownVisible(false);
    baseInputRef.current?.focus();
  }, []);

  const handleBaseInputFocus = useCallback(() => {
    if (baseFieldLayout) {
      scrollRef.current?.scrollTo({
        y: Math.max(baseFieldLayout.y - 24, 0),
        animated: true,
      });
    }
    updateBaseFieldWindowLayout();
    setTimeout(() => {
      updateBaseFieldWindowLayout();
    }, 160);
    if (baseInputValue.trim().length >= 3) {
      setBaseDropdownVisible(true);
    }
  }, [baseFieldLayout, baseInputValue, updateBaseFieldWindowLayout]);

  const handleBaseInputBlur = useCallback(() => {
    setTimeout(() => {
      setBaseDropdownVisible(false);
    }, 100);
  }, []);

  const handleBaseInputChange = useCallback(
    (text: string) => {
      setBaseInputValue(text);
      if (selectedBaseIngredient && (selectedBaseIngredient.name ?? '') !== text) {
        setBaseIngredientId(null);
      }
      if (text.trim().length >= 3) {
        setBaseDropdownVisible(true);
        updateBaseFieldWindowLayout();
      } else {
        setBaseDropdownVisible(false);
      }
    },
    [selectedBaseIngredient, updateBaseFieldWindowLayout],
  );

  const closeBaseDropdown = useCallback(() => {
    setBaseDropdownVisible(false);
  }, []);

  useEffect(() => {
    if (isBaseDropdownVisible) {
      updateBaseFieldWindowLayout();
      const timer = setTimeout(() => {
        updateBaseFieldWindowLayout();
      }, 120);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isBaseDropdownVisible, updateBaseFieldWindowLayout]);

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
          ref={scrollRef}
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
                  <Text style={[styles.photoHint, { color: paletteColors.onSurfaceVariant }]}>Crop or adjust the photo</Text>
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

          <View
            style={styles.formGroup}
            ref={baseFieldContainerRef}
            onLayout={(event) => {
              const { y, height } = event.nativeEvent.layout;
              setBaseFieldLayout({ y, height });
            }}>
            <Text style={[styles.label, { color: paletteColors.onSurface }]}>Base ingredient</Text>
            <View
              style={[styles.baseInputWrapper, { borderColor: paletteColors.outline, backgroundColor: paletteColors.surface }]}
              pointerEvents="box-none">
              <TextInput
                ref={baseInputRef}
                style={[styles.baseInput, { color: paletteColors.onSurface }]}
                placeholder="Start typing to search"
                placeholderTextColor={paletteColors.onSurfaceVariant}
                value={baseInputValue}
                onChangeText={handleBaseInputChange}
                onFocus={handleBaseInputFocus}
                onBlur={handleBaseInputBlur}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {baseInputValue.length > 0 ? (
                <Pressable
                  onPress={handleClearBaseIngredient}
                  style={[styles.clearTextButton, { backgroundColor: paletteColors.surfaceVariant }]}
                  accessibilityRole="button"
                  accessibilityLabel="Clear base ingredient text">
                  <MaterialIcons name="close" size={16} color={paletteColors.onSurfaceVariant} />
                </Pressable>
              ) : null}
            </View>
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

      <IngredientSuggestionsDropdown
        visible={isBaseDropdownVisible}
        onRequestClose={closeBaseDropdown}
        fieldLayout={baseFieldWindowLayout}
        paletteColors={paletteColors}
        baseIngredients={filteredBaseIngredients}
        onSelect={handleSelectBaseIngredient}
        selectedBaseIngredientId={baseIngredientId}
      />
    </SafeAreaView>
  );
}

type IngredientSuggestionsDropdownProps = {
  visible: boolean;
  onRequestClose: () => void;
  fieldLayout: { x: number; y: number; width: number; height: number } | null;
  paletteColors: typeof Colors;
  baseIngredients: Ingredient[];
  onSelect: (ingredient: Ingredient) => void;
  selectedBaseIngredientId: number | null;
};

function IngredientSuggestionsDropdown({
  visible,
  onRequestClose,
  fieldLayout,
  paletteColors,
  baseIngredients,
  onSelect,
  selectedBaseIngredientId,
}: IngredientSuggestionsDropdownProps) {
  if (!visible || !fieldLayout) {
    return null;
  }

  const dropdownPosition = {
    top: fieldLayout.y + fieldLayout.height + 4,
    left: fieldLayout.x,
    width: fieldLayout.width,
  } as const;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable
        style={[StyleSheet.absoluteFill, styles.dropdownOverlay]}
        accessibilityRole="button"
        accessibilityLabel="Dismiss ingredient suggestions"
        onPress={onRequestClose}
      />
      <View
        style={[
          styles.dropdownContainer,
          dropdownPosition,
          {
            backgroundColor: paletteColors.surface,
            borderColor: paletteColors.outline,
          },
        ]}
        pointerEvents="auto">
        <ScrollView style={styles.dropdownList}>
          {baseIngredients.length > 0 ? (
            baseIngredients.map((ingredient) => {
              const id = ingredient.id != null ? Number(ingredient.id) : null;
              const isSelected = id != null && id === selectedBaseIngredientId;
              const tagColor = ingredient.tags?.[0]?.color;
              return (
                <ListRow
                  key={ingredient.id ?? ingredient.name}
                  title={ingredient.name ?? 'Unknown ingredient'}
                  onPress={() => onSelect(ingredient)}
                  selected={isSelected}
                  highlightColor={appPalette.highlightSubtle}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${ingredient.name} as base ingredient`}
                  accessibilityState={isSelected ? { selected: true } : undefined}
                  thumbnail={<Thumb label={ingredient.name ?? undefined} uri={ingredient.photoUri ?? undefined} />}
                  tagColor={tagColor}
                />
              );
            })
          ) : (
            <View style={styles.dropdownEmptyState}>
              <MaterialCommunityIcons name="magnify-close" size={28} color={paletteColors.onSurfaceVariant} />
              <Text style={[styles.dropdownEmptyText, { color: paletteColors.onSurfaceVariant }]}>No matches</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
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
  baseInputWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  baseInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  clearTextButton: {
    marginLeft: 12,
    borderRadius: 999,
    padding: 4,
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
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  dropdownContainer: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    maxHeight: 320,
  },
  dropdownList: {
    maxHeight: 320,
  },
  dropdownEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  dropdownEmptyText: {
    fontSize: 15,
  },
});
