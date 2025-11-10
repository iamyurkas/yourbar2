import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';

import { resolveAssetFromCatalog } from '@/assets/image-manifest';
import { ListRow, Thumb } from '@/components/RowParts';
import { Colors } from '@/constants/theme';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import { useInventory, type Ingredient } from '@/providers/inventory-provider';
import { palette as appPalette } from '@/theme/theme';

export default function CreateIngredientScreen() {
  const paletteColors = Colors;
  const { ingredients } = useInventory();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [baseIngredientId, setBaseIngredientId] = useState<number | null>(null);
  const [isBaseModalVisible, setIsBaseModalVisible] = useState(false);
  const [baseSearch, setBaseSearch] = useState('');
  const [permissionStatus, requestPermission] = ImagePicker.useMediaLibraryPermissions();

  const placeholderLabel = useMemo(() => {
    if (imageUri) {
      return 'Change image';
    }

    return 'Add image';
  }, [imageUri]);

  const toggleTag = useCallback((tagId: number) => {
    setSelectedTagIds((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId);
      }

      return [...prev, tagId];
    });
  }, []);

  const tagSelection = useMemo(() => {
    const set = new Set(selectedTagIds);
    return BUILTIN_INGREDIENT_TAGS.map((tag) => ({
      ...tag,
      selected: set.has(tag.id),
    }));
  }, [selectedTagIds]);

  const ensureMediaPermission = useCallback(async () => {
    if (permissionStatus?.granted) {
      return true;
    }

    const { status, granted, canAskAgain } = await requestPermission();
    if (granted || status === ImagePicker.PermissionStatus.GRANTED) {
      return true;
    }

    if (!canAskAgain) {
      Alert.alert(
        'Media library access',
        'Enable photo library permissions in system settings to add an ingredient image.',
      );
    }

    return false;
  }, [permissionStatus?.granted, requestPermission]);

  const handlePickImage = useCallback(async () => {
    if (isPickingImage) {
      return;
    }

    const hasPermission = await ensureMediaPermission();
    if (!hasPermission) {
      return;
    }

    try {
      setIsPickingImage(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1,
        exif: false,
      });

      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        if (asset?.uri) {
          setImageUri(asset.uri);
        }
      }
    } catch (error) {
      console.warn('Failed to pick image', error);
      Alert.alert('Could not pick image', 'Please try again later.');
    } finally {
      setIsPickingImage(false);
    }
  }, [ensureMediaPermission, isPickingImage]);

  const handleSubmit = useCallback(() => {
    if (!name.trim()) {
      Alert.alert('Name is required', 'Please enter the ingredient name.');
      return;
    }

    Alert.alert(
      'Ingredient saved',
      'This prototype does not persist data yet, but the form is ready for integration.',
      [
        {
          text: 'Go back',
          onPress: () => {
            router.back();
          },
        },
      ],
    );
  }, [name]);

  const baseIngredient = useMemo(() => {
    if (baseIngredientId == null) {
      return undefined;
    }

    const targetId = Number(baseIngredientId);
    if (!Number.isFinite(targetId) || targetId < 0) {
      return undefined;
    }

    return ingredients.find((item) => Number(item.id ?? -1) === targetId);
  }, [baseIngredientId, ingredients]);

  const baseIngredientPhotoSource = useMemo(() => {
    if (!baseIngredient?.photoUri) {
      return undefined;
    }

    const asset = resolveAssetFromCatalog(baseIngredient.photoUri);
    if (asset) {
      return asset;
    }

    if (/^https?:/i.test(baseIngredient.photoUri)) {
      return { uri: baseIngredient.photoUri } as const;
    }

    return undefined;
  }, [baseIngredient?.photoUri]);

  const handleOpenBaseModal = useCallback(() => {
    setBaseSearch(baseIngredient?.name ?? '');
    setIsBaseModalVisible(true);
  }, [baseIngredient?.name]);

  const handleClearBaseIngredient = useCallback(
    (event?: GestureResponderEvent) => {
      event?.stopPropagation?.();
      setBaseIngredientId(null);
      setBaseSearch('');
    },
    [],
  );

  const handleCloseBaseModal = useCallback(() => {
    const normalized = baseSearch.trim().toLowerCase();
    if (normalized) {
      const match = ingredients.find((item) =>
        item.name ? item.name.trim().toLowerCase() === normalized : false,
      );

      if (match?.id != null) {
        const numericId = Number(match.id);
        if (Number.isFinite(numericId) && numericId >= 0) {
          setBaseIngredientId(numericId);
        }
      }
    }

    setIsBaseModalVisible(false);
    setBaseSearch('');
  }, [baseSearch, ingredients]);

  const normalizedBaseQuery = useMemo(() => baseSearch.trim().toLowerCase(), [baseSearch]);

  const filteredBaseIngredients = useMemo(() => {
    if (!normalizedBaseQuery) {
      return ingredients;
    }

    return ingredients.filter((ingredient) => {
      const nameNormalized = ingredient.searchNameNormalized ?? '';
      if (nameNormalized.startsWith(normalizedBaseQuery)) {
        return true;
      }

      return (ingredient.searchTokensNormalized ?? []).some((token) =>
        token.startsWith(normalizedBaseQuery),
      );
    });
  }, [ingredients, normalizedBaseQuery]);

  const handleSelectBaseIngredient = useCallback(
    (ingredient: Ingredient) => {
      const id = Number(ingredient.id ?? -1);
      if (!Number.isFinite(id) || id < 0) {
        return;
      }

      setBaseIngredientId(id);
      setBaseSearch('');
      setIsBaseModalVisible(false);
    },
    [],
  );

  const renderBaseIngredient = useCallback(
    ({ item }: { item: Ingredient }) => {
      const id = Number(item.id ?? -1);
      const isSelected = Number.isFinite(id) && id >= 0 && id === baseIngredientId;
      const tagColor = item.tags?.[0]?.color;

      return (
        <ListRow
          title={item.name ?? ''}
          onPress={() => handleSelectBaseIngredient(item)}
          selected={isSelected}
          highlightColor={appPalette.highlightSubtle}
          thumbnail={<Thumb label={item.name ?? undefined} uri={item.photoUri} />}
          tagColor={tagColor}
          accessibilityRole="button"
          accessibilityState={isSelected ? { selected: true } : undefined}
        />
      );
    },
    [baseIngredientId, handleSelectBaseIngredient],
  );

  const baseModalKeyExtractor = useCallback((item: Ingredient) => {
    if (item.id != null) {
      return String(item.id);
    }

    return item.name ?? '';
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'New ingredient' }} />
      <ScrollView
        contentContainerStyle={styles.content}
        style={styles.container}
        keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={[styles.label, { color: paletteColors.onSurfaceVariant }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="For example, Ginger syrup"
            style={[styles.input, { borderColor: paletteColors.outline, color: paletteColors.text }]}
            placeholderTextColor={`${paletteColors.onSurfaceVariant}99`}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={placeholderLabel}
          style={[styles.imagePlaceholder, { borderColor: paletteColors.outline }]} 
          onPress={handlePickImage}
          android_ripple={{ color: `${paletteColors.surface}33` }}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} contentFit="cover" />
          ) : (
            <View style={styles.placeholderContent}>
              <MaterialCommunityIcons name="image-plus" size={32} color={paletteColors.onSurfaceVariant} />
              <Text style={[styles.placeholderText, { color: paletteColors.onSurfaceVariant }]}>150 × 150</Text>
              <Text style={[styles.placeholderHint, { color: paletteColors.onSurfaceVariant }]}>
                Tap to add a photo
              </Text>
            </View>
          )}
        </Pressable>

        <View style={styles.section}>
          <Text style={[styles.label, { color: paletteColors.onSurfaceVariant }]}>Tags</Text>
          <Text style={[styles.hint, { color: paletteColors.onSurfaceVariant }]}>Select one or more tags</Text>
          <View style={styles.tagList}>
            {tagSelection.map((tag) => {
              const isSelected = tag.selected;
              const backgroundColor = isSelected ? tag.color : paletteColors.surface;
              const borderColor = tag.color;
              const textColor = isSelected ? Colors.surface : tag.color;

              return (
                <Pressable
                  key={tag.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  onPress={() => toggleTag(tag.id)}
                  style={[styles.tagChip, { backgroundColor, borderColor }]}
                  android_ripple={{ color: `${paletteColors.surface}33` }}>
                  <Text style={[styles.tagLabel, { color: textColor }]}>{tag.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: paletteColors.onSurfaceVariant }]}>Base ingredient</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={baseIngredient ? 'Change base ingredient' : 'Select base ingredient'}
            onPress={handleOpenBaseModal}
            style={[styles.baseSelector, { borderColor: paletteColors.outline, backgroundColor: paletteColors.surface }]}
          >
            {baseIngredient ? (
              <>
                <View style={styles.baseInfo}>
                  <View style={styles.baseThumb}>
                    {baseIngredientPhotoSource ? (
                      <Image source={baseIngredientPhotoSource} style={styles.baseImage} contentFit="contain" />
                    ) : (
                      <View
                        style={[styles.basePlaceholder, { backgroundColor: paletteColors.surfaceVariant }]}
                      >
                        <MaterialCommunityIcons
                          name="image-off"
                          size={20}
                          color={paletteColors.onSurfaceVariant}
                        />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.baseName, { color: paletteColors.onSurface }]} numberOfLines={2}>
                    {baseIngredient.name}
                  </Text>
                </View>
                <Pressable
                  onPress={handleClearBaseIngredient}
                  accessibilityRole="button"
                  accessibilityLabel="Remove base ingredient"
                  hitSlop={8}
                  style={styles.unlinkButton}
                >
                  <MaterialCommunityIcons
                    name="link-variant-off"
                    size={20}
                    color={paletteColors.error}
                  />
                </Pressable>
              </>
            ) : (
              <View style={styles.basePlaceholderRow}>
                <MaterialCommunityIcons
                  name="link-variant"
                  size={20}
                  color={paletteColors.onSurfaceVariant}
                />
                <Text style={[styles.basePlaceholderText, { color: paletteColors.onSurfaceVariant }]}>
                  Select a base ingredient
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: paletteColors.onSurfaceVariant }]}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Add tasting notes or usage suggestions"
            style={[styles.input, styles.multilineInput, { borderColor: paletteColors.outline, color: paletteColors.text }]}
            placeholderTextColor={`${paletteColors.onSurfaceVariant}99`}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <Pressable
          accessibilityRole="button"
          style={[styles.submitButton, { backgroundColor: paletteColors.tint }]}
          onPress={handleSubmit}
          disabled={isPickingImage}>
          <Text style={[styles.submitLabel, { color: paletteColors.surface }]}>Save</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={isBaseModalVisible}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={handleCloseBaseModal}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: paletteColors.backdrop }]} onPress={handleCloseBaseModal}>
          <Pressable
            onPress={(event) => event.stopPropagation?.()}
            style={[styles.modalCard, { backgroundColor: paletteColors.surface }]}
          >
            <TextInput
              value={baseSearch}
              onChangeText={setBaseSearch}
              placeholder="Search ingredients"
              placeholderTextColor={`${paletteColors.onSurfaceVariant}99`}
              style={[styles.modalSearchInput, { borderColor: paletteColors.outline, color: paletteColors.text }]}
              autoFocus
              keyboardAppearance="light"
            />
            <FlatList
              data={filteredBaseIngredients}
              keyExtractor={baseModalKeyExtractor}
              renderItem={renderBaseIngredient}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={[styles.modalSeparator, { backgroundColor: paletteColors.outline }]} />}
              contentContainerStyle={styles.modalListContent}
              ListEmptyComponent={() => (
                <Text style={[styles.modalEmptyText, { color: paletteColors.onSurfaceVariant }]}>No ingredients found</Text>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  content: {
    padding: 24,
    gap: 24,
  },
  section: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 14, default: 12 }),
    fontSize: 16,
    backgroundColor: Colors.surface,
  },
  multilineInput: {
    minHeight: 140,
  },
  imagePlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  placeholderHint: {
    fontSize: 12,
    textAlign: 'center',
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tagChip: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tagLabel: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  submitButton: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  baseSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
  },
  baseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  baseThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
  },
  baseImage: {
    width: '100%',
    height: '100%',
  },
  basePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  baseName: {
    fontSize: 16,
    fontWeight: '500',
  },
  basePlaceholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  basePlaceholderText: {
    fontSize: 15,
    fontWeight: '500',
  },
  unlinkButton: {
    padding: 6,
    borderRadius: 999,
  },
  modalOverlay: {
    flex: 1,
    paddingTop: 48,
    paddingBottom: 120,
    paddingHorizontal: 24,
    justifyContent: 'flex-start',
  },
  modalCard: {
    borderRadius: 24,
    padding: 16,
    gap: 16,
    flex: 1,
  },
  modalSearchInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 14, default: 12 }),
    fontSize: 16,
  },
  modalListContent: {
    gap: 12,
    flexGrow: 1,
    paddingBottom: 12,
  },
  modalSeparator: {
    height: StyleSheet.hairlineWidth,
  },
  modalEmptyText: {
    textAlign: 'center',
    fontSize: 15,
  },
});
