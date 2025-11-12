import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { TagPill } from '@/components/TagPill';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import { Colors } from '@/constants/theme';
import { useInventory, type Ingredient } from '@/providers/inventory-provider';
import { palette as appPalette } from '@/theme/theme';

function useResolvedIngredient(param: string | undefined, ingredients: Ingredient[]) {
  return useMemo(() => {
    if (!param) {
      return undefined;
    }

    const numericId = Number(param);
    if (!Number.isNaN(numericId)) {
      const byId = ingredients.find((item) => Number(item.id ?? -1) === numericId);
      if (byId) {
        return byId;
      }
    }

    const normalized = param.toLowerCase();
    return ingredients.find((item) => item.name?.toLowerCase() === normalized);
  }, [ingredients, param]);
}

export default function EditIngredientScreen() {
  const paletteColors = Colors;
  const { ingredientId } = useLocalSearchParams<{ ingredientId?: string }>();
  const { ingredients, shoppingIngredientIds, updateIngredient, deleteIngredient } =
    useInventory();

  const ingredient = useResolvedIngredient(
    Array.isArray(ingredientId) ? ingredientId[0] : ingredientId,
    ingredients,
  );

  const numericIngredientId = useMemo(() => {
    const candidate = ingredient?.id ?? (Array.isArray(ingredientId) ? ingredientId[0] : ingredientId);
    const parsed = Number(candidate);
    return Number.isNaN(parsed) ? undefined : parsed;
  }, [ingredient?.id, ingredientId]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [baseIngredientId, setBaseIngredientId] = useState<number | null>(null);
  const [isBaseModalVisible, setIsBaseModalVisible] = useState(false);
  const [baseSearch, setBaseSearch] = useState('');
  const [permissionStatus, requestPermission] = ImagePicker.useMediaLibraryPermissions();

  const didInitializeRef = useRef(false);

  useEffect(() => {
    if (!ingredient || didInitializeRef.current) {
      return;
    }

    didInitializeRef.current = true;
    setName(ingredient.name ?? '');
    setDescription(ingredient.description ?? '');
    setImageUri(ingredient.photoUri ?? null);
    setBaseIngredientId(
      ingredient.baseIngredientId != null ? Number(ingredient.baseIngredientId) : null,
    );

    const initialTagIds = (ingredient.tags ?? [])
      .map((tag) => Number(tag.id ?? -1))
      .filter((id) => Number.isFinite(id) && id >= 0) as number[];
    setSelectedTagIds(initialTagIds);
  }, [ingredient]);

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
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name is required', 'Please enter the ingredient name.');
      return;
    }

    if (numericIngredientId == null) {
      Alert.alert('Ingredient not found', 'Please try again later.');
      return;
    }

    const descriptionValue = description.trim();
    const selectedTags = selectedTagIds
      .map((tagId) => BUILTIN_INGREDIENT_TAGS.find((tag) => tag.id === tagId))
      .filter((tag): tag is (typeof BUILTIN_INGREDIENT_TAGS)[number] => Boolean(tag));

    const updated = updateIngredient(numericIngredientId, {
      name: trimmedName,
      description: descriptionValue || undefined,
      photoUri: imageUri ?? undefined,
      baseIngredientId,
      tags: selectedTags,
    });

    if (!updated) {
      Alert.alert('Could not save ingredient', 'Please try again later.');
      return;
    }

    router.back();
  }, [
    baseIngredientId,
    description,
    imageUri,
    name,
    numericIngredientId,
    selectedTagIds,
    updateIngredient,
  ]);

  const handleDeletePress = useCallback(() => {
    if (numericIngredientId == null) {
      Alert.alert('Ingredient not found', 'Please try again later.');
      return;
    }

    const trimmedName = ingredient?.name?.trim();
    const message = trimmedName
      ? `Are you sure you want to delete ${trimmedName}? This action cannot be undone.`
      : 'Are you sure you want to delete this ingredient? This action cannot be undone.';

    Alert.alert('Delete ingredient', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const wasDeleted = deleteIngredient(numericIngredientId);
          if (!wasDeleted) {
            Alert.alert('Could not delete ingredient', 'Please try again later.');
            return;
          }

          router.back();
        },
      },
    ]);
  }, [deleteIngredient, ingredient?.name, numericIngredientId]);

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

    if (/^https?:/i.test(baseIngredient.photoUri) || baseIngredient.photoUri.startsWith('file:')) {
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
      const match = baseIngredientOptions.find((item) =>
        item.name ? item.name.trim().toLowerCase() === normalized : false,
      );

      if (match?.id != null) {
        const baseId = Number(match.id);
        if (Number.isFinite(baseId) && baseId >= 0) {
          setBaseIngredientId(baseId);
        }
      }
    }

    setIsBaseModalVisible(false);
    setBaseSearch('');
  }, [baseIngredientOptions, baseSearch]);

  const normalizedBaseQuery = useMemo(() => baseSearch.trim().toLowerCase(), [baseSearch]);

  const baseIngredientOptions = useMemo(() => {
    const currentId = numericIngredientId;
    return ingredients.filter((item) => {
      const itemId = Number(item.id ?? -1);
      if (!Number.isFinite(itemId) || itemId < 0) {
        return false;
      }

      if (currentId != null && itemId === currentId) {
        return false;
      }

      if (baseIngredientId != null && itemId === baseIngredientId) {
        return true;
      }

      return item.baseIngredientId == null;
    });
  }, [baseIngredientId, ingredients, numericIngredientId]);

  const filteredBaseIngredients = useMemo(() => {
    if (!normalizedBaseQuery) {
      return baseIngredientOptions;
    }

    return baseIngredientOptions.filter((candidate) => {
      const nameNormalized = candidate.searchNameNormalized ?? '';
      if (nameNormalized.startsWith(normalizedBaseQuery)) {
        return true;
      }

      return (candidate.searchTokensNormalized ?? []).some((token) =>
        token.startsWith(normalizedBaseQuery),
      );
    });
  }, [baseIngredientOptions, normalizedBaseQuery]);

  const handleSelectBaseIngredient = useCallback(
    (candidate: Ingredient) => {
      const candidateId = Number(candidate.id ?? -1);
      if (!Number.isFinite(candidateId) || candidateId < 0) {
        return;
      }

      if (numericIngredientId != null && candidateId === numericIngredientId) {
        return;
      }

      setBaseIngredientId(candidateId);
      setBaseSearch('');
      setIsBaseModalVisible(false);
    },
    [numericIngredientId],
  );

  const renderBaseIngredient = useCallback(
    ({ item }: { item: Ingredient }) => {
      const id = Number(item.id ?? -1);
      const isSelected = Number.isFinite(id) && id >= 0 && id === baseIngredientId;
      const tagColor = item.tags?.[0]?.color;
      const isOnShoppingList = Number.isFinite(id) && id >= 0 && shoppingIngredientIds.has(id);

      const control = isOnShoppingList ? (
        <View style={styles.baseShoppingIndicator}>
          <MaterialIcons name="shopping-cart" size={20} color={paletteColors.tint} />
        </View>
      ) : undefined;

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
          control={control}
          metaAlignment="flex-start"
        />
      );
    },
    [
      baseIngredientId,
      handleSelectBaseIngredient,
      paletteColors.tint,
      shoppingIngredientIds,
    ],
  );

  const baseModalKeyExtractor = useCallback((item: Ingredient) => {
    if (item.id != null) {
      return String(item.id);
    }

    return item.name ?? '';
  }, []);

  const baseSearchInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (!isBaseModalVisible) {
      return;
    }

    const timeout = setTimeout(() => {
      baseSearchInputRef.current?.focus();
    }, Platform.OS === 'android' ? 50 : 0);

    return () => {
      clearTimeout(timeout);
    };
  }, [isBaseModalVisible]);

  const imageSource = useMemo(() => {
    if (!imageUri) {
      return undefined;
    }

    const asset = resolveAssetFromCatalog(imageUri);
    if (asset) {
      return asset;
    }

    if (/^https?:/i.test(imageUri) || imageUri.startsWith('file:')) {
      return { uri: imageUri } as const;
    }

    return undefined;
  }, [imageUri]);

  if (!ingredient) {
    return (
      <>
        <Stack.Screen options={{ title: 'Edit ingredient' }} />
        <View style={[styles.container, styles.emptyState]}>
          <Text style={[styles.emptyMessage, { color: paletteColors.onSurfaceVariant }]}>Ingredient not found</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit ingredient',
          headerRight: () => (
            <Pressable
              onPress={handleDeletePress}
              accessibilityRole="button"
              accessibilityLabel="Delete ingredient"
              style={[styles.headerButton, { backgroundColor: paletteColors.surfaceVariant }]}
              hitSlop={8}>
              <MaterialIcons name="delete-outline" size={22} color={paletteColors.onSurface} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        style={styles.container}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.card, styles.section]}>
          <Text style={[styles.label, { color: paletteColors.onSurfaceVariant }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="For example, Ginger syrup"
            style={[styles.input, { borderColor: paletteColors.outlineVariant, color: paletteColors.text }]}
            placeholderTextColor={`${paletteColors.onSurfaceVariant}99`}
          />
        </View>

        <View style={[styles.card, styles.mediaCard]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={placeholderLabel}
            style={[
              styles.imagePlaceholder,
              { borderColor: paletteColors.outline },
              !imageSource && { backgroundColor: paletteColors.surfaceVariant },
            ]}
            onPress={handlePickImage}
            android_ripple={{ color: `${paletteColors.surface}33` }}>
            {imageSource ? (
              <Image source={imageSource} style={styles.image} contentFit="contain" />
            ) : (
              <View style={styles.placeholderContent}>
                <Text style={[styles.placeholderHint, { color: paletteColors.onSurfaceVariant }]}>Tap to add a photo</Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={[styles.card, styles.section]}>
          <Text style={[styles.label, { color: paletteColors.onSurfaceVariant }]}>Tags</Text>
          <Text style={[styles.hint, { color: paletteColors.onSurfaceVariant }]}>Select one or more tags</Text>
          <View style={styles.tagList}>
            {tagSelection.map((tag) => (
              <TagPill
                key={tag.id}
                label={tag.name}
                color={tag.color}
                selected={tag.selected}
                onPress={() => toggleTag(tag.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: tag.selected }}
                androidRippleColor={`${paletteColors.surface}33`}
              />
            ))}
          </View>
        </View>

        <View style={[styles.card, styles.section]}>
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
                        style={[styles.basePlaceholder, { backgroundColor: paletteColors.onSurfaceVariant }]}
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
                    name="link-off"
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

        <View style={[styles.card, styles.section, styles.descriptionSection]}>
          <Text style={[styles.label, { color: paletteColors.onSurfaceVariant }]}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Add tasting notes or usage suggestions"
            style={[
              styles.input,
              styles.multilineInput,
              { borderColor: paletteColors.outlineVariant, color: paletteColors.text },
            ]}
            placeholderTextColor={`${paletteColors.onSurfaceVariant}99`}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Pressable
            accessibilityRole="button"
            style={[styles.submitButton, { backgroundColor: paletteColors.tint }]}
            onPress={handleSubmit}
            disabled={isPickingImage}>
            <Text style={[styles.submitLabel, { color: paletteColors.surface }]}>Save changes</Text>
          </Pressable>
        </View>
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
              ref={baseSearchInputRef}
              value={baseSearch}
              onChangeText={setBaseSearch}
              placeholder="Search ingredients"
              placeholderTextColor={`${paletteColors.onSurfaceVariant}99`}
              style={[
                styles.modalSearchInput,
                { borderColor: paletteColors.outlineVariant, color: paletteColors.text },
              ]}
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
    backgroundColor: Colors.background,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.outline,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 96,
    gap: 20,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.outline,
    shadowColor: appPalette.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  section: {
    gap: 16,
  },
  mediaCard: {
    padding: 16,
  },
  descriptionSection: {
    gap: 20,
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
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 14, default: 12 }),
    fontSize: 16,
    backgroundColor: Colors.surfaceBright,
  },
  multilineInput: {
    minHeight: 140,
  },
  imagePlaceholder: {
    width: '100%',
    minHeight: 220,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  placeholderHint: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  submitButton: {
    borderRadius: 16,
    paddingVertical: 16,
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
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
  },
  baseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  baseThumb: {
    width: 52,
    height: 52,
    borderRadius: 16,
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
  baseShoppingIndicator: {
    minHeight: 56,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  unlinkButton: {
    padding: 8,
    borderRadius: 16,
  },
  modalOverlay: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    borderRadius: 28,
    padding: 20,
    gap: 20,
    width: '100%',
    maxWidth: 480,
    maxHeight: 520,
    shadowColor: appPalette.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  modalSearchInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 14, default: 12 }),
    fontSize: 16,
  },
  modalListContent: {
    gap: 12,
    flexGrow: 1,
    paddingBottom: 8,
  },
  modalSeparator: {
    height: StyleSheet.hairlineWidth,
  },
  modalEmptyText: {
    textAlign: 'center',
    fontSize: 15,
  },
  emptyState: {
    flex: 1,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyMessage: {
    fontSize: 16,
    textAlign: 'center',
  },
});
