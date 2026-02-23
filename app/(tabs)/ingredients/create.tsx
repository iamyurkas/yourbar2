import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { StackActions, useFocusEffect, useNavigation, type NavigationAction } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
  UIManager,
  View,
  findNodeHandle,
  type GestureResponderEvent,
} from 'react-native';

import { AppDialog, type DialogOptions } from '@/components/AppDialog';
import { AppImage } from '@/components/AppImage';
import { HeaderIconButton } from '@/components/HeaderIconButton';
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
  styleIngredientId: number | null;
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
    fromCocktailAddIngredient?: string;
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
  const fromCocktailAddIngredientParam = useMemo(() => {
    const value = getParamValue(params.fromCocktailAddIngredient);
    return value === 'true';
  }, [params.fromCocktailAddIngredient]);
  const shouldConfirmOnLeave = useMemo(
    () =>
      !isEditMode &&
      (fromCocktailAddIngredientParam || returnToPath === '/cocktails/create'),
    [fromCocktailAddIngredientParam, isEditMode, returnToPath],
  );

  const navigation = useNavigation();
  const Colors = useAppColors();
  const { t } = useI18n();
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
  const { setHasUnsavedChanges, setRequireLeaveConfirmation, setSaveHandler } = useUnsavedChanges();
  const isNavigatingAfterSaveRef = useRef(false);

  const ingredient = useResolvedIngredient(ingredientParam, ingredients);
  const defaultIngredientTagId = BUILTIN_INGREDIENT_TAGS.find(
    (tag) => tag.name.trim().toLowerCase() === 'other',
  )?.id;

  const numericIngredientId = useMemo(() => {
    const candidate = ingredient?.id ?? ingredientParam;
    const parsed = Number(candidate);
    return Number.isNaN(parsed) ? undefined : parsed;
  }, [ingredient?.id, ingredientParam]);

  const [name, setName] = useState(() => (isEditMode ? '' : suggestedNameParam ?? ''));
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(
    isEditMode || defaultIngredientTagId == null ? [] : [defaultIngredientTagId],
  );
  const [isTagModalVisible, setTagModalVisible] = useState(false);
  const [baseIngredientId, setBaseIngredientId] = useState<number | null>(null);
  const [styleIngredientId, setStyleIngredientId] = useState<number | null>(null);
  const [isBaseModalVisible, setIsBaseModalVisible] = useState(false);
  const [baseSearch, setBaseSearch] = useState('');
  const [isStyleModalVisible, setIsStyleModalVisible] = useState(false);
  const [styleSearch, setStyleSearch] = useState('');
  const [permissionStatus, requestPermission] = ImagePicker.useMediaLibraryPermissions();
  const [cameraPermissionStatus, requestCameraPermission] = ImagePicker.useCameraPermissions();
  const [dialogOptions, setDialogOptions] = useState<DialogOptions | null>(null);
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(!isEditMode);
  const [initialSnapshot, setInitialSnapshot] = useState<IngredientFormSnapshot | null>(null);

  const didInitializeRef = useRef(false);
  const lastIdRef = useRef<string | number | null>(null);
  const lastModeRef = useRef<boolean | undefined>(undefined);
  const scrollRef = useRef<ScrollView | null>(null);
  const isHandlingBackRef = useRef(false);

  useEffect(() => {
    isNavigatingAfterSaveRef.current = false;
  }, [ingredientParam, isEditMode, suggestedNameParam]);

  useEffect(() => {
    if (isEditMode) {
      return;
    }

    setName(suggestedNameParam ?? '');
    setDescription('');
    setImageUri(null);
    setSelectedTagIds(defaultIngredientTagId == null ? [] : [defaultIngredientTagId]);
    setBaseIngredientId(null);
    setStyleIngredientId(null);
    setBaseSearch('');
    setStyleSearch('');
    setTagModalVisible(false);
    setIsBaseModalVisible(false);
    setInitialSnapshot(null);
    setIsSaving(false);
    setIsInitialized(true);
  }, [defaultIngredientTagId, isEditMode, suggestedNameParam]);

  useEffect(() => {
    if (!isEditMode || !ingredient) {
      return;
    }

    const currentId = ingredient.id != null ? Number(ingredient.id) : ingredientParam ?? null;
    if (didInitializeRef.current && currentId === lastIdRef.current && isEditMode === lastModeRef.current) {
      return;
    }

    didInitializeRef.current = true;
    lastIdRef.current = currentId;
    lastModeRef.current = isEditMode;
    setName(ingredient.name ?? '');
    setDescription(ingredient.description ?? '');
    setImageUri(ingredient.photoUri ?? null);
    setBaseIngredientId(
      ingredient.baseIngredientId != null ? Number(ingredient.baseIngredientId) : null,
    );
    setStyleIngredientId(
      ingredient.styleIngredientId != null ? Number(ingredient.styleIngredientId) : null,
    );

    const initialTagIds = (ingredient.tags ?? [])
      .map((tag) => Number(tag.id ?? -1))
      .filter((id) => Number.isFinite(id) && id >= 0) as number[];
    setSelectedTagIds(initialTagIds);
    setIsInitialized(true);
  }, [ingredient, ingredientParam, isEditMode]);

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
      styleIngredientId,
      selectedTagIds: normalizedTags,
    };
  }, [baseIngredientId, description, imageUri, name, selectedTagIds, styleIngredientId]);

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
    setHasUnsavedChanges(hasUnsavedChanges || shouldConfirmOnLeave);
  }, [hasUnsavedChanges, setHasUnsavedChanges, shouldConfirmOnLeave]);

  useEffect(() => {
    setRequireLeaveConfirmation(shouldConfirmOnLeave);
    return () => {
      setRequireLeaveConfirmation(false);
    };
  }, [setRequireLeaveConfirmation, shouldConfirmOnLeave]);

  useEffect(() => () => {
    setHasUnsavedChanges(false);
    setRequireLeaveConfirmation(false);
  }, [setHasUnsavedChanges, setRequireLeaveConfirmation]);

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

  const ensureCameraPermission = useCallback(async () => {
    if (cameraPermissionStatus?.granted) {
      return true;
    }

    const { status, granted, canAskAgain } = await requestCameraPermission();
    if (granted || status === ImagePicker.PermissionStatus.GRANTED) {
      return true;
    }

    if (!canAskAgain) {
      showDialog({
        title: 'Camera access required',
        message: 'Enable camera permissions in system settings to take an ingredient photo.',
        actions: [{ label: 'OK' }],
      });
    }

    return false;
  }, [cameraPermissionStatus?.granted, requestCameraPermission, showDialog]);

  const handleTakePhoto = useCallback(async () => {
    if (isPickingImage) {
      return;
    }

    const hasPermission = await ensureCameraPermission();
    if (!hasPermission) {
      return;
    }

    try {
      setIsPickingImage(true);
      const result = await ImagePicker.launchCameraAsync({
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
      console.warn('Failed to capture image', error);
      showDialog({
        title: 'Could not take photo',
        message: 'Please try again later.',
        actions: [{ label: 'OK' }],
      });
    } finally {
      setIsPickingImage(false);
    }
  }, [ensureCameraPermission, isPickingImage, showDialog]);

  const handleSelectImageSource = useCallback(() => {
    showDialog({
      title: 'Add photo',
      message: 'Choose how you want to add an ingredient photo.',
      actions: [
        {
          label: 'Take photo',
          onPress: () => {
            void handleTakePhoto();
          },
        },
        {
          label: 'Choose from gallery',
          onPress: () => {
            void handlePickImage();
          },
        },
        { label: 'Cancel', variant: 'secondary' },
      ],
    });
  }, [handlePickImage, handleTakePhoto, showDialog]);

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
          styleIngredientId,
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
      styleIngredientId,
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
      router.replace({ pathname: returnToPath, params: returnToParams });
      return;
    }

    router.replace({
      pathname: '/ingredients/[ingredientId]',
      params: { ingredientId: String(targetId) },
    });
  }, [
    availableIngredientTags,
    baseIngredientId,
    styleIngredientId,
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
          { label: 'Save', variant: 'primary', onPress: handleSubmit },
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
    setSaveHandler(() => handleSubmit);
    return () => {
      setSaveHandler(null);
    };
  }, [handleSubmit, setSaveHandler]);

  const isBackAction = useCallback(
    (action?: NavigationAction) => (action?.type ?? 'GO_BACK') === 'GO_BACK' || action?.type === 'POP',
    [],
  );

  const leaveScreen = useCallback(
    (action?: NavigationAction) => {
      if (isBackAction(action)) {
        if (returnToPath) {
          router.replace({ pathname: returnToPath, params: returnToParams });
          return;
        }

        skipDuplicateBack(navigation);
        return;
      }

      if (returnToPath) {
        router.replace({ pathname: returnToPath, params: returnToParams });
        return;
      }

      router.replace('/ingredients');
    },
    [isBackAction, navigation, returnToParams, returnToPath],
  );

  const handleLeaveAction = useCallback(
    (action?: NavigationAction) => {
      if (isNavigatingAfterSaveRef.current || isHandlingBackRef.current) {
        return;
      }

      if (hasUnsavedChanges || shouldConfirmOnLeave) {
        confirmLeave(() => {
          isHandlingBackRef.current = true;
          leaveScreen(action);
          setTimeout(() => {
            isHandlingBackRef.current = false;
          }, 0);
        });
        return;
      }

      isHandlingBackRef.current = true;
      leaveScreen(action);
      setTimeout(() => {
        isHandlingBackRef.current = false;
      }, 0);
    },
    [confirmLeave, hasUnsavedChanges, leaveScreen, shouldConfirmOnLeave],
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (isNavigatingAfterSaveRef.current || isHandlingBackRef.current) {
        return;
      }

      const backAction = isBackAction(event.data.action);
      if (hasUnsavedChanges || shouldConfirmOnLeave || backAction) {
        event.preventDefault();
        handleLeaveAction(event.data.action);
      }
    });

    return unsubscribe;
  }, [handleLeaveAction, hasUnsavedChanges, isBackAction, navigation, shouldConfirmOnLeave]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        handleLeaveAction({ type: 'GO_BACK' });
        return true;
      });

      return () => {
        subscription.remove();
      };
    }, [handleLeaveAction]),
  );

  const handleGoBack = useCallback(() => {
    handleLeaveAction({ type: 'GO_BACK' });
  }, [handleLeaveAction]);

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
      ? `Are you sure you want to delete\n${trimmedName}?\n\nThis action cannot be undone.`
      : 'Are you sure you want to delete this ingredient?\n\nThis action cannot be undone.';

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
            const state = navigation.getState();
            const currentIndex = state.index ?? 0;
            if (currentIndex >= 2) {
              navigation.dispatch(StackActions.pop(2));
              return;
            }
            if (returnToPath) {
              router.navigate({ pathname: returnToPath, params: returnToParams });
              return;
            }
            if (navigation.canGoBack()) {
              navigation.goBack();
              return;
            }
            router.replace('/ingredients');
          },
        },
      ],
    });
  }, [
    deleteIngredient,
    ingredient?.name,
    isEditMode,
    navigation,
    numericIngredientId,
    returnToParams,
    returnToPath,
    setHasUnsavedChanges,
    showDialog,
  ]);

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


  const styleIngredient = useMemo(() => {
    if (styleIngredientId == null) {
      return undefined;
    }

    const targetId = Number(styleIngredientId);
    if (!Number.isFinite(targetId) || targetId < 0) {
      return undefined;
    }

    return ingredients.find((item) => Number(item.id ?? -1) === targetId);
  }, [ingredients, styleIngredientId]);

  const styleIngredientPhotoSource = useMemo(
    () => resolveImageSource(styleIngredient?.photoUri),
    [styleIngredient?.photoUri],
  );

  const styleFallbackText = useMemo(() => {
    const trimmed = styleIngredient?.name.trim();
    return trimmed ? trimmed.slice(0, 2).toUpperCase() : undefined;
  }, [styleIngredient?.name]);

  const baseFallbackText = useMemo(() => {
    const trimmed = baseIngredient?.name.trim();
    return trimmed ? trimmed.slice(0, 2).toUpperCase() : undefined;
  }, [baseIngredient?.name]);

  const handleOpenStyleModal = useCallback(() => {
    setStyleSearch(styleIngredient?.name ?? '');
    setIsStyleModalVisible(true);
  }, [styleIngredient?.name]);

  const handleClearStyleIngredient = useCallback((event?: GestureResponderEvent) => {
    event?.stopPropagation?.();
    setStyleIngredientId(null);
    setStyleSearch('');
  }, []);

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

      if (styleIngredientId != null && itemId === styleIngredientId) {
        return false;
      }

      return item.baseIngredientId == null;
    });
  }, [baseIngredientId, ingredients, isEditMode, numericIngredientId, styleIngredientId]);

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
      setStyleIngredientId(null);
      setBaseSearch('');
      setIsBaseModalVisible(false);
    },
    [isEditMode, numericIngredientId],
  );

  const styledBaseIngredientIds = useMemo(() => {
    return new Set(
      ingredients
        .filter((item) => Number(item.styleIngredientId ?? -1) >= 0)
        .map((item) => Number(item.styleIngredientId)),
    );
  }, [ingredients]);

  const brandedBaseIngredientIds = useMemo(() => {
    return new Set(
      ingredients
        .filter((item) => Number(item.baseIngredientId ?? -1) >= 0)
        .map((item) => Number(item.baseIngredientId)),
    );
  }, [ingredients]);

  const renderBaseIngredient = useCallback(
    ({ item }: { item: Ingredient }) => {
      const id = Number(item.id ?? -1);
      const isSelected = Number.isFinite(id) && id >= 0 && id === baseIngredientId;
      const tagColor = item.tags?.[0]?.color;
      const isOnShoppingList = Number.isFinite(id) && id >= 0 && shoppingIngredientIds.has(id);
      const isAvailable = Number.isFinite(id) && id >= 0 && availableIngredientIds.has(id);
      const brandIndicatorColor = item.styleIngredientId != null
        ? Colors.styledIngredient
        : item.baseIngredientId != null
          ? Colors.primary
          : undefined;
      const rightIndicatorColor = Number.isFinite(id) && id >= 0
        ? brandedBaseIngredientIds.has(id)
          ? Colors.primary
          : styledBaseIngredientIds.has(id)
            ? Colors.styledIngredient
            : undefined
        : undefined;
      const rightIndicatorBottomColor = Number.isFinite(id) && id >= 0 && brandedBaseIngredientIds.has(id) && styledBaseIngredientIds.has(id)
        ? Colors.styledIngredient
        : undefined;

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
          brandIndicatorColor={brandIndicatorColor}
          rightIndicatorColor={rightIndicatorColor}
          rightIndicatorBottomColor={rightIndicatorBottomColor}
        />
      );
    },
    [
      availableIngredientIds,
      baseIngredientId,
      handleSelectBaseIngredient,
      Colors,
      shoppingIngredientIds,
      brandedBaseIngredientIds,
      styledBaseIngredientIds,
    ],
  );



  const normalizedStyleQuery = useMemo(() => normalizeSearchText(styleSearch), [styleSearch]);

  const styleIngredientOptions = useMemo(() => {
    const currentId = numericIngredientId;
    return ingredients.filter((item) => {
      const itemId = Number(item.id ?? -1);
      if (!Number.isFinite(itemId) || itemId < 0) {
        return false;
      }

      if (currentId != null && itemId === currentId) {
        return false;
      }

      if (styleIngredientId != null && itemId === styleIngredientId) {
        return true;
      }

      if (baseIngredientId != null && itemId === baseIngredientId) {
        return false;
      }

      return item.baseIngredientId == null && item.styleIngredientId == null;
    });
  }, [baseIngredientId, ingredients, numericIngredientId, styleIngredientId]);

  const filteredStyleIngredients = useMemo(() => {
    if (!normalizedStyleQuery) {
      return styleIngredientOptions;
    }

    return styleIngredientOptions.filter((candidate) => {
      const nameNormalized = candidate.searchNameNormalized ?? normalizeSearchText(candidate.name ?? '');
      if (nameNormalized.startsWith(normalizedStyleQuery)) {
        return true;
      }

      return (candidate.searchTokensNormalized ?? []).some((token) => token.startsWith(normalizedStyleQuery));
    });
  }, [normalizedStyleQuery, styleIngredientOptions]);

  const handleSelectStyleIngredient = useCallback((candidate: Ingredient) => {
    const candidateId = Number(candidate.id ?? -1);
    if (!Number.isFinite(candidateId) || candidateId < 0) {
      return;
    }

    setStyleIngredientId(candidateId);
    setBaseIngredientId(null);
    setStyleSearch('');
    setIsStyleModalVisible(false);
  }, []);

  const handleCloseStyleModal = useCallback(() => {
    const normalized = normalizeSearchText(styleSearch);
    if (normalized) {
      const match = styleIngredientOptions.find((item) =>
        item.name ? normalizeSearchText(item.name) === normalized : false,
      );

      if (match?.id != null) {
        const targetId = Number(match.id);
        if (Number.isFinite(targetId) && targetId >= 0) {
          setStyleIngredientId(targetId);
          setBaseIngredientId(null);
        }
      }
    }

    setIsStyleModalVisible(false);
    setStyleSearch('');
  }, [styleIngredientOptions, styleSearch]);

  const renderStyleIngredient = useCallback(
    ({ item }: { item: Ingredient }) => {
      const id = Number(item.id ?? -1);
      const isSelected = Number.isFinite(id) && id >= 0 && id === styleIngredientId;
      const tagColor = item.tags?.[0]?.color;
      const isOnShoppingList = Number.isFinite(id) && id >= 0 && shoppingIngredientIds.has(id);
      const isAvailable = Number.isFinite(id) && id >= 0 && availableIngredientIds.has(id);
      const brandIndicatorColor = item.styleIngredientId != null
        ? Colors.styledIngredient
        : item.baseIngredientId != null
          ? Colors.primary
          : undefined;
      const rightIndicatorColor = Number.isFinite(id) && id >= 0
        ? brandedBaseIngredientIds.has(id)
          ? Colors.primary
          : styledBaseIngredientIds.has(id)
            ? Colors.styledIngredient
            : undefined
        : undefined;
      const rightIndicatorBottomColor = Number.isFinite(id) && id >= 0 && brandedBaseIngredientIds.has(id) && styledBaseIngredientIds.has(id)
        ? Colors.styledIngredient
        : undefined;

      const control = isOnShoppingList ? (
        <View style={styles.baseShoppingIndicator}>
          <MaterialIcons name="shopping-cart" size={20} color={Colors.tint} />
        </View>
      ) : undefined;

      return (
        <ListRow
          title={item.name ?? ''}
          onPress={() => handleSelectStyleIngredient(item)}
          selected={isAvailable}
          highlightColor={Colors.highlightFaint}
          thumbnail={<Thumb label={item.name ?? undefined} uri={item.photoUri} />}
          tagColor={tagColor}
          accessibilityRole="button"
          accessibilityState={isSelected ? { selected: true } : undefined}
          control={control}
          metaAlignment="flex-start"
          brandIndicatorColor={brandIndicatorColor}
          rightIndicatorColor={rightIndicatorColor}
          rightIndicatorBottomColor={rightIndicatorBottomColor}
        />
      );
    },
    [
      Colors,
      availableIngredientIds,
      handleSelectStyleIngredient,
      shoppingIngredientIds,
      styleIngredientId,
      brandedBaseIngredientIds,
      styledBaseIngredientIds,
    ],
  );
  const baseModalKeyExtractor = useCallback((item: Ingredient) => {
    if (item.id != null) {
      return String(item.id);
    }

    return item.name ?? '';
  }, []);

  const baseSearchInputRef = useRef<TextInput | null>(null);
  const styleSearchInputRef = useRef<TextInput | null>(null);

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

  useEffect(() => {
    if (!isStyleModalVisible) {
      return;
    }

    const timeout = setTimeout(() => {
      styleSearchInputRef.current?.focus();
    }, Platform.OS === 'android' ? 50 : 0);

    return () => {
      clearTimeout(timeout);
    };
  }, [isStyleModalVisible]);

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

  const isBrandedIngredient = isEditMode && baseIngredientId != null;
  const isStyledIngredient = isEditMode && styleIngredientId != null;
  const hasBrandedVariants =
    isEditMode && numericIngredientId != null && brandedBaseIngredientIds.has(numericIngredientId);
  const hasStyledVariants =
    isEditMode && numericIngredientId != null && styledBaseIngredientIds.has(numericIngredientId);

  const baseDisableReason = hasBrandedVariants
    ? 'This ingredient is a base for branded ingredients, so it cannot be branded itself.'
    : isStyledIngredient
      ? 'Styled ingredients cannot be branded. Remove style link to enable base ingredient selection.'
      : null;
  const styleDisableReason = hasStyledVariants
    ? 'This ingredient is a base for styled ingredients, so it cannot be styled itself.'
    : isBrandedIngredient
      ? 'Branded ingredients cannot be styled. Remove base ingredient link to enable style selection.'
      : null;

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
            headerStyle: { backgroundColor: Colors.surface },
            headerShadowVisible: false,
            headerTitleStyle: {
              color: Colors.onSurface,
              fontSize: 17,
              fontWeight: "600",
            },
            headerLeft: () => (
              <HeaderIconButton
                onPress={handleGoBack}
                accessibilityLabel={t("common.goBack")}>
                <MaterialCommunityIcons
                  name={Platform.OS === 'ios' ? 'chevron-left' : 'arrow-left'}
                  size={Platform.OS === 'ios' ? 26 : 22}
                  color={Colors.onSurface}
                />
              </HeaderIconButton>
            ),
          }}
        />
        <View style={[styles.container, styles.emptyState, { backgroundColor: Colors.surface }]}>
          <Text style={[styles.emptyMessage, { color: Colors.onSurfaceVariant }]}>{t("ingredientForm.notFound")}</Text>
        </View>
      </>
    );
  }

  const formContent = (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={contentStyle}
      style={[styles.container, { backgroundColor: Colors.background }]}
      keyboardShouldPersistTaps="handled">
      <View style={sectionStyle}>
        <Text style={[styles.label, { color: Colors.onSurface }]}>{t("ingredientForm.name")}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t("ingredientForm.placeholderName")}
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
            !imageSource && { backgroundColor: Colors.surface },
          ]}
          onPress={handleSelectImageSource}
          android_ripple={{ color: `${Colors.surface}33` }}>
          {imageSource ? (
            <AppImage source={imageSource} style={[styles.image, { backgroundColor: Colors.background }]} contentFit="contain" />
          ) : (
            <View style={styles.placeholderContent}>
              <MaterialCommunityIcons name="image-plus" size={28} color={`${Colors.onSurfaceVariant}99`} />
              <Text style={[styles.placeholderHint, { color: `${Colors.onSurfaceVariant}99` }]}>{t("ingredientForm.tapToAddPhoto")}</Text>
            </View>
          )}
          {imageSource ? (
            <View
              pointerEvents="none"
              style={[styles.cropFrame, { borderColor: Colors.tint }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ) : null}
        </Pressable>
        {imageSource ? (
          <Pressable
            onPress={handleRemoveImage}
            hitSlop={8}
            style={[styles.removePhotoButton, { backgroundColor: Colors.surface }]}
            accessibilityRole="button"
            accessibilityLabel={t("common.removePhoto")}>
            <MaterialCommunityIcons name="trash-can-outline" size={18} color={Colors.error} />
          </Pressable>
        ) : null}
      </View>

      <View style={sectionStyle}>
        <View style={styles.tagHeader}>
          <Text style={[styles.label, { color: Colors.onSurface }]}>{t("ingredientForm.tags")}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.createTag")}
            onPress={handleOpenTagModal}
            style={[styles.tagAddButton, { borderColor: Colors.outlineVariant }]}>
            <MaterialCommunityIcons name="plus" size={16} color={Colors.tint} />
            <Text style={[styles.tagAddLabel, { color: Colors.tint }]}>{t("common.createTag")}</Text>
          </Pressable>
        </View>
        <Text style={[hintStyle, { color: Colors.onSurfaceVariant }]}>{t("ingredientForm.selectTags")}</Text>
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
              androidRippleColor={`${Colors.surface}33`}
            />
          ))}
        </View>
      </View>

      <View style={sectionStyle}>
        <Text style={[styles.label, { color: Colors.onSurface }]}>{t("ingredientForm.baseIngredient")}</Text>
        <Text style={[hintStyle, { color: Colors.onSurfaceVariant }]}>{t("ingredientForm.baseIngredientHint")}</Text>
        {baseDisableReason ? (
          <Text style={[hintStyle, { color: Colors.onSurfaceVariant }]}>{baseDisableReason}</Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={baseIngredient ? 'Change base ingredient' : 'Select base ingredient'}
          accessibilityState={baseDisableReason ? { disabled: true } : undefined}
          disabled={baseDisableReason != null}
          onPress={baseDisableReason ? undefined : handleOpenBaseModal}
          style={[
            styles.baseSelector,
            baseDisableReason ? styles.baseSelectorDisabled : null,
            { borderColor: Colors.outlineVariant, backgroundColor: Colors.surface },
          ]}>
          {baseIngredient ? (
            <>
              <View style={styles.baseInfo}>
                <View style={[styles.baseThumb, { backgroundColor: Colors.background }]}>
                  {baseIngredientPhotoSource ? (
                    <AppImage source={baseIngredientPhotoSource} style={styles.baseImage} contentFit="contain" />
                  ) : (
                    <View style={[styles.basePlaceholder, { backgroundColor: Colors.surfaceBright }]}>
                      {baseFallbackText ? (
                        <Text style={[styles.thumbFallback, { color: Colors.onSurfaceVariant }]}>{baseFallbackText}</Text>
                      ) : null}
                    </View>
                  )}
                </View>
                <Text style={[styles.baseName, { color: Colors.onSurface }]} numberOfLines={2}>
                  {baseIngredient.name}
                </Text>
              </View>
              <Pressable
                onPress={baseDisableReason ? undefined : handleClearBaseIngredient}
                accessibilityRole="button"
                accessibilityLabel={t("ingredientForm.removeBaseIngredient")}
                accessibilityState={baseDisableReason ? { disabled: true } : undefined}
                disabled={baseDisableReason != null}
                hitSlop={8}
                style={styles.unlinkButton}>
                <MaterialCommunityIcons name="link-off" size={20} color={Colors.error} />
              </Pressable>
            </>
          ) : (
            <View style={styles.basePlaceholderRow}>
              <Text style={[styles.basePlaceholderText, { color: Colors.onSurfaceVariant }]}>{t("common.none")}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={sectionStyle}>
        <Text style={[styles.label, { color: Colors.onSurface }]}>{t("ingredientForm.styleIngredient")}</Text>
        <Text style={[hintStyle, { color: Colors.onSurfaceVariant }]}>{t("ingredientForm.styleIngredientHint")}</Text>
        {styleDisableReason ? (
          <Text style={[hintStyle, { color: Colors.onSurfaceVariant }]}>{styleDisableReason}</Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={styleIngredient ? 'Change style ingredient' : 'Select style ingredient'}
          accessibilityState={styleDisableReason ? { disabled: true } : undefined}
          disabled={styleDisableReason != null}
          onPress={styleDisableReason ? undefined : handleOpenStyleModal}
          style={[
            styles.baseSelector,
            styleDisableReason ? styles.baseSelectorDisabled : null,
            { borderColor: Colors.outlineVariant, backgroundColor: Colors.surface },
          ]}>
          {styleIngredient ? (
            <>
              <View style={styles.baseInfo}>
                <View style={[styles.baseThumb, { backgroundColor: Colors.background }]}>
                  {styleIngredientPhotoSource ? (
                    <AppImage source={styleIngredientPhotoSource} style={styles.baseImage} contentFit="contain" />
                  ) : (
                    <View style={[styles.basePlaceholder, { backgroundColor: Colors.surfaceBright }]}>
                      {styleFallbackText ? (
                        <Text style={[styles.thumbFallback, { color: Colors.onSurfaceVariant }]}>{styleFallbackText}</Text>
                      ) : null}
                    </View>
                  )}
                </View>
                <Text style={[styles.baseName, { color: Colors.onSurface }]} numberOfLines={2}>
                  {styleIngredient.name}
                </Text>
              </View>
              <Pressable
                onPress={styleDisableReason ? undefined : handleClearStyleIngredient}
                accessibilityRole="button"
                accessibilityLabel={t("ingredientForm.removeStyleIngredient")}
                accessibilityState={styleDisableReason ? { disabled: true } : undefined}
                disabled={styleDisableReason != null}
                hitSlop={8}
                style={styles.unlinkButton}>
                <MaterialCommunityIcons name="link-off" size={20} color={Colors.error} />
              </Pressable>
            </>
          ) : (
            <View style={styles.basePlaceholderRow}>
              <Text style={[styles.basePlaceholderText, { color: Colors.onSurfaceVariant }]}>{t("common.none")}</Text>
            </View>
          )}
        </Pressable>
      </View>




      <View style={[sectionStyle, styles.descriptionSection]}>
        <Text style={[styles.label, { color: Colors.onSurface }]}>{t("ingredientForm.description")}</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={t("ingredientForm.placeholderNotes")}
          style={[
            styles.input,
            styles.multilineInput,
            { borderColor: Colors.outlineVariant, color: Colors.text, backgroundColor: Colors.surface },
          ]}
          placeholderTextColor={`${Colors.onSurfaceVariant}99`}
          multiline
          numberOfLines={8}
          textAlignVertical="top"
          onFocus={(event) => scrollFieldIntoView(event.nativeEvent.target)}
        />
      </View>

      <View style={styles.buttonsContainer}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            submitButtonStyle,
            {
              backgroundColor: Colors.tint,
              opacity: isSaving ? 0.6 : pressed ? 0.8 : 1,
            },
          ]}
          onPress={handleSubmit}
          disabled={isSaving || isPickingImage}>
          <Text style={[styles.submitLabel, { color: Colors.onPrimary }]}>{t("ingredientForm.saveIngredient")}</Text>
        </Pressable>
        {isEditMode ? (
          <View style={styles.inlineActions}>
            <Pressable
              accessibilityRole="button"
              onPress={handleDeletePress}
              style={[styles.inlineActionButton, { borderColor: Colors.error, backgroundColor: Colors.surfaceBright }]}
              accessibilityLabel={t("ingredientForm.deleteIngredient")}>
              <MaterialIcons name="delete-outline" size={18} color={Colors.error} />
              <Text style={[styles.inlineActionLabel, { color: Colors.error }]}>{t("ingredientForm.deleteIngredient")}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: isEditMode ? 'Edit ingredient' : 'Add new ingredient',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.surface },
          headerShadowVisible: false,
          headerTitleStyle: { color: Colors.onSurface, fontSize: Platform.OS === 'ios' ? 17 : 16, fontWeight: '600' },
          headerLeft: () => (
            <HeaderIconButton
              onPress={handleGoBack}
              accessibilityLabel={t("common.goBack")}>
              <MaterialCommunityIcons
                name={Platform.OS === 'ios' ? 'chevron-left' : 'arrow-left'}
                size={Platform.OS === 'ios' ? 26 : 22}
                color={Colors.onSurface}
              />
            </HeaderIconButton>
          ),
          headerRight: () => (
            <HeaderIconButton
              onPress={() => setIsHelpVisible(true)}
              accessibilityLabel={t("common.openScreenHelp")}>
              <MaterialCommunityIcons name="help-circle-outline" size={22} color={Colors.onSurface} />
            </HeaderIconButton>
          ),
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
                backgroundColor: Colors.surface,
                borderColor: Colors.outline,
                shadowColor: Colors.shadow,
              },
            ]}
            accessibilityRole="menu">
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: Colors.onSurface }]}>{t("ingredientForm.selectBaseIngredient")}</Text>
              <Pressable onPress={handleCloseBaseModal} accessibilityRole="button" accessibilityLabel={t("common.close")}>
                <MaterialCommunityIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </Pressable>
            </View>
            <TextInput
              ref={baseSearchInputRef}
              value={baseSearch}
              onChangeText={setBaseSearch}
              placeholder={t("ingredientForm.searchIngredients")}
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
              style={styles.modalList}
              ItemSeparatorComponent={({ leadingItem }) => {
                const ingredientId = Number((leadingItem as Ingredient | null)?.id ?? -1);
                const isAvailable = ingredientId >= 0 && availableIngredientIds.has(ingredientId);
                const backgroundColor = isAvailable ? Colors.outline : Colors.outlineVariant;
                return <View style={[styles.modalSeparator, { backgroundColor }]} />;
              }}
              contentContainerStyle={styles.modalListContent}
              ListEmptyComponent={() => (
                <Text style={[styles.modalEmptyText, { color: Colors.onSurfaceVariant }]}>{t("ingredientForm.noIngredientsFound")}</Text>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>



      <Modal
        visible={isStyleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseStyleModal}>
        <Pressable style={styles.modalOverlay} onPress={handleCloseStyleModal} accessibilityRole="button">
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
            accessibilityRole="menu">
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: Colors.onSurface }]}>{t("ingredientForm.selectStyleIngredient")}</Text>
              <Pressable onPress={handleCloseStyleModal} accessibilityRole="button" accessibilityLabel={t("common.close")}>
                <MaterialCommunityIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </Pressable>
            </View>
            <TextInput
              ref={styleSearchInputRef}
              value={styleSearch}
              onChangeText={setStyleSearch}
              placeholder={t("ingredientForm.searchIngredients")}
              placeholderTextColor={`${Colors.onSurfaceVariant}99`}
              style={[
                styles.modalSearchInput,
                { borderColor: Colors.outlineVariant, color: Colors.text, backgroundColor: Colors.surfaceBright },
              ]}
              autoFocus
              keyboardAppearance="light"
            />
            <FlatList
              data={filteredStyleIngredients}
              keyExtractor={baseModalKeyExtractor}
              renderItem={renderStyleIngredient}
              keyboardShouldPersistTaps="handled"
              style={styles.modalList}
              ItemSeparatorComponent={({ leadingItem }) => {
                const ingredientId = Number((leadingItem as Ingredient | null)?.id ?? -1);
                const isAvailable = ingredientId >= 0 && availableIngredientIds.has(ingredientId);
                const backgroundColor = isAvailable ? Colors.outline : Colors.outlineVariant;
                return <View style={[styles.modalSeparator, { backgroundColor }]} />;
              }}
              contentContainerStyle={styles.modalListContent}
              ListEmptyComponent={() => (
                <Text style={[styles.modalEmptyText, { color: Colors.onSurfaceVariant }]}>{t("ingredientForm.noIngredientsFound")}</Text>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <AppDialog
        visible={isHelpVisible}
        title={t("ingredientForm.helpTitle")}
        message="Use this screen to create a new ingredient card.\n\nAdd a name, optional photo, tags, base ingredient or style ingredient, and notes, then tap Save.\n\nA style ingredient can only link to a base ingredient that is neither branded nor styled."
        actions={[{ label: 'Got it', variant: 'secondary' }]}
        onRequestClose={() => setIsHelpVisible(false)}
      />

      <AppDialog
        visible={dialogOptions != null}
        title={dialogOptions?.title ?? ''}
        message={dialogOptions?.message}
        actions={dialogOptions?.actions ?? []}
        onRequestClose={closeDialog}
      />

      <TagEditorModal
        visible={isTagModalVisible}
        title={t("tagEditor.newTag")}
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
  contentCreate: {
    padding: 16,
    gap: 16,
  },
  contentEdit: {
    padding: 24,
    gap: 16,
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
    height: 56,
    minWidth: 250,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: 20,
  },
  submitButtonEdit: {
    borderRadius: 12,
    height: 56,
    minWidth: 250,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: 20,
  },
  submitLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonsContainer: {
    marginTop: 8,
    gap: 16,
  },
  inlineActions: {
    alignItems: 'center',
    marginTop: 8,
  },
  inlineActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 56,
    minWidth: 250,
    borderRadius: 10,
    borderWidth: 1,
  },
  inlineActionLabel: {
    fontSize: 14,
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
  baseSelectorDisabled: {
    opacity: 0.5,
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
  thumbFallback: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
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
    justifyContent: 'flex-start',
    paddingTop: Platform.select({ ios: 72, default: 48 }),
    paddingHorizontal: 24,
    paddingBottom: 24,
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
  modalList: {
    borderRadius: 12,
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
