import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
  findNodeHandle,
  type GestureResponderEvent,
} from 'react-native';

import { AppDialog, type DialogOptions } from '@/components/AppDialog';
import { ListRow, Thumb } from '@/components/RowParts';
import { TagPill } from '@/components/TagPill';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import { Colors } from '@/constants/theme';
import { resolveImageSource } from '@/libs/image-source';
import { useInventory, type Ingredient } from '@/providers/inventory-provider';
import { useUnsavedChanges } from '@/providers/unsaved-changes-provider';
import { palette as appPalette } from '@/theme/theme';

type IngredientFormSnapshot = {
  name: string;
  description: string;
  imageUri: string | null;
  baseIngredientId: number | null;
  selectedTagIds: number[];
};

export default function CreateIngredientScreen() {
  const params = useLocalSearchParams<{ suggestedName?: string; returnTo?: string }>();
  const suggestedNameParam = useMemo(() => {
    const value = Array.isArray(params.suggestedName) ? params.suggestedName[0] : params.suggestedName;
    return typeof value === 'string' ? value : undefined;
  }, [params.suggestedName]);
  const returnToParam = useMemo(() => {
    const value = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
    return value === 'cocktail-form' ? value : undefined;
  }, [params.returnTo]);

  const navigation = useNavigation();
  const palette = Colors;
  const { ingredients, shoppingIngredientIds, availableIngredientIds, createIngredient } = useInventory();
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const [name, setName] = useState(() => suggestedNameParam ?? '');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [baseIngredientId, setBaseIngredientId] = useState<number | null>(null);
  const [isBaseModalVisible, setIsBaseModalVisible] = useState(false);
  const [baseSearch, setBaseSearch] = useState('');
  const [permissionStatus, requestPermission] = ImagePicker.useMediaLibraryPermissions();
  const [dialogOptions, setDialogOptions] = useState<DialogOptions | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const isNavigatingAfterSaveRef = useRef(false);
  const [initialSnapshot, setInitialSnapshot] = useState<IngredientFormSnapshot | null>(null);

  useEffect(() => {
    if (suggestedNameParam && !name) {
      setName(suggestedNameParam);
    }
  }, [name, suggestedNameParam]);

  const closeDialog = useCallback(() => {
    setDialogOptions(null);
  }, []);

  const showDialog = useCallback((options: DialogOptions) => {
    setDialogOptions(options);
  }, []);

  const buildSnapshot = useCallback((): IngredientFormSnapshot => {
    const normalizedTags = [...selectedTagIds].sort((a, b) => a - b);
    return {
      name,
      description,
      imageUri,
      baseIngredientId,
      selectedTagIds: normalizedTags,
    };
  }, [baseIngredientId, description, imageUri, name, selectedTagIds]);

  useEffect(() => {
    if (initialSnapshot) {
      return;
    }

    setInitialSnapshot(buildSnapshot());
  }, [buildSnapshot, initialSnapshot]);

  const hasUnsavedChanges = useMemo(() => {
    if (!initialSnapshot) {
      return false;
    }

    return JSON.stringify(buildSnapshot()) !== JSON.stringify(initialSnapshot);
  }, [buildSnapshot, initialSnapshot]);

  useEffect(() => {
    setHasUnsavedChanges(hasUnsavedChanges);
  }, [hasUnsavedChanges, setHasUnsavedChanges]);

  useEffect(() => () => setHasUnsavedChanges(false), [setHasUnsavedChanges]);

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
      showDialog({
        title: 'Media library access',
        message: 'Enable photo library permissions in system settings to add an ingredient image.',
        actions: [{ label: 'OK' }],
      });
    }

    return false;
  }, [permissionStatus?.granted, requestPermission, showDialog]);

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
      showDialog({
        title: 'Could not pick image',
        message: 'Please try again later.',
        actions: [{ label: 'OK' }],
      });
    } finally {
      setIsPickingImage(false);
    }
  }, [ensureMediaPermission, isPickingImage, showDialog]);

  const handleSubmit = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showDialog({
        title: 'Name is required',
        message: 'Please enter the ingredient name.',
        actions: [{ label: 'OK' }],
      });
      return;
    }

    const descriptionValue = description.trim();
    const selectedTags = selectedTagIds
      .map((tagId) => BUILTIN_INGREDIENT_TAGS.find((tag) => tag.id === tagId))
      .filter((tag): tag is (typeof BUILTIN_INGREDIENT_TAGS)[number] => Boolean(tag));

    const created = createIngredient({
      name: trimmedName,
      description: descriptionValue || undefined,
      photoUri: imageUri ?? undefined,
      baseIngredientId,
      tags: selectedTags,
    });

    if (!created) {
      showDialog({
        title: 'Could not save ingredient',
        message: 'Please try again later.',
        actions: [{ label: 'OK' }],
      });
      return;
    }

    setHasUnsavedChanges(false);
    isNavigatingAfterSaveRef.current = true;
    const targetId = created.id ?? created.name;
    if (!targetId) {
      router.back();
      return;
    }

    if (returnToParam === 'cocktail-form') {
      router.back();
      return;
    }

    router.replace({
      pathname: '/ingredients/[ingredientId]',
      params: { ingredientId: String(targetId) },
    });
  }, [
    baseIngredientId,
    createIngredient,
    description,
    imageUri,
    name,
    returnToParam,
    setHasUnsavedChanges,
    showDialog,
    selectedTagIds,
  ]);

  const confirmLeave = useCallback(
    (onLeave: () => void) => {
      showDialog({
        title: 'Leave without saving?',
        message: 'Your changes will be lost if you leave this screen.',
        actions: [
          { label: 'Save', onPress: handleSubmit },
          { label: 'Stay', variant: 'secondary' },
          {
            label: 'Leave',
            variant: 'destructive',
            onPress: () => {
              setHasUnsavedChanges(false);
              onLeave();
            },
          },
        ],
      });
    },
    [handleSubmit, setHasUnsavedChanges, showDialog],
  );

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (!hasUnsavedChanges || isNavigatingAfterSaveRef.current) {
        return;
      }

      event.preventDefault();
      confirmLeave(() => navigation.dispatch(event.data.action));
    });

    return unsubscribe;
  }, [confirmLeave, hasUnsavedChanges, navigation]);

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

  const baseIngredientPhotoSource = useMemo(
    () => resolveImageSource(baseIngredient?.photoUri),
    [baseIngredient?.photoUri],
  );

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
        const numericId = Number(match.id);
        if (Number.isFinite(numericId) && numericId >= 0) {
          setBaseIngredientId(numericId);
        }
      }
    }

    setIsBaseModalVisible(false);
    setBaseSearch('');
  }, [baseIngredientOptions, baseSearch]);

  const normalizedBaseQuery = useMemo(() => baseSearch.trim().toLowerCase(), [baseSearch]);

  const baseIngredientOptions = useMemo(
    () => ingredients.filter((ingredient) => ingredient.baseIngredientId == null),
    [ingredients],
  );

  const filteredBaseIngredients = useMemo(() => {
    if (!normalizedBaseQuery) {
      return baseIngredientOptions;
    }

    return baseIngredientOptions.filter((ingredient) => {
      const nameNormalized = ingredient.searchNameNormalized ?? '';
      if (nameNormalized.startsWith(normalizedBaseQuery)) {
        return true;
      }

      return (ingredient.searchTokensNormalized ?? []).some((token) =>
        token.startsWith(normalizedBaseQuery),
      );
    });
  }, [baseIngredientOptions, normalizedBaseQuery]);

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
      const isOnShoppingList = Number.isFinite(id) && id >= 0 && shoppingIngredientIds.has(id);
      const isAvailable = Number.isFinite(id) && id >= 0 && availableIngredientIds.has(id);

      const control = isOnShoppingList ? (
        <View style={styles.baseShoppingIndicator}>
          <MaterialIcons name="shopping-cart" size={20} color={palette.tint} />
        </View>
      ) : undefined;

      return (
        <ListRow
          title={item.name ?? ''}
          onPress={() => handleSelectBaseIngredient(item)}
          selected={isAvailable}
          highlightColor={appPalette.highlightFaint}
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
      availableIngredientIds,
      baseIngredientId,
      handleSelectBaseIngredient,
      palette.tint,
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

  const handleGoBack = useCallback(() => {
    router.back();
  }, []);

  const handleRemoveImage = useCallback(() => {
    setImageUri(null);
  }, []);

  const scrollFieldIntoView = useCallback((target?: number | null) => {
    if (target == null) {
      return;
    }

    const scrollNodeHandle = scrollRef.current?.getInnerViewNode
      ? findNodeHandle(scrollRef.current.getInnerViewNode())
      : findNodeHandle(scrollRef.current);
    if (!scrollNodeHandle) {
      return;
    }

    UIManager.measureLayout(
      target,
      scrollNodeHandle,
      () => {},
      (_x, y) => {
        const HEADER_OFFSET = 56;
        const targetOffset = Math.max(0, y - HEADER_OFFSET);
        scrollRef.current?.scrollTo({ y: targetOffset, animated: true });
      },
    );
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Add ingredient',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: palette.surface },
          headerShadowVisible: false,
          headerTitleStyle: { color: palette.onSurface, fontSize: 16, fontWeight: '600' },
          headerLeft: () => (
            <Pressable
              onPress={handleGoBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.headerButton}
              hitSlop={8}>
              <MaterialCommunityIcons name="arrow-left" size={22} color={palette.onSurface} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.select({ ios: 96, default: 0 })}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          style={[styles.container, { backgroundColor: palette.background }]}
          keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <Text style={[styles.label, { color: palette.onSurface }]}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Ginger syrup"
              style={[
                styles.input,
                { borderColor: palette.outlineVariant, color: palette.text, backgroundColor: palette.surface },
              ]}
              placeholderTextColor={`${palette.onSurfaceVariant}99`}
            />
          </View>

          <View style={styles.photoTileWrapper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={placeholderLabel}
              style={[
                styles.imagePlaceholder,
                { borderColor: palette.outlineVariant },
                !imageUri && { backgroundColor: palette.surface },
              ]}
              onPress={handlePickImage}
              android_ripple={{ color: `${palette.surface}33` }}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.image} contentFit="contain" />
              ) : (
                <View style={styles.placeholderContent}>
                  <MaterialCommunityIcons name="image-plus" size={28} color={`${palette.onSurfaceVariant}99`} />
                  <Text style={[styles.placeholderHint, { color: `${palette.onSurfaceVariant}99` }]}>
                    Tap to add a photo
                  </Text>
                </View>
              )}
            </Pressable>
            {imageUri ? (
              <Pressable
                onPress={handleRemoveImage}
                hitSlop={8}
                style={styles.removePhotoButton}
                accessibilityRole="button"
                accessibilityLabel="Remove photo">
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={palette.error} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: palette.onSurface }]}>Tags</Text>
            <Text style={[styles.hint, { color: palette.onSurfaceVariant }]}>Select one or more tags</Text>
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
                  androidRippleColor={`${palette.surface}33`}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: palette.onSurface }]}>Base ingredient</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={baseIngredient ? 'Change base ingredient' : 'Select base ingredient'}
              onPress={handleOpenBaseModal}
              style={[styles.baseSelector, { borderColor: palette.outlineVariant, backgroundColor: palette.surface }]}>
              {baseIngredient ? (
                <>
                  <View style={styles.baseInfo}>
                    <View style={styles.baseThumb}>
                      {baseIngredientPhotoSource ? (
                        <Image source={baseIngredientPhotoSource} style={styles.baseImage} contentFit="contain" />
                      ) : (
                        <View style={[styles.basePlaceholder, { backgroundColor: palette.onSurfaceVariant }]}>
                          <MaterialCommunityIcons name="image-off" size={20} color={palette.onSurfaceVariant} />
                        </View>
                      )}
                    </View>
                    <Text style={[styles.baseName, { color: palette.onSurface }]} numberOfLines={2}>
                      {baseIngredient.name}
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleClearBaseIngredient}
                    accessibilityRole="button"
                    accessibilityLabel="Remove base ingredient"
                    hitSlop={8}
                    style={styles.unlinkButton}>
                    <MaterialCommunityIcons name="link-off" size={20} color={palette.error} />
                  </Pressable>
                </>
              ) : (
                <View style={styles.basePlaceholderRow}>
                  
                  <Text style={[styles.basePlaceholderText, { color: palette.onSurfaceVariant }]}>
                    None
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          <View style={[styles.section, styles.descriptionSection]}>
            <Text style={[styles.label, { color: palette.onSurface }]}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Add tasting notes or usage suggestions"
              style={[
                styles.input,
                styles.multilineInput,
                { borderColor: palette.outlineVariant, color: palette.text, backgroundColor: palette.surface },
              ]}
              placeholderTextColor={`${palette.onSurfaceVariant}99`}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              onFocus={(event) => scrollFieldIntoView(event.nativeEvent.target)}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            style={[styles.submitButton, { backgroundColor: palette.tint }]}
            onPress={handleSubmit}
            disabled={isPickingImage}>
            <Text style={[styles.submitLabel, { color: palette.onPrimary }]}>Save</Text>
          </Pressable>
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={isBaseModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseBaseModal}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCloseBaseModal} accessibilityRole="button">
          <Pressable
            onPress={(event) => event.stopPropagation?.()}
            style={[
              styles.modalCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.outline,
                shadowColor: palette.shadow,
              },
            ]}
            accessibilityRole="menu"
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.onSurface }]}>Select base ingredient</Text>
              <Pressable onPress={handleCloseBaseModal} accessibilityRole="button" accessibilityLabel="Close">
                <MaterialCommunityIcons name="close" size={22} color={palette.onSurfaceVariant} />
              </Pressable>
            </View>
            <TextInput
              ref={baseSearchInputRef}
              value={baseSearch}
              onChangeText={setBaseSearch}
              placeholder="Search ingredients"
              placeholderTextColor={`${palette.onSurfaceVariant}99`}
              style={[
                styles.modalSearchInput,
                { borderColor: palette.outlineVariant, color: palette.text, backgroundColor: palette.surfaceBright },
              ]}
              autoFocus
              keyboardAppearance="light"
            />
            <FlatList
              data={filteredBaseIngredients}
              keyExtractor={baseModalKeyExtractor}
              renderItem={renderBaseIngredient}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={({ leadingItem }) => {
                const ingredientId = Number((leadingItem as Ingredient | null)?.id ?? -1);
                const isAvailable = ingredientId >= 0 && availableIngredientIds.has(ingredientId);
                const backgroundColor = isAvailable ? palette.outline : palette.outlineVariant;
                return <View style={[styles.modalSeparator, { backgroundColor }]} />;
              }}
              contentContainerStyle={styles.modalListContent}
              ListEmptyComponent={() => (
                <Text style={[styles.modalEmptyText, { color: palette.onSurfaceVariant }]}>No ingredients found</Text>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <AppDialog
        visible={dialogOptions != null}
        title={dialogOptions?.title ?? ''}
        message={dialogOptions?.message}
        actions={dialogOptions?.actions ?? []}
        onRequestClose={closeDialog}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    gap: 20,
  },
  section: {
    gap: 10,
  },
  descriptionSection: {
    paddingBottom: 0,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 14,
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
    minHeight: 120,
  },
  imagePlaceholder: {
    width: 150,
    height: 150,
    maxWidth: 150,
    maxHeight: 150,
    minWidth: 150,
    minHeight: 150,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    flexShrink: 0,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  photoTileWrapper: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    position: 'relative',
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
  bottomSpacer: {
    height: 250,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
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
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 14, default: 12 }),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
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
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  baseImage: {
    width: '100%',
    height: '100%',
  },
  basePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  baseName: {
    fontSize: 16,
    fontWeight: '400',
  },
  basePlaceholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  basePlaceholderText: {
    fontSize: 14,
    fontWeight: '500',
  },
  baseShoppingIndicator: {
    minHeight: 56,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  unlinkButton: {
    padding: 6,
    borderRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    width: '100%',
    maxHeight: '92%',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  modalSearchInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 14, default: 12 }),
    fontSize: 16,
  },
  modalListContent: {
    flexGrow: 1,
    paddingVertical: 8,
  },
  modalSeparator: {
    height: StyleSheet.hairlineWidth,
  },
  modalEmptyText: {
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 24,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
});
