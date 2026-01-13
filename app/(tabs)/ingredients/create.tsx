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
import { TagEditorModal } from '@/components/TagEditorModal';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import { Colors } from '@/constants/theme';
import { resolveImageSource } from '@/libs/image-source';
import { skipDuplicateBack } from '@/libs/navigation';
import { shouldStorePhoto, storePhoto } from '@/libs/photo-storage';
import { normalizeSearchText } from '@/libs/search-normalization';
import { useInventory, type Ingredient } from '@/providers/inventory-provider';
import { useUnsavedChanges } from '@/providers/unsaved-changes-provider';

type IngredientFormSnapshot = {
  name: string;
  description: string;
  imageUri: string | null;
  baseIngredientId: number | null;
  selectedTagIds: number[];
};

export default function CreateIngredientScreen() {
  const params = useLocalSearchParams<{
    suggestedName?: string;
    returnTo?: string;
    returnToPath?: string;
    returnToParams?: string;
  }>();
  const suggestedNameParam = useMemo(() => {
    const value = Array.isArray(params.suggestedName) ? params.suggestedName[0] : params.suggestedName;
    return typeof value === 'string' ? value : undefined;
  }, [params.suggestedName]);
  const returnToPathParam = useMemo(() => {
    const value = Array.isArray(params.returnToPath) ? params.returnToPath[0] : params.returnToPath;
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }, [params.returnToPath]);
  const returnToParamsParam = useMemo(() => {
    const value = Array.isArray(params.returnToParams) ? params.returnToParams[0] : params.returnToParams;
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }, [params.returnToParams]);
  const legacyReturnToParam = useMemo(() => {
    const value = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
    return value === 'cocktail-form' ? value : undefined;
  }, [params.returnTo]);
  const returnToPath = useMemo(() => {
    if (returnToPathParam) {
      return returnToPathParam;
    }
    if (legacyReturnToParam === 'cocktail-form') {
      return '/cocktails/create';
    }
    return undefined;
  }, [legacyReturnToParam, returnToPathParam]);
  const returnToParams = useMemo(() => {
    if (!returnToParamsParam) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(returnToParamsParam);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return undefined;
      }

      const entries = Object.entries(parsed).filter(([, value]) => typeof value === 'string');
      return entries.length ? Object.fromEntries(entries) : undefined;
    } catch (error) {
      console.warn('Failed to parse return params', error);
      return undefined;
    }
  }, [returnToParamsParam]);

  const navigation = useNavigation();
  const {
    ingredients,
    shoppingIngredientIds,
    availableIngredientIds,
    createIngredient,
    updateIngredient,
    customIngredientTags,
    createCustomIngredientTag,
  } = useInventory();
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const [name, setName] = useState(() => suggestedNameParam ?? '');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [isTagModalVisible, setTagModalVisible] = useState(false);
  const [baseIngredientId, setBaseIngredientId] = useState<number | null>(null);
  const [isBaseModalVisible, setIsBaseModalVisible] = useState(false);
  const [baseSearch, setBaseSearch] = useState('');
  const [permissionStatus, requestPermission] = ImagePicker.useMediaLibraryPermissions();
  const [dialogOptions, setDialogOptions] = useState<DialogOptions | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const isNavigatingAfterSaveRef = useRef(false);
  const [initialSnapshot, setInitialSnapshot] = useState<IngredientFormSnapshot | null>(null);
  const isHandlingBackRef = useRef(false);

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

  const availableIngredientTags = useMemo(() => {
    const sortedCustom = [...customIngredientTags].sort((a, b) =>
      (a.name ?? '').localeCompare(b.name ?? ''),
    );
    return [...BUILTIN_INGREDIENT_TAGS, ...sortedCustom];
  }, [customIngredientTags]);

  const tagSelection = useMemo(() => {
    const set = new Set(selectedTagIds);
    return availableIngredientTags.map((tag) => ({
      ...tag,
      selected: set.has(tag.id),
    }));
  }, [availableIngredientTags, selectedTagIds]);

  const handleOpenTagModal = useCallback(() => {
    setTagModalVisible(true);
  }, []);

  const handleCloseTagModal = useCallback(() => {
    setTagModalVisible(false);
  }, []);

  const handleCreateTag = useCallback(
    (data: { name: string; color: string }) => {
      const created = createCustomIngredientTag(data);
      if (created?.id != null) {
        setSelectedTagIds((prev) => (prev.includes(created.id) ? prev : [...prev, created.id]));
      }
      setTagModalVisible(false);
    },
    [createCustomIngredientTag],
  );

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

  const handleSubmit = useCallback(async () => {
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
      .map((tagId) => availableIngredientTags.find((tag) => tag.id === tagId))
      .filter((tag): tag is (typeof availableIngredientTags)[number] => Boolean(tag));

    const shouldProcessPhoto = shouldStorePhoto(imageUri);
    const submission = {
      name: trimmedName,
      description: descriptionValue || undefined,
      photoUri: shouldProcessPhoto ? undefined : imageUri ?? undefined,
      baseIngredientId,
      tags: selectedTags,
    };

    let created = createIngredient(submission);

    if (!created) {
      showDialog({
        title: 'Could not save ingredient',
        message: 'Please try again later.',
        actions: [{ label: 'OK' }],
      });
      return;
    }

    if (shouldProcessPhoto && imageUri && created.id != null) {
      const storedPhotoUri = await storePhoto({
        uri: imageUri,
        id: created.id,
        name: trimmedName,
        category: 'ingredients',
      });

      if (storedPhotoUri && storedPhotoUri !== created.photoUri) {
        const updated = updateIngredient(Number(created.id), {
          ...submission,
          photoUri: storedPhotoUri,
        });
        if (updated) {
          created = updated;
        }
      }
    }

    setHasUnsavedChanges(false);
    isNavigatingAfterSaveRef.current = true;
    const targetId = created.id ?? created.name;
    if (!targetId) {
      skipDuplicateBack(navigation);
      return;
    }

    if (returnToPath) {
      router.navigate({ pathname: returnToPath, params: returnToParams });
      return;
    }

    router.replace({
      pathname: '/ingredients/[ingredientId]',
      params: { ingredientId: String(targetId) },
    });
  }, [
    availableIngredientTags,
    baseIngredientId,
    createIngredient,
    description,
    imageUri,
    name,
    returnToParams,
    returnToPath,
    setHasUnsavedChanges,
    showDialog,
    selectedTagIds,
    shouldStorePhoto,
    storePhoto,
    updateIngredient,
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
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (isNavigatingAfterSaveRef.current || isHandlingBackRef.current) {
        return;
      }

      if (hasUnsavedChanges) {
        event.preventDefault();
        confirmLeave(() => {
          isHandlingBackRef.current = true;
          if (event.data.action.type === 'GO_BACK') {
            skipDuplicateBack(navigation);
          } else {
            navigation.dispatch(event.data.action);
          }
          setTimeout(() => {
            isHandlingBackRef.current = false;
          }, 0);
        });
        return;
      }

      if (event.data.action.type === 'GO_BACK') {
        event.preventDefault();
        isHandlingBackRef.current = true;
        skipDuplicateBack(navigation);
        setTimeout(() => {
          isHandlingBackRef.current = false;
        }, 0);
      }
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
    const normalized = normalizeSearchText(baseSearch);
    if (normalized) {
      const match = baseIngredientOptions.find((item) =>
        item.name ? normalizeSearchText(item.name) === normalized : false,
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

  const normalizedBaseQuery = useMemo(() => normalizeSearchText(baseSearch), [baseSearch]);

  const baseIngredientOptions = useMemo(
    () => ingredients.filter((ingredient) => ingredient.baseIngredientId == null),
    [ingredients],
  );

  const filteredBaseIngredients = useMemo(() => {
    if (!normalizedBaseQuery) {
      return baseIngredientOptions;
    }

    return baseIngredientOptions.filter((ingredient) => {
      const nameNormalized = ingredient.searchNameNormalized ?? normalizeSearchText(ingredient.name ?? '');
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
          <MaterialIcons name="shopping-cart" size={20} color={Colors.tint} />
        </View>
      ) : undefined;

      return (
        <ListRow
          title={item.name ?? ''}
          onPress={() => handleSelectBaseIngredient(item)}
          selected={isAvailable}
          highlightColor={Colors.highlightFaint}
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
      Colors.tint,
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
    skipDuplicateBack(navigation);
  }, [navigation]);

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
          headerStyle: { backgroundColor: Colors.surface },
          headerShadowVisible: false,
          headerTitleStyle: { color: Colors.onSurface, fontSize: 16, fontWeight: '600' },
          headerLeft: () => (
            <Pressable
              onPress={handleGoBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.headerButton}
              hitSlop={8}>
              <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.onSurface} />
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
          style={[styles.container, { backgroundColor: Colors.background }]}
          keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <Text style={[styles.label, { color: Colors.onSurface }]}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Ginger syrup"
              style={[
                styles.input,
                { borderColor: Colors.outlineVariant, color: Colors.text, backgroundColor: Colors.surface },
              ]}
              placeholderTextColor={`${Colors.onSurfaceVariant}99`}
            />
          </View>

          <View style={styles.photoTileWrapper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={placeholderLabel}
              style={[
                styles.imagePlaceholder,
                { borderColor: Colors.outlineVariant },
                !imageUri && { backgroundColor: Colors.surface },
              ]}
              onPress={handlePickImage}
              android_ripple={{ color: `${Colors.surface}33` }}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.image} contentFit="contain" />
              ) : (
                <View style={styles.placeholderContent}>
                  <MaterialCommunityIcons name="image-plus" size={28} color={`${Colors.onSurfaceVariant}99`} />
                  <Text style={[styles.placeholderHint, { color: `${Colors.onSurfaceVariant}99` }]}>
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
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={Colors.error} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.section}>
            <View style={styles.tagHeader}>
              <Text style={[styles.label, { color: Colors.onSurface }]}>Tags</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create tag"
                onPress={handleOpenTagModal}
                style={[styles.tagAddButton, { borderColor: Colors.outlineVariant }]}>
                <MaterialCommunityIcons name="plus" size={16} color={Colors.tint} />
                <Text style={[styles.tagAddLabel, { color: Colors.tint }]}>Create tag</Text>
              </Pressable>
            </View>
            <Text style={[styles.hint, { color: Colors.onSurfaceVariant }]}>Select one or more tags</Text>
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
                  androidRippleColor={`${Colors.surface}33`}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: Colors.onSurface }]}>Base ingredient</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={baseIngredient ? 'Change base ingredient' : 'Select base ingredient'}
              onPress={handleOpenBaseModal}
              style={[styles.baseSelector, { borderColor: Colors.outlineVariant, backgroundColor: Colors.surface }]}>
              {baseIngredient ? (
                <>
                  <View style={styles.baseInfo}>
                    <View style={styles.baseThumb}>
                      {baseIngredientPhotoSource ? (
                        <Image source={baseIngredientPhotoSource} style={styles.baseImage} contentFit="contain" />
                      ) : (
                        <View style={[styles.basePlaceholder, { backgroundColor: Colors.onSurfaceVariant }]}>
                          <MaterialCommunityIcons name="image-off" size={20} color={Colors.onSurfaceVariant} />
                        </View>
                      )}
                    </View>
                    <Text style={[styles.baseName, { color: Colors.onSurface }]} numberOfLines={2}>
                      {baseIngredient.name}
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleClearBaseIngredient}
                    accessibilityRole="button"
                    accessibilityLabel="Remove base ingredient"
                    hitSlop={8}
                    style={styles.unlinkButton}>
                    <MaterialCommunityIcons name="link-off" size={20} color={Colors.error} />
                  </Pressable>
                </>
              ) : (
                <View style={styles.basePlaceholderRow}>
                  
                  <Text style={[styles.basePlaceholderText, { color: Colors.onSurfaceVariant }]}>
                    None
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          <View style={[styles.section, styles.descriptionSection]}>
            <Text style={[styles.label, { color: Colors.onSurface }]}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Add tasting notes or usage suggestions"
              style={[
                styles.input,
                styles.multilineInput,
                { borderColor: Colors.outlineVariant, color: Colors.text, backgroundColor: Colors.surface },
              ]}
              placeholderTextColor={`${Colors.onSurfaceVariant}99`}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              onFocus={(event) => scrollFieldIntoView(event.nativeEvent.target)}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            style={[styles.submitButton, { backgroundColor: Colors.tint }]}
            onPress={handleSubmit}
            disabled={isPickingImage}>
            <Text style={[styles.submitLabel, { color: Colors.onPrimary }]}>Save</Text>
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
                backgroundColor: Colors.surface,
                borderColor: Colors.outline,
                shadowColor: Colors.shadow,
              },
            ]}
            accessibilityRole="menu"
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: Colors.onSurface }]}>Select base ingredient</Text>
              <Pressable onPress={handleCloseBaseModal} accessibilityRole="button" accessibilityLabel="Close">
                <MaterialCommunityIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </Pressable>
            </View>
            <TextInput
              ref={baseSearchInputRef}
              value={baseSearch}
              onChangeText={setBaseSearch}
              placeholder="Search ingredients"
              placeholderTextColor={`${Colors.onSurfaceVariant}99`}
              style={[
                styles.modalSearchInput,
                { borderColor: Colors.outlineVariant, color: Colors.text, backgroundColor: Colors.surfaceBright },
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
                const backgroundColor = isAvailable ? Colors.outline : Colors.outlineVariant;
                return <View style={[styles.modalSeparator, { backgroundColor }]} />;
              }}
              contentContainerStyle={styles.modalListContent}
              ListEmptyComponent={() => (
                <Text style={[styles.modalEmptyText, { color: Colors.onSurfaceVariant }]}>No ingredients found</Text>
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

      <TagEditorModal
        visible={isTagModalVisible}
        title="New tag"
        confirmLabel="Create"
        onClose={handleCloseTagModal}
        onSave={handleCreateTag}
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
  tagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  tagAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tagAddLabel: {
    fontSize: 12,
    fontWeight: '600',
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
