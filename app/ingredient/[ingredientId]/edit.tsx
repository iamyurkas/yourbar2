import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NavigationAction } from '@react-navigation/native';

import { resolveAssetFromCatalog } from '@/assets/image-manifest';
import { Thumb } from '@/components/RowParts';
import { TagPill } from '@/components/TagPill';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import { Colors } from '@/constants/theme';
import { useKeyboardHeight } from '@/libs/useKeyboardHeight';
import { useInventory, type Ingredient } from '@/providers/inventory-provider';

type SectionKey = 'name' | 'description' | 'tags';

type InitialState = {
  name: string;
  description: string;
  imageUri: string | null;
  baseIngredientId: number | null;
  tags: number[];
};

const SECTION_PADDING = 24;

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
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { ingredients, shoppingIngredientIds, updateIngredient, deleteIngredient } = useInventory();

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
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [baseIngredientId, setBaseIngredientId] = useState<number | null>(null);
  const [isBaseModalVisible, setIsBaseModalVisible] = useState(false);
  const [baseSearch, setBaseSearch] = useState('');
  const [isTagManagerVisible, setIsTagManagerVisible] = useState(false);
  const [isTagInfoVisible, setIsTagInfoVisible] = useState(false);
  const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState(false);
  const [isUnsavedDialogVisible, setIsUnsavedDialogVisible] = useState(false);
  const [permissionStatus, requestPermission] = ImagePicker.useMediaLibraryPermissions();

  const [isDirty, setIsDirty] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const baseSearchInputRef = useRef<TextInput | null>(null);
  const sectionPositions = useRef<Record<SectionKey, number>>({
    name: 0,
    description: 0,
    tags: 0,
  });
  const pendingNavigationActionRef = useRef<NavigationAction | null>(null);
  const afterSaveActionRef = useRef<NavigationAction | 'back' | null>('back');
  const initialStateRef = useRef<InitialState>({
    name: '',
    description: '',
    imageUri: null,
    baseIngredientId: null,
    tags: [],
  });

  useEffect(() => {
    if (!ingredient) {
      return;
    }

    setName(ingredient.name ?? '');
    setDescription(ingredient.description ?? '');
    setImageUri(ingredient.photoUri ?? null);
    setBaseIngredientId(ingredient.baseIngredientId != null ? Number(ingredient.baseIngredientId) : null);

    const initialTagIds = (ingredient.tags ?? [])
      .map((tag) => Number(tag.id ?? -1))
      .filter((id) => Number.isFinite(id) && id >= 0) as number[];
    const sortedInitial = initialTagIds.slice().sort((a, b) => a - b);
    setSelectedTagIds(sortedInitial);
    initialStateRef.current = {
      name: (ingredient.name ?? '').trim(),
      description: (ingredient.description ?? '').trim(),
      imageUri: ingredient.photoUri ?? null,
      baseIngredientId: ingredient.baseIngredientId != null ? Number(ingredient.baseIngredientId) : null,
      tags: sortedInitial,
    };
    setIsDirty(false);
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

  const selectedTags = useMemo(
    () => BUILTIN_INGREDIENT_TAGS.filter((tag) => selectedTagIds.includes(tag.id)),
    [selectedTagIds],
  );

  const availableTags = useMemo(
    () => BUILTIN_INGREDIENT_TAGS.filter((tag) => !selectedTagIds.includes(tag.id)),
    [selectedTagIds],
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

  const sortedSelectedTagIds = useMemo(() => selectedTagIds.slice().sort((a, b) => a - b), [
    selectedTagIds,
  ]);

  useEffect(() => {
    const initial = initialStateRef.current;
    const normalizedName = name.trim();
    const normalizedDescription = description.trim();
    const normalizedImage = imageUri ?? null;
    const normalizedBaseId = baseIngredientId ?? null;
    const tagsDirty =
      sortedSelectedTagIds.length !== initial.tags.length ||
      sortedSelectedTagIds.some((tagId, index) => tagId !== initial.tags[index]);

    const dirty =
      normalizedName !== initial.name ||
      normalizedDescription !== initial.description ||
      normalizedImage !== initial.imageUri ||
      normalizedBaseId !== initial.baseIngredientId ||
      tagsDirty;

    setIsDirty(dirty);
  }, [baseIngredientId, description, imageUri, name, sortedSelectedTagIds]);

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

    if (
      /^https?:/i.test(baseIngredient.photoUri) ||
      baseIngredient.photoUri.startsWith('file:')
    ) {
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
      setIsBaseModalVisible(false);
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
    (candidate: Ingredient | null) => {
      if (!candidate) {
        setBaseIngredientId(null);
        setBaseSearch('');
        setIsBaseModalVisible(false);
        return;
      }

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

      return (
        <Pressable
          onPress={() => handleSelectBaseIngredient(item)}
          style={[
            styles.baseOptionTile,
            {
              borderColor: isSelected ? paletteColors.tint : paletteColors.outlineVariant,
              backgroundColor: isSelected
                ? `${paletteColors.tint}1A`
                : paletteColors.surface,
            },
          ]}
          android_ripple={{ color: `${paletteColors.surface}33` }}
        >
          <View style={styles.baseOptionThumb}>
            <Thumb label={item.name ?? undefined} uri={item.photoUri} />
          </View>
          <View style={styles.baseOptionContent}>
            <Text style={[styles.baseOptionTitle, { color: paletteColors.onSurface }]} numberOfLines={2}>
              {item.name}
            </Text>
            {isOnShoppingList ? (
              <View style={styles.baseOptionMeta}>
                <MaterialIcons name="shopping-cart" size={18} color={paletteColors.tint} />
                <Text style={[styles.baseOptionMetaText, { color: paletteColors.onSurfaceVariant }]}>
                  On shopping list
                </Text>
              </View>
            ) : null}
          </View>
          {tagColor ? <View style={[styles.tagSwatch, { backgroundColor: tagColor }]} /> : null}
        </Pressable>
      );
    },
    [baseIngredientId, handleSelectBaseIngredient, paletteColors, shoppingIngredientIds],
  );

  const baseModalKeyExtractor = useCallback((item: Ingredient) => {
    if (item.id != null) {
      return String(item.id);
    }

    return item.name ?? '';
  }, []);

  const registerSection = useCallback(
    (key: SectionKey) => (event: LayoutChangeEvent) => {
      sectionPositions.current[key] = event.nativeEvent.layout.y;
    },
    [],
  );

  const scrollToSection = useCallback((key: SectionKey) => {
    const y = sectionPositions.current[key];
    if (typeof y === 'number') {
      const offset = Math.max(0, y - SECTION_PADDING);
      scrollRef.current?.scrollTo({ y: offset, animated: true });
    }
  }, []);

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

  const handleDelete = useCallback(() => {
    if (numericIngredientId == null) {
      Alert.alert('Ingredient not found', 'Please try again later.');
      return;
    }

    const wasDeleted = deleteIngredient(numericIngredientId);
    if (!wasDeleted) {
      Alert.alert('Could not delete ingredient', 'Please try again later.');
      return;
    }

    setIsDeleteDialogVisible(false);
    router.back();
  }, [deleteIngredient, numericIngredientId]);

  const completeAfterSave = useCallback(() => {
    const action = afterSaveActionRef.current;
    afterSaveActionRef.current = null;
    if (action === 'back' || action == null) {
      router.back();
      return;
    }

    navigation.dispatch(action);
  }, [navigation]);

  const handleSubmit = useCallback(async () => {
    if (isSaving) {
      return;
    }

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
    const selectedTagsForSubmit = selectedTagIds
      .map((tagId) => BUILTIN_INGREDIENT_TAGS.find((tag) => tag.id === tagId))
      .filter((tag): tag is (typeof BUILTIN_INGREDIENT_TAGS)[number] => Boolean(tag));

    try {
      setIsSaving(true);
      const updated = updateIngredient(numericIngredientId, {
        name: trimmedName,
        description: descriptionValue || undefined,
        photoUri: imageUri ?? undefined,
        baseIngredientId,
        tags: selectedTagsForSubmit,
      });

      if (!updated) {
        Alert.alert('Could not save ingredient', 'Please try again later.');
        return;
      }

      initialStateRef.current = {
        name: trimmedName,
        description: descriptionValue,
        imageUri: imageUri ?? null,
        baseIngredientId,
        tags: sortedSelectedTagIds,
      };
      setIsDirty(false);
      setIsUnsavedDialogVisible(false);
      completeAfterSave();
    } finally {
      setIsSaving(false);
    }
  }, [
    baseIngredientId,
    completeAfterSave,
    description,
    imageUri,
    isSaving,
    name,
    numericIngredientId,
    selectedTagIds,
    sortedSelectedTagIds,
    updateIngredient,
  ]);

  const handleSavePress = useCallback(() => {
    afterSaveActionRef.current = 'back';
    handleSubmit();
  }, [handleSubmit]);

  const handleUnsavedSave = useCallback(() => {
    afterSaveActionRef.current = pendingNavigationActionRef.current ?? 'back';
    pendingNavigationActionRef.current = null;
    setIsUnsavedDialogVisible(false);
    handleSubmit();
  }, [handleSubmit]);

  const handleDiscardChanges = useCallback(() => {
    setIsUnsavedDialogVisible(false);
    const action = pendingNavigationActionRef.current;
    pendingNavigationActionRef.current = null;
    setIsDirty(false);
    if (action) {
      navigation.dispatch(action);
    } else {
      router.back();
    }
  }, [navigation]);

  const handleBackPress = useCallback(() => {
    if (isDirty) {
      setIsUnsavedDialogVisible(true);
      return;
    }

    router.back();
  }, [isDirty]);

  useEffect(() => {
    const beforeRemove = navigation.addListener('beforeRemove', (event) => {
      if (!isDirty || isUnsavedDialogVisible) {
        return;
      }

      event.preventDefault();
      pendingNavigationActionRef.current = event.data.action;
      setIsUnsavedDialogVisible(true);
    });

    return beforeRemove;
  }, [isDirty, isUnsavedDialogVisible, navigation]);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isUnsavedDialogVisible) {
        return true;
      }

      if (!isDirty) {
        return false;
      }

      setIsUnsavedDialogVisible(true);
      return true;
    });

    return () => handler.remove();
  }, [isDirty, isUnsavedDialogVisible]);

  const contentBottomInset = keyboardHeight + insets.bottom + SECTION_PADDING;

  if (!ingredient) {
    return (
      <>
        <Stack.Screen options={{ title: 'Edit ingredient' }} />
        <View style={[styles.flex, styles.emptyState]}>
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
          gestureEnabled: false,
          headerLeft: () => (
            <Pressable
              onPress={handleBackPress}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={[styles.headerButton, { backgroundColor: paletteColors.surfaceVariant }]}
              hitSlop={8}
              android_ripple={{ color: `${paletteColors.surface}33` }}
            >
              <MaterialIcons name="arrow-back" size={22} color={paletteColors.onSurface} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={() => setIsDeleteDialogVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Delete ingredient"
              style={[styles.headerButton, { backgroundColor: paletteColors.surfaceVariant }]}
              hitSlop={8}
              android_ripple={{ color: `${paletteColors.surface}33` }}
            >
              <MaterialIcons name="delete-outline" size={22} color={paletteColors.onSurface} />
            </Pressable>
          ),
        }}
      />
      <View style={[styles.flex, { backgroundColor: paletteColors.surface }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top}
          style={styles.flex}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[styles.content, { paddingBottom: SECTION_PADDING }]}
            style={styles.flex}
            keyboardShouldPersistTaps="handled"
            contentInset={{ bottom: contentBottomInset }}
            scrollIndicatorInsets={{ bottom: contentBottomInset }}
          >
            <View style={styles.section} onLayout={registerSection('name')}>
              <Text style={[styles.label, { color: paletteColors.onSurfaceVariant }]}>Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                onFocus={() => scrollToSection('name')}
                placeholder="For example, Ginger syrup"
                style={[
                  styles.input,
                  { borderColor: paletteColors.outlineVariant, color: paletteColors.text },
                ]}
                placeholderTextColor={`${paletteColors.onSurfaceVariant}99`}
                returnKeyType="next"
              />
            </View>

            <View style={styles.section}>
              <Text style={[styles.label, { color: paletteColors.onSurfaceVariant }]}>Photo</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={placeholderLabel}
                style={[
                  styles.imagePlaceholder,
                  { borderColor: paletteColors.outline },
                  !imageSource && { backgroundColor: paletteColors.surfaceVariant },
                ]}
                onPress={handlePickImage}
                android_ripple={{ color: `${paletteColors.surface}33` }}
              >
                {imageSource ? (
                  <Image source={imageSource} style={styles.image} contentFit="contain" />
                ) : (
                  <View style={styles.placeholderContent}>
                    <MaterialCommunityIcons
                      name="image-plus"
                      size={24}
                      color={paletteColors.onSurfaceVariant}
                    />
                    <Text
                      style={[styles.placeholderHint, { color: paletteColors.onSurfaceVariant }]}
                    >
                      Tap to add a photo
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>

            <View style={styles.section} onLayout={registerSection('tags')}>
              <Text style={[styles.label, { color: paletteColors.onSurfaceVariant }]}>Tags</Text>
              <Text style={[styles.hint, { color: paletteColors.onSurfaceVariant }]}>Selected tags</Text>
              <View style={styles.tagList}>
                {selectedTags.length ? (
                  selectedTags.map((tag) => (
                    <TagPill
                      key={tag.id}
                      label={tag.name}
                      color={tag.color}
                      selected
                      onPress={() => toggleTag(tag.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: true }}
                      androidRippleColor={`${paletteColors.surface}33`}
                    />
                  ))
                ) : (
                  <Text style={[styles.emptyTagText, { color: paletteColors.onSurfaceVariant }]}>No tags selected</Text>
                )}
              </View>

              <View style={styles.tagSectionHeader}>
                <Text style={[styles.hint, { color: paletteColors.onSurfaceVariant }]}>Available tags</Text>
                <View style={styles.tagActions}>
                  <Pressable
                    onPress={() => setIsTagManagerVisible(true)}
                    style={[styles.addTagButton, { borderColor: paletteColors.outlineVariant }]}
                    android_ripple={{ color: `${paletteColors.surface}33` }}
                  >
                    <MaterialIcons name="add" size={18} color={paletteColors.tint} />
                    <Text style={[styles.addTagLabel, { color: paletteColors.tint }]}>+Add</Text>
                  </Pressable>
                  <Pressable onPress={() => setIsTagManagerVisible(true)} hitSlop={8}>
                    <Text style={[styles.manageTagsLink, { color: paletteColors.tint }]}>Manage tags</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.tagList}>
                {availableTags.length ? (
                  availableTags.map((tag) => (
                    <TagPill
                      key={tag.id}
                      label={tag.name}
                      color={tag.color}
                      selected={false}
                      onPress={() => toggleTag(tag.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: false }}
                      androidRippleColor={`${paletteColors.surface}33`}
                    />
                  ))
                ) : (
                  <Text style={[styles.emptyTagText, { color: paletteColors.onSurfaceVariant }]}>All tags selected</Text>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.label, { color: paletteColors.onSurfaceVariant }]}>Base ingredient</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={baseIngredient ? 'Change base ingredient' : 'Select base ingredient'}
                onPress={handleOpenBaseModal}
                style={[
                  styles.baseSelector,
                  { borderColor: paletteColors.outline, backgroundColor: paletteColors.surface },
                ]}
                android_ripple={{ color: `${paletteColors.surface}33` }}
              >
                {baseIngredient ? (
                  <>
                    <View style={styles.baseInfo}>
                      <View style={styles.baseThumb}>
                        {baseIngredientPhotoSource ? (
                          <Image source={baseIngredientPhotoSource} style={styles.baseImage} contentFit="contain" />
                        ) : (
                          <View style={[styles.basePlaceholder, { backgroundColor: paletteColors.surfaceVariant }]}> 
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
                    <Text style={[styles.basePlaceholderText, { color: paletteColors.onSurfaceVariant }]}>Select a base ingredient</Text>
                  </View>
                )}
              </Pressable>
            </View>

            <View style={[styles.section, styles.descriptionSection]} onLayout={registerSection('description')}>
              <Text style={[styles.label, { color: paletteColors.onSurfaceVariant }]}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                onFocus={() => scrollToSection('description')}
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
            </View>

            <Pressable
              accessibilityRole="button"
              style={[styles.submitButton, { backgroundColor: paletteColors.tint }]}
              onPress={handleSavePress}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={paletteColors.surface} />
              ) : (
                <Text style={[styles.submitLabel, { color: paletteColors.surface }]}>Save Changes</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      <Modal
        visible={isBaseModalVisible}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={handleCloseBaseModal}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: paletteColors.backdrop }]}
          onPress={handleCloseBaseModal}
        >
          <Pressable
            onPress={(event) => event.stopPropagation?.()}
            style={[styles.baseModalCard, { backgroundColor: paletteColors.surface }]}
          >
            <View style={styles.baseModalHeader}>
              <Text style={[styles.modalTitle, { color: paletteColors.onSurface }]}>Select base ingredient</Text>
              <Pressable onPress={() => handleSelectBaseIngredient(null)} hitSlop={8}>
                <Text style={[styles.modalClear, { color: paletteColors.error }]}>None</Text>
              </Pressable>
            </View>
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
              contentContainerStyle={styles.modalListContent}
              ItemSeparatorComponent={() => (
                <View style={[styles.modalSeparator, { backgroundColor: paletteColors.outline }]} />
              )}
              ListEmptyComponent={() => (
                <Text style={[styles.modalEmptyText, { color: paletteColors.onSurfaceVariant }]}>No ingredients found</Text>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isTagManagerVisible}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={() => setIsTagManagerVisible(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: paletteColors.backdrop }]}
          onPress={() => setIsTagManagerVisible(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation?.()}
            style={[styles.tagModalCard, { backgroundColor: paletteColors.surface }]}
          >
            <View style={styles.tagModalHeader}>
              <Text style={[styles.modalTitle, { color: paletteColors.onSurface }]}>Manage tags</Text>
              <Pressable onPress={() => setIsTagInfoVisible(true)} hitSlop={8}>
                <MaterialCommunityIcons
                  name="information-outline"
                  size={22}
                  color={paletteColors.onSurfaceVariant}
                />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.tagModalContent}>
              {BUILTIN_INGREDIENT_TAGS.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <TagPill
                    key={tag.id}
                    label={tag.name}
                    color={tag.color}
                    selected={isSelected}
                    onPress={() => toggleTag(tag.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    androidRippleColor={`${paletteColors.surface}33`}
                  />
                );
              })}
            </ScrollView>
            <Pressable
              onPress={() => setIsTagManagerVisible(false)}
              style={[styles.modalPrimaryButton, { backgroundColor: paletteColors.tint }]}
              android_ripple={{ color: `${paletteColors.surface}33` }}
            >
              <Text style={[styles.modalPrimaryLabel, { color: paletteColors.surface }]}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isTagInfoVisible}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={() => setIsTagInfoVisible(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: paletteColors.backdrop }]}
          onPress={() => setIsTagInfoVisible(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation?.()}
            style={[styles.infoModalCard, { backgroundColor: paletteColors.surface }]}
          >
            <MaterialCommunityIcons
              name="tag"
              size={32}
              color={paletteColors.tint}
              style={styles.infoIcon}
            />
            <Text style={[styles.modalTitle, { color: paletteColors.onSurface }]}>About tags</Text>
            <Text style={[styles.infoBody, { color: paletteColors.onSurfaceVariant }]}>
              Tags help you group ingredients for faster discovery and filtering. Mix and match the
              tags that best describe your ingredient.
            </Text>
            <Pressable
              onPress={() => setIsTagInfoVisible(false)}
              style={[styles.modalPrimaryButton, { backgroundColor: paletteColors.tint }]}
              android_ripple={{ color: `${paletteColors.surface}33` }}
            >
              <Text style={[styles.modalPrimaryLabel, { color: paletteColors.surface }]}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isDeleteDialogVisible}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={() => setIsDeleteDialogVisible(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: paletteColors.backdrop }]}
          onPress={() => setIsDeleteDialogVisible(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation?.()}
            style={[styles.confirmModalCard, { backgroundColor: paletteColors.surface }]}
          >
            <MaterialIcons name="delete-outline" size={32} color={paletteColors.error} />
            <Text style={[styles.modalTitle, { color: paletteColors.onSurface }]}>Delete ingredient?</Text>
            <Text style={[styles.infoBody, { color: paletteColors.onSurfaceVariant }]}>
              This action cannot be undone. The ingredient will be removed from your lists.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => setIsDeleteDialogVisible(false)}
                style={[styles.secondaryButton, { borderColor: paletteColors.outlineVariant }]}
                android_ripple={{ color: `${paletteColors.surface}33` }}
              >
                <Text style={[styles.secondaryLabel, { color: paletteColors.onSurface }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                style={[styles.destructiveButton, { backgroundColor: paletteColors.error }]}
                android_ripple={{ color: `${paletteColors.surface}33` }}
              >
                <Text style={[styles.destructiveLabel, { color: paletteColors.surface }]}>Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isUnsavedDialogVisible}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={() => setIsUnsavedDialogVisible(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: paletteColors.backdrop }]}
          onPress={() => setIsUnsavedDialogVisible(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation?.()}
            style={[styles.confirmModalCard, { backgroundColor: paletteColors.surface }]}
          >
            <MaterialCommunityIcons name="alert-outline" size={32} color={paletteColors.tint} />
            <Text style={[styles.modalTitle, { color: paletteColors.onSurface }]}>Unsaved changes</Text>
            <Text style={[styles.infoBody, { color: paletteColors.onSurfaceVariant }]}>
              You have unsaved edits. What would you like to do?
            </Text>
            <View style={styles.unsavedActions}>
              <Pressable
                onPress={handleDiscardChanges}
                style={[styles.destructiveOutlineButton, { borderColor: paletteColors.error }]}
                android_ripple={{ color: `${paletteColors.surface}33` }}
              >
                <Text style={[styles.destructiveOutlineLabel, { color: paletteColors.error }]}>Discard</Text>
              </Pressable>
              <Pressable
                onPress={() => setIsUnsavedDialogVisible(false)}
                style={[styles.secondaryButton, { borderColor: paletteColors.outlineVariant }]}
                android_ripple={{ color: `${paletteColors.surface}33` }}
              >
                <Text style={[styles.secondaryLabel, { color: paletteColors.onSurface }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleUnsavedSave}
                style={[styles.modalPrimaryButton, { backgroundColor: paletteColors.tint }]}
                android_ripple={{ color: `${paletteColors.surface}33` }}
              >
                <Text style={[styles.modalPrimaryLabel, { color: paletteColors.surface }]}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SECTION_PADDING,
    paddingTop: SECTION_PADDING,
    gap: 24,
  },
  section: {
    gap: 8,
  },
  label: {
    fontSize: 15,
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
    paddingHorizontal: 12,
  },
  placeholderHint: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  emptyTagText: {
    fontSize: 13,
  },
  tagSectionHeader: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  addTagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addTagLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  manageTagsLink: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
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
  descriptionSection: {
    paddingBottom: 12,
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
  modalOverlay: {
    flex: 1,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 24,
    justifyContent: 'flex-start',
  },
  baseModalCard: {
    borderRadius: 24,
    padding: 16,
    gap: 16,
    flex: 1,
  },
  baseModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalClear: {
    fontSize: 15,
    fontWeight: '600',
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
  baseOptionTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
  },
  baseOptionThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
  },
  baseOptionContent: {
    flex: 1,
    gap: 4,
  },
  baseOptionTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  baseOptionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  baseOptionMetaText: {
    fontSize: 12,
  },
  tagSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  tagModalCard: {
    borderRadius: 24,
    padding: 20,
    gap: 20,
    maxHeight: '80%',
  },
  tagModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagModalContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  modalPrimaryButton: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoModalCard: {
    borderRadius: 24,
    padding: 24,
    gap: 16,
    alignItems: 'center',
  },
  infoIcon: {
    marginBottom: 8,
  },
  infoBody: {
    fontSize: 15,
    textAlign: 'center',
  },
  confirmModalCard: {
    borderRadius: 24,
    padding: 24,
    gap: 20,
    alignItems: 'center',
  },
  confirmActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unsavedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  secondaryButton: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  destructiveButton: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  destructiveLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  destructiveOutlineButton: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  destructiveOutlineLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  headerButton: {
    padding: 8,
    borderRadius: 999,
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
