import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { AppImage } from '@/components/AppImage';
import { AppDialog, type DialogOptions } from '@/components/AppDialog';
import { ListRow, Thumb } from '@/components/RowParts';
import { TagEditorModal } from '@/components/TagEditorModal';
import { TagPill } from '@/components/TagPill';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import { useAppColors } from '@/constants/theme';
import { resolveImageSource } from '@/libs/image-source';
import { buildReturnToParams, skipDuplicateBack } from '@/libs/navigation';
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

function getParamValue(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

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

    const normalized = normalizeSearchText(param);
    return ingredients.find((item) => normalizeSearchText(item.name ?? '') === normalized);
  }, [ingredients, param]);
}

export default function IngredientFormScreen() {
  const params = useLocalSearchParams<{
    suggestedName?: string;
    returnTo?: string;
    returnToPath?: string;
    returnToParams?: string;
    mode?: string;
    ingredientId?: string;
  }>();
  const modeParam = getParamValue(params.mode);
  const isEditMode = modeParam === 'edit';
  const ingredientParam = getParamValue(params.ingredientId);
  const suggestedNameParam = useMemo(() => {
    const value = getParamValue(params.suggestedName);
    return typeof value === 'string' ? value : undefined;
  }, [params.suggestedName]);
  const returnToPathParam = useMemo(() => {
    const value = getParamValue(params.returnToPath);
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }, [params.returnToPath]);
  const returnToParamsParam = useMemo(() => {
    const value = getParamValue(params.returnToParams);
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }, [params.returnToParams]);
  const legacyReturnToParam = useMemo(() => {
    const value = getParamValue(params.returnTo);
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
    deleteIngredient,
    customIngredientTags,
    createCustomIngredientTag,
  } = useInventory();
  const colors = useAppColors();
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const isNavigatingAfterSaveRef = useRef(false);

  const ingredient = useResolvedIngredient(ingredientParam, ingredients);

  const numericIngredientId = useMemo(() => {
    const candidate = ingredient?.id ?? ingredientParam;
    const parsed = Number(candidate);
    return Number.isNaN(parsed) ? undefined : parsed;
  }, [ingredient?.id, ingredientParam]);

  const [name, setName] = useState(() => (isEditMode ? '' : suggestedNameParam ?? ''));
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
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(!isEditMode);
  const [initialSnapshot, setInitialSnapshot] = useState<IngredientFormSnapshot | null>(null);

  const didInitializeRef = useRef(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const isHandlingBackRef = useRef(false);

  useEffect(() => {
    if (isEditMode) {
      return;
    }

    setName(suggestedNameParam ?? '');
    setDescription('');
    setImageUri(null);
    setSelectedTagIds([]);
    setBaseIngredientId(null);
    setBaseSearch('');
    setTagModalVisible(false);
    setIsBaseModalVisible(false);
    setInitialSnapshot(null);
    setIsSaving(false);
    setIsInitialized(true);
  }, [isEditMode, suggestedNameParam]);

  useEffect(() => {
    if (!isEditMode || !ingredient || didInitializeRef.current) {
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
    setIsInitialized(true);
  }, [ingredient, isEditMode]);

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
    if (!isInitialized || initialSnapshot) {
      return;
    }

    setInitialSnapshot(buildSnapshot());
  }, [buildSnapshot, initialSnapshot, isInitialized]);

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

  const imageSource = useMemo(() => {
    if (isEditMode) {
      return resolveImageSource(imageUri);
    }

    if (!imageUri) {
      return undefined;
    }

    return { uri: imageUri };
  }, [imageUri, isEditMode]);

  const placeholderLabel = useMemo(() => {
    if (imageSource) {
      return 'Change image';
    }

    return 'Add image';
  }, [imageSource]);

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
    if (isSaving) {
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      showDialog({
        title: 'Name is required',
        message: 'Please enter the ingredient name.',
        actions: [{ label: 'OK' }],
      });
      return;
    }

    if (isEditMode) {
      if (numericIngredientId == null) {
        showDialog({
          title: 'Ingredient not found',
          message: 'Please try again later.',
          actions: [{ label: 'OK' }],
        });
        return;
      }

      setIsSaving(true);
      try {
        const descriptionValue = description.trim();
        const selectedTags = selectedTagIds
          .map((tagId) => availableIngredientTags.find((tag) => tag.id === tagId))
          .filter((tag): tag is (typeof availableIngredientTags)[number] => Boolean(tag));

        const photoHasChanged = imageUri !== ingredient?.photoUri;
        const shouldProcessPhoto = shouldStorePhoto(imageUri) && photoHasChanged;
        const submission = {
          name: trimmedName,
          description: descriptionValue || undefined,
          photoUri: shouldProcessPhoto ? undefined : imageUri ?? undefined,
          baseIngredientId,
          tags: selectedTags,
        };

        const updated = updateIngredient(numericIngredientId, {
          ...submission,
          photoUri:
            imageUri && shouldProcessPhoto
              ? await storePhoto({
                uri: imageUri,
                id: numericIngredientId,
                name: trimmedName,
                category: 'ingredients',
                suffix: String(Date.now()),
              })
              : submission.photoUri,
        });

        if (!updated) {
          showDialog({
            title: 'Could not save ingredient',
            message: 'Please try again later.',
            actions: [{ label: 'OK' }],
          });
          return;
        }

        setHasUnsavedChanges(false);
        isNavigatingAfterSaveRef.current = true;
        if (navigation.canGoBack()) {
          navigation.goBack();
          return;
        }

        router.replace({
          pathname: '/ingredients/[ingredientId]',
          params: {
            ingredientId: String(numericIngredientId),
            ...buildReturnToParams(returnToPath, returnToParams),
          },
        });
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setIsSaving(true);
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
      setIsSaving(false);
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
    ingredient?.photoUri,
    isEditMode,
    isSaving,
    name,
    navigation,
    numericIngredientId,
    returnToParams,
    returnToPath,
    selectedTagIds,
    setHasUnsavedChanges,
    showDialog,
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

  const handleGoBack = useCallback(() => {
    skipDuplicateBack(navigation);
  }, [navigation]);

  const handleDeletePress = useCallback(() => {
    if (!isEditMode) {
      return;
    }

    if (numericIngredientId == null) {
      showDialog({
        title: 'Ingredient not found',
        message: 'Please try again later.',
        actions: [{ label: 'OK' }],
      });
      return;
    }

    const trimmedName = ingredient?.name?.trim();
    const message = trimmedName
      ? `Are you sure you want to delete ${trimmedName}? This action cannot be undone.`
      : 'Are you sure you want to delete this ingredient? This action cannot be undone.';

    showDialog({
      title: 'Delete ingredient',
      message,
      actions: [
        { label: 'Cancel', variant: 'secondary' },
        {
          label: 'Delete',
          variant: 'destructive',
          onPress: () => {
            const wasDeleted = deleteIngredient(numericIngredientId);
            if (!wasDeleted) {
              showDialog({
                title: 'Could not delete ingredient',
                message: 'Please try again later.',
                actions: [{ label: 'OK' }],
              });
              return;
            }

            setHasUnsavedChanges(false);
            router.replace('/ingredients');
          },
        },
      ],
    });
  }, [deleteIngredient, ingredient?.name, isEditMode, numericIngredientId, setHasUnsavedChanges, showDialog]);

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

  const handleRemoveImage = useCallback(() => {
    setImageUri(null);
  }, []);

  const handleCloseBaseModal = useCallback(() => {
    const normalized = normalizeSearchText(baseSearch);
    if (normalized) {
      const match = baseIngredientOptions.find((item) =>
        item.name ? normalizeSearchText(item.name) === normalized : false,
      );

      if (match?.id != null) {
        const targetId = Number(match.id);
        if (Number.isFinite(targetId) && targetId >= 0) {
          setBaseIngredientId(targetId);
        }
      }
    }

    setIsBaseModalVisible(false);
    setBaseSearch('');
  }, [baseIngredientOptions, baseSearch]);

  const normalizedBaseQuery = useMemo(() => normalizeSearchText(baseSearch), [baseSearch]);

  const baseIngredientOptions = useMemo(() => {
    if (!isEditMode) {
      return ingredients.filter((item) => item.baseIngredientId == null);
    }

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
  }, [baseIngredientId, ingredients, isEditMode, numericIngredientId]);

  const filteredBaseIngredients = useMemo(() => {
    if (!normalizedBaseQuery) {
      return baseIngredientOptions;
    }

    return baseIngredientOptions.filter((candidate) => {
      const nameNormalized = candidate.searchNameNormalized ?? normalizeSearchText(candidate.name ?? '');
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

      if (isEditMode && numericIngredientId != null && candidateId === numericIngredientId) {
        return;
      }

      setBaseIngredientId(candidateId);
      setBaseSearch('');
      setIsBaseModalVisible(false);
    },
    [isEditMode, numericIngredientId],
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
          <MaterialIcons name="shopping-cart" size={20} color={colors.tint} />
        </View>
      ) : undefined;

      return (
        <ListRow
          title={item.name ?? ''}
          onPress={() => handleSelectBaseIngredient(item)}
          selected={isAvailable}
          highlightColor={colors.highlightFaint}
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
      colors,
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
      () => { },
      (_x, y) => {
        const HEADER_OFFSET = 56;
        const targetOffset = Math.max(0, y - HEADER_OFFSET);
        scrollRef.current?.scrollTo({ y: targetOffset, animated: true });
      },
    );
  }, []);

  const contentStyle = isEditMode ? styles.contentEdit : styles.contentCreate;
  const sectionStyle = isEditMode ? styles.sectionEdit : styles.sectionCreate;
  const hintStyle = isEditMode ? styles.hintEdit : styles.hintCreate;
  const tagListStyle = isEditMode ? styles.tagListEdit : styles.tagListCreate;
  const submitButtonStyle = isEditMode ? styles.submitButtonEdit : styles.submitButtonCreate;

  if (isEditMode && !ingredient) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Edit ingredient',
            headerTitleAlign: 'center',
            headerStyle: { backgroundColor: colors.surface },
            headerShadowVisible: false,
            headerTitleStyle: { color: colors.onSurface, fontSize: 16, fontWeight: '600' },
            headerLeft: () => (
              <Pressable
                onPress={handleGoBack}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                style={styles.headerButton}
                hitSlop={8}>
                <MaterialCommunityIcons name="arrow-left" size={22} color={colors.onSurface} />
              </Pressable>
            ),
          }}
        />
        <View style={[styles.container, styles.emptyState, { backgroundColor: colors.background }]}>
          <Text style={[styles.emptyMessage, { color: colors.onSurfaceVariant }]}>Ingredient not found</Text>
        </View>
      </>
    );
  }

  const formContent = (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={contentStyle}
      style={[styles.container, { backgroundColor: colors.background }]}
      keyboardShouldPersistTaps="handled">
      <View style={sectionStyle}>
        <Text style={[styles.label, { color: colors.onSurface }]}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g., Ginger syrup"
          style={[
            styles.input,
            { borderColor: colors.outlineVariant, color: colors.text, backgroundColor: colors.surface },
          ]}
          placeholderTextColor={`${colors.onSurfaceVariant}99`}
        />
      </View>

      <View style={styles.photoTileWrapper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={placeholderLabel}
          style={[
            styles.imagePlaceholder,
            { borderColor: colors.outlineVariant },
            !imageSource && { backgroundColor: colors.surface },
          ]}
          onPress={handlePickImage}
          android_ripple={{ color: `${colors.surface}33` }}>
          {imageSource ? (
            <AppImage source={imageSource} style={styles.image} contentFit="contain" />
          ) : (
            <View style={styles.placeholderContent}>
              <MaterialCommunityIcons name="image-plus" size={28} color={`${colors.onSurfaceVariant}99`} />
              <Text style={[styles.placeholderHint, { color: `${colors.onSurfaceVariant}99` }]}>Tap to add a photo</Text>
            </View>
          )}
          {imageSource ? (
            <View
              pointerEvents="none"
              style={[styles.cropFrame, { borderColor: colors.tint }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ) : null}
        </Pressable>
        {imageSource ? (
          <Pressable
            onPress={handleRemoveImage}
            hitSlop={8}
            style={[styles.removePhotoButton, { backgroundColor: colors.surface }]}
            accessibilityRole="button"
            accessibilityLabel="Remove photo">
            <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.error} />
          </Pressable>
        ) : null}
      </View>

      <View style={sectionStyle}>
        <View style={styles.tagHeader}>
          <Text style={[styles.label, { color: colors.onSurface }]}>Tags</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create tag"
            onPress={handleOpenTagModal}
            style={[styles.tagAddButton, { borderColor: colors.outlineVariant }]}>
            <MaterialCommunityIcons name="plus" size={16} color={colors.tint} />
            <Text style={[styles.tagAddLabel, { color: colors.tint }]}>Create tag</Text>
          </Pressable>
        </View>
        <Text style={[hintStyle, { color: colors.onSurfaceVariant }]}>Select one or more tags</Text>
        <View style={tagListStyle}>
          {tagSelection.map((tag) => (
            <TagPill
              key={tag.id}
              label={tag.name}
              color={tag.color}
              selected={tag.selected}
              onPress={() => toggleTag(tag.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: tag.selected }}
              androidRippleColor={`${colors.surface}33`}
            />
          ))}
        </View>
      </View>

      <View style={sectionStyle}>
        <Text style={[styles.label, { color: colors.onSurface }]}>Base ingredient</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={baseIngredient ? 'Change base ingredient' : 'Select base ingredient'}
          onPress={handleOpenBaseModal}
          style={[styles.baseSelector, { borderColor: colors.outlineVariant, backgroundColor: colors.surface }]}>
          {baseIngredient ? (
            <>
              <View style={styles.baseInfo}>
                <View style={[styles.baseThumb, { backgroundColor: colors.background }]}>
                  {baseIngredientPhotoSource ? (
                    <AppImage source={baseIngredientPhotoSource} style={styles.baseImage} contentFit="contain" />
                  ) : (
                    <View style={[styles.basePlaceholder, { backgroundColor: colors.onSurfaceVariant }]}>
                      <MaterialCommunityIcons name="image-off" size={20} color={colors.onSurfaceVariant} />
                    </View>
                  )}
                </View>
                <Text style={[styles.baseName, { color: colors.onSurface }]} numberOfLines={2}>
                  {baseIngredient.name}
                </Text>
              </View>
              <Pressable
                onPress={handleClearBaseIngredient}
                accessibilityRole="button"
                accessibilityLabel="Remove base ingredient"
                hitSlop={8}
                style={styles.unlinkButton}>
                <MaterialCommunityIcons name="link-off" size={20} color={colors.error} />
              </Pressable>
            </>
          ) : (
            <View style={styles.basePlaceholderRow}>
              <Text style={[styles.basePlaceholderText, { color: colors.onSurfaceVariant }]}>None</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={[sectionStyle, styles.descriptionSection]}>
        <Text style={[styles.label, { color: colors.onSurface }]}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Add tasting notes or usage suggestions"
          style={[
            styles.input,
            styles.multilineInput,
            { borderColor: colors.outlineVariant, color: colors.text, backgroundColor: colors.surface },
          ]}
          placeholderTextColor={`${colors.onSurfaceVariant}99`}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          onFocus={(event) => scrollFieldIntoView(event.nativeEvent.target)}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        style={[submitButtonStyle, { backgroundColor: colors.tint, opacity: isSaving ? 0.6 : 1 }]}
        onPress={handleSubmit}
        disabled={isSaving || isPickingImage}>
        <Text style={[styles.submitLabel, { color: colors.onPrimary }]}>Save</Text>
      </Pressable>
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: isEditMode ? 'Edit ingredient' : 'Add ingredient',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          headerTitleStyle: { color: colors.onSurface, fontSize: 16, fontWeight: '600' },
          headerLeft: () => (
            <Pressable
              onPress={handleGoBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.headerButton}
              hitSlop={8}>
              <MaterialCommunityIcons name="arrow-left" size={22} color={colors.onSurface} />
            </Pressable>
          ),
          headerRight: () =>
            isEditMode ? (
              <Pressable
                onPress={handleDeletePress}
                accessibilityRole="button"
                accessibilityLabel="Delete ingredient"
                style={styles.headerButton}
                hitSlop={8}>
                <MaterialIcons name="delete-outline" size={22} color={colors.onSurface} />
              </Pressable>
            ) : null,
        }}
      />
      {isEditMode ? (
        formContent
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.select({ ios: 96, default: 0 })}>
          {formContent}
        </KeyboardAvoidingView>
      )}

      <Modal
        visible={isBaseModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseBaseModal}>
        <Pressable style={styles.modalOverlay} onPress={handleCloseBaseModal} accessibilityRole="button">
          <Pressable
            onPress={(event) => event.stopPropagation?.()}
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.outline,
                shadowColor: colors.shadow,
              },
            ]}
            accessibilityRole="menu">
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Select base ingredient</Text>
              <Pressable onPress={handleCloseBaseModal} accessibilityRole="button" accessibilityLabel="Close">
                <MaterialCommunityIcons name="close" size={22} color={colors.onSurfaceVariant} />
              </Pressable>
            </View>
            <TextInput
              ref={baseSearchInputRef}
              value={baseSearch}
              onChangeText={setBaseSearch}
              placeholder="Search ingredients"
              placeholderTextColor={`${colors.onSurfaceVariant}99`}
              style={[
                styles.modalSearchInput,
                { borderColor: colors.outlineVariant, color: colors.text, backgroundColor: colors.surfaceBright },
              ]}
              autoFocus
            />
            <FlatList
              data={filteredBaseIngredients}
              keyExtractor={baseModalKeyExtractor}
              renderItem={renderBaseIngredient}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={({ leadingItem }) => {
                const ingredientId = Number((leadingItem as Ingredient | null)?.id ?? -1);
                const isAvailable = ingredientId >= 0 && availableIngredientIds.has(ingredientId);
                const backgroundColor = isAvailable ? colors.outline : colors.outlineVariant;
                return <View style={[styles.modalSeparator, { backgroundColor }]} />;
              }}
              contentContainerStyle={styles.modalListContent}
              ListEmptyComponent={() => (
                <Text style={[styles.modalEmptyText, { color: colors.onSurfaceVariant }]}>No ingredients found</Text>
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
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentCreate: {
    padding: 16,
    gap: 20,
  },
  contentEdit: {
    padding: 24,
    gap: 24,
  },
  sectionCreate: {
    gap: 10,
  },
  sectionEdit: {
    gap: 8,
  },
  descriptionSection: {
    paddingBottom: 0,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  hintCreate: {
    fontSize: 14,
  },
  hintEdit: {
    fontSize: 12,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 14, default: 12 }),
    fontSize: 16,
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
  },
  cropFrame: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    left: 10,
    right: 10,
    borderRadius: 10,
    borderWidth: 0,
  },
  photoTileWrapper: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    position: 'relative',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
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
  tagListCreate: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tagListEdit: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bottomSpacer: {
    height: 250,
  },
  submitButtonCreate: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  submitButtonEdit: {
    borderRadius: 12,
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: 'center',
  },
});
