import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
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
} from 'react-native';

import { resolveAssetFromCatalog } from '@/assets/image-manifest';
import { Thumb } from '@/components/RowParts';
import { SubstituteModal } from '@/components/SubstituteModal';
import { TagPill } from '@/components/TagPill';
import { BUILTIN_COCKTAIL_TAGS } from '@/constants/cocktail-tags';
import { COCKTAIL_UNIT_DICTIONARY, COCKTAIL_UNIT_OPTIONS } from '@/constants/cocktail-units';
import { GLASSWARE } from '@/constants/glassware';
import { Colors } from '@/constants/theme';
import {
  useInventory,
  type Cocktail,
  type CreateCocktailInput,
  type Ingredient,
} from '@/providers/inventory-provider';

const DEFAULT_UNIT_ID = 11;
const MIN_AUTOCOMPLETE_LENGTH = 2;
const MAX_SUGGESTIONS = 8;

type EditableSubstitute = {
  key: string;
  id?: number;
  ingredientId?: number;
  name: string;
  isBrand?: boolean;
};

type EditableIngredient = {
  key: string;
  ingredientId?: number;
  name: string;
  amount: string;
  unitId?: number;
  optional: boolean;
  garnish: boolean;
  allowBaseSubstitution: boolean;
  allowBrandSubstitution: boolean;
  substitutes: EditableSubstitute[];
};

function getParamValue(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function createUniqueKey(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function createEditableSubstitute(
  parentKey: string,
  source: { id?: number | null; ingredientId?: number | null; name?: string | null; brand?: boolean | null },
): EditableSubstitute | undefined {
  const name = source.name?.trim();
  if (!name) {
    return undefined;
  }

  const idValue = Number(source.id ?? -1);
  const substituteId = Number.isFinite(idValue) && idValue >= 0 ? Math.trunc(idValue) : undefined;

  const ingredientValue = Number(source.ingredientId ?? substituteId ?? -1);
  const substituteIngredientId =
    Number.isFinite(ingredientValue) && ingredientValue >= 0 ? Math.trunc(ingredientValue) : undefined;

  return {
    key: createUniqueKey(`sub-${parentKey}`),
    id: substituteId,
    ingredientId: substituteIngredientId,
    name,
    isBrand: source.brand ?? false,
  } satisfies EditableSubstitute;
}

function createEditableIngredient(initial?: Partial<EditableIngredient>): EditableIngredient {
  return {
    key: createUniqueKey('ingredient'),
    ingredientId: initial?.ingredientId,
    name: initial?.name ?? '',
    amount: initial?.amount ?? '',
    unitId: initial?.unitId ?? DEFAULT_UNIT_ID,
    optional: initial?.optional ?? false,
    garnish: initial?.garnish ?? false,
    allowBaseSubstitution: initial?.allowBaseSubstitution ?? false,
    allowBrandSubstitution: initial?.allowBrandSubstitution ?? false,
    substitutes: initial?.substitutes ?? [],
  } satisfies EditableIngredient;
}

function mapRecipeIngredientToEditable(recipe: NonNullable<Cocktail['ingredients']>[number]): EditableIngredient {
  const key = createUniqueKey('ingredient');
  const unitId =
    typeof recipe.unitId === 'number' && Number.isFinite(recipe.unitId) && recipe.unitId >= 0
      ? Math.trunc(recipe.unitId)
      : undefined;

  const substitutes = (recipe.substitutes ?? [])
    .map((item) =>
      createEditableSubstitute(key, {
        id: typeof item.id === 'number' ? item.id : undefined,
        ingredientId: typeof item.ingredientId === 'number' ? item.ingredientId : undefined,
        name: item.name,
        brand: (item as { brand?: boolean }).brand ?? false,
      }),
    )
    .filter((item): item is EditableSubstitute => Boolean(item));

  return {
    key,
    ingredientId:
      typeof recipe.ingredientId === 'number' && Number.isFinite(recipe.ingredientId)
        ? Math.trunc(recipe.ingredientId)
        : undefined,
    name: recipe.name ?? '',
    amount: recipe.amount ?? '',
    unitId: unitId ?? DEFAULT_UNIT_ID,
    optional: Boolean(recipe.optional),
    garnish: Boolean(recipe.garnish),
    allowBaseSubstitution: Boolean((recipe as { allowBaseSubstitution?: boolean }).allowBaseSubstitution),
    allowBrandSubstitution: Boolean((recipe as { allowBrandSubstitution?: boolean }).allowBrandSubstitution),
    substitutes,
  } satisfies EditableIngredient;
}

export default function CreateCocktailScreen() {
  const palette = Colors;
  const { ingredients: inventoryIngredients, cocktails, createCocktail } = useInventory();
  const params = useLocalSearchParams();

  const sourceParam = getParamValue(params.source);
  const ingredientParam = getParamValue(params.ingredientId);
  const ingredientNameParam = getParamValue(params.ingredientName);
  const cocktailParam = getParamValue(params.cocktailId);
  const cocktailNameParam = getParamValue(params.cocktailName);

  const [name, setName] = useState('');
  const [glassId, setGlassId] = useState<string | null>('cocktail_glass');
  const [isGlassModalVisible, setIsGlassModalVisible] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [ingredientsState, setIngredientsState] = useState<EditableIngredient[]>(() => [
    createEditableIngredient(),
  ]);
  const [unitPickerTarget, setUnitPickerTarget] = useState<string | null>(null);
  const [substituteTarget, setSubstituteTarget] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [permissionStatus, requestPermission] = ImagePicker.useMediaLibraryPermissions();

  const initializedRef = useRef(false);
  const scrollRef = useRef<ScrollView | null>(null);

  const placeholderLabel = useMemo(() => (imageUri ? 'Change photo' : 'Add photo'), [imageUri]);

  const selectedGlass = useMemo(() => GLASSWARE.find((item) => item.id === glassId), [glassId]);

  const tagSelection = useMemo(() => {
    const set = new Set(selectedTagIds);
    return BUILTIN_COCKTAIL_TAGS.map((tag) => ({
      ...tag,
      selected: set.has(tag.id),
    }));
  }, [selectedTagIds]);

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

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    let prefillCompleted = false;

    const resolveCocktail = (value?: string) => {
      if (!value) {
        return undefined;
      }
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        const byId = cocktails.find((item) => Number(item.id ?? -1) === Math.trunc(numeric));
        if (byId) {
          return byId;
        }
      }
      const normalized = value.trim().toLowerCase();
      return cocktails.find((item) => item.name?.trim().toLowerCase() === normalized);
    };

    const baseCocktail = resolveCocktail(cocktailParam) ?? resolveCocktail(cocktailNameParam);
    if (baseCocktail) {
      setName(baseCocktail.name ?? '');
      setGlassId(baseCocktail.glassId ?? 'cocktail_glass');
      setDescription(baseCocktail.description ?? '');
      setInstructions(baseCocktail.instructions ?? '');
      setImageUri(baseCocktail.photoUri ?? null);
      const mappedTags = (baseCocktail.tags ?? [])
        .map((tag) => Number(tag.id ?? -1))
        .filter((id): id is number => Number.isFinite(id) && id >= 0)
        .map((id) => Math.trunc(id));
      setSelectedTagIds(mappedTags);

      const recipe = [...(baseCocktail.ingredients ?? [])].sort(
        (a, b) => (a?.order ?? 0) - (b?.order ?? 0),
      );
      if (recipe.length) {
        setIngredientsState(recipe.map(mapRecipeIngredientToEditable));
      }
      prefillCompleted = true;
    }

    if (!prefillCompleted) {
      const resolveIngredient = (value?: string, fallbackName?: string) => {
        if (value) {
          const numeric = Number(value);
          if (Number.isFinite(numeric)) {
            const byId = inventoryIngredients.find(
              (item) => Number(item.id ?? -1) === Math.trunc(numeric),
            );
            if (byId) {
              return byId;
            }
          }
          const normalized = value.trim().toLowerCase();
          const bySlug = inventoryIngredients.find(
            (item) => item.name?.trim().toLowerCase() === normalized,
          );
          if (bySlug) {
            return bySlug;
          }
        }
        if (fallbackName) {
          const normalized = fallbackName.trim().toLowerCase();
          return inventoryIngredients.find(
            (item) => item.name?.trim().toLowerCase() === normalized,
          );
        }
        return undefined;
      };

      const baseIngredient = resolveIngredient(ingredientParam, ingredientNameParam);
      if (baseIngredient) {
        const ingredientId = Number(baseIngredient.id ?? -1);
        const preset = createEditableIngredient({
          ingredientId: Number.isFinite(ingredientId) && ingredientId >= 0 ? ingredientId : undefined,
          name: baseIngredient.name ?? '',
        });
        setIngredientsState([preset]);
        prefillCompleted = true;
      }
    }

    if (!prefillCompleted) {
      setIngredientsState([createEditableIngredient()]);
    }

    initializedRef.current = true;
  }, [
    cocktails,
    cocktailNameParam,
    cocktailParam,
    ingredientNameParam,
    ingredientParam,
    inventoryIngredients,
  ]);

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
        'Media access required',
        'Enable photo library permissions in system settings to add a cocktail photo.',
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

  const handleRemovePhoto = useCallback(() => {
    setImageUri(null);
  }, []);

  const handleToggleTag = useCallback((tagId: number) => {
    setSelectedTagIds((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId);
      }
      return [...prev, tagId];
    });
  }, []);

  const handleChangeIngredient = useCallback(
    (key: string, changes: Partial<EditableIngredient>) => {
      setIngredientsState((prev) =>
        prev.map((item) => (item.key === key ? { ...item, ...changes } : item)),
      );
    },
    [],
  );

  const handleRemoveIngredient = useCallback((key: string) => {
    setIngredientsState((prev) => {
      const next = prev.filter((item) => item.key !== key);
      return next.length > 0 ? next : [createEditableIngredient()];
    });
  }, []);

  const handleMoveIngredient = useCallback((key: string, direction: 'up' | 'down') => {
    setIngredientsState((prev) => {
      const currentIndex = prev.findIndex((item) => item.key === key);
      if (currentIndex < 0) {
        return prev;
      }

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) {
        return prev;
      }

      const next = [...prev];
      const [moved] = next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }, []);

  const handleAddIngredient = useCallback(() => {
    setIngredientsState((prev) => [...prev, createEditableIngredient()]);
  }, []);

  const handleUpdateSubstitutes = useCallback(
    (key: string, updater: (items: EditableSubstitute[]) => EditableSubstitute[]) => {
      setIngredientsState((prev) =>
        prev.map((item) =>
          item.key === key
            ? {
                ...item,
                substitutes: updater(item.substitutes),
              }
            : item,
        ),
      );
    },
    [],
  );

  const handleRemoveSubstitute = useCallback(
    (ingredientKey: string, substituteKey: string) => {
      handleUpdateSubstitutes(ingredientKey, (items) =>
        items.filter((substitute) => substitute.key !== substituteKey),
      );
    },
    [handleUpdateSubstitutes],
  );

  const handleOpenUnitPicker = useCallback((key: string) => {
    setUnitPickerTarget(key);
  }, []);

  const handleSelectUnit = useCallback(
    (unitId?: number) => {
      if (unitPickerTarget) {
        handleChangeIngredient(unitPickerTarget, { unitId });
      }
      setUnitPickerTarget(null);
    },
    [handleChangeIngredient, unitPickerTarget],
  );

  const handleCloseUnitPicker = useCallback(() => {
    setUnitPickerTarget(null);
  }, []);

    const handleOpenSubstituteModal = useCallback((key: string) => {
      setSubstituteTarget(key);
    }, []);

  const handleCloseSubstituteModal = useCallback(() => {
    setSubstituteTarget(null);
  }, []);

  const handleRequestCreateIngredient = useCallback((suggested: string) => {
    const trimmed = suggested.trim();
    if (!trimmed) {
      router.push('/ingredient/create');
      return;
    }
    router.push({ pathname: '/ingredient/create', params: { suggestedName: trimmed } });
  }, []);

  const handleSelectSubstituteCandidate = useCallback(
    (candidate: Ingredient) => {
      if (!substituteTarget) {
        return;
      }

      const nameValue = candidate.name ?? '';
      const trimmedName = nameValue.trim();
      if (!trimmedName) {
        return;
      }

      const candidateId = Number(candidate.id ?? -1);
      const numericId = Number.isFinite(candidateId) && candidateId >= 0 ? Math.trunc(candidateId) : undefined;

      const newSubstitute: EditableSubstitute = {
        key: createUniqueKey(`sub-${substituteTarget}`),
        name: trimmedName,
        id: numericId,
        ingredientId: numericId,
        isBrand: false,
      };

      handleUpdateSubstitutes(substituteTarget, (items) => {
        const normalizedName = trimmedName.toLowerCase();
        const exists = items.some((item) => {
          if (numericId != null && item.ingredientId === numericId) {
            return true;
          }
          return item.name.trim().toLowerCase() === normalizedName;
        });
        if (exists) {
          return items;
        }
        return [...items, newSubstitute];
      });
      handleCloseSubstituteModal();
    },
    [handleCloseSubstituteModal, handleUpdateSubstitutes, substituteTarget],
  );

  const handleSubmit = useCallback(() => {
    if (isSaving) {
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name is required', 'Please enter the cocktail name.');
      return;
    }

    const sanitizedIngredients = ingredientsState
      .map((item, index) => {
        const ingredientName = item.name.trim();
        if (!ingredientName) {
          return undefined;
        }

        const normalizedIngredientId =
          item.ingredientId != null ? Number(item.ingredientId) : undefined;
        const ingredientId =
          normalizedIngredientId != null &&
          Number.isFinite(normalizedIngredientId) &&
          normalizedIngredientId >= 0
            ? Math.trunc(normalizedIngredientId)
            : undefined;

        const normalizedUnitId = item.unitId != null ? Number(item.unitId) : undefined;
        const unitId =
          normalizedUnitId != null && Number.isFinite(normalizedUnitId) && normalizedUnitId >= 0
            ? Math.trunc(normalizedUnitId)
            : undefined;

        const substitutes = item.substitutes
          .map((substitute) => {
            const substituteName = substitute.name.trim();
            if (!substituteName) {
              return undefined;
            }

            const rawSubId = substitute.id != null ? Number(substitute.id) : undefined;
            const substituteId =
              rawSubId != null && Number.isFinite(rawSubId) && rawSubId >= 0
                ? Math.trunc(rawSubId)
                : undefined;

            const rawIngredientLink =
              substitute.ingredientId != null ? Number(substitute.ingredientId) : undefined;
            const substituteIngredientId =
              rawIngredientLink != null && Number.isFinite(rawIngredientLink) && rawIngredientLink >= 0
                ? Math.trunc(rawIngredientLink)
                : substituteId;

            return {
              id: substituteId,
              ingredientId: substituteIngredientId,
              name: substituteName,
              brand: substitute.isBrand ?? false,
            };
          })
          .filter(
            (
              substitute,
            ): substitute is {
              id?: number;
              ingredientId?: number;
              name: string;
              brand: boolean;
            } => Boolean(substitute),
          );

        return {
          ingredientId,
          name: ingredientName,
          amount: item.amount.trim() || undefined,
          unitId,
          optional: item.optional,
          garnish: item.garnish,
          allowBaseSubstitution: item.allowBaseSubstitution,
          allowBrandSubstitution: item.allowBrandSubstitution,
          substitutes,
          order: index + 1,
        } satisfies CreateCocktailInput['ingredients'][number];
      })
      .filter((value): value is CreateCocktailInput['ingredients'][number] => Boolean(value));

    if (!sanitizedIngredients.length) {
      Alert.alert('Recipe required', 'Add at least one ingredient to the cocktail.');
      return;
    }

    const descriptionValue = description.trim();
    const instructionsValue = instructions.trim();
    const tags = selectedTagIds
      .map((tagId) => BUILTIN_COCKTAIL_TAGS.find((tag) => tag.id === tagId))
      .filter((tag): tag is (typeof BUILTIN_COCKTAIL_TAGS)[number] => Boolean(tag));

    setIsSaving(true);
    try {
      const created = createCocktail({
        name: trimmedName,
        glassId: glassId ?? undefined,
        photoUri: imageUri ?? undefined,
        description: descriptionValue || undefined,
        instructions: instructionsValue || undefined,
        tags,
        ingredients: sanitizedIngredients,
      });

      if (!created) {
        Alert.alert('Could not save cocktail', 'Please try again later.');
        return;
      }

      const targetId = created.id ?? created.name;
      if (targetId) {
        router.replace({ pathname: '/cocktail/[cocktailId]', params: { cocktailId: String(targetId) } });
        return;
      }

      router.replace('/(tabs)/cocktails');
    } finally {
      setIsSaving(false);
    }
  }, [
    createCocktail,
    description,
    glassId,
    imageUri,
    ingredientsState,
    instructions,
    isSaving,
    name,
    selectedTagIds,
  ]);

  const handleGoBack = useCallback(() => {
    if (sourceParam === 'ingredient' && ingredientParam) {
      router.replace({
        pathname: '/ingredient/[ingredientId]',
        params: { ingredientId: String(ingredientParam) },
      });
      return;
    }

    if (sourceParam === 'cocktails') {
      router.replace('/(tabs)/cocktails');
      return;
    }

    router.back();
  }, [ingredientParam, sourceParam]);

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

  const glassImageSource = useMemo(() => {
    if (!selectedGlass?.imageUri) {
      return undefined;
    }
    return resolveAssetFromCatalog(selectedGlass.imageUri) ?? undefined;
  }, [selectedGlass?.imageUri]);

  const substituteModalIngredient = useMemo(() => {
    if (!substituteTarget) {
      return undefined;
    }
    return ingredientsState.find((item) => item.key === substituteTarget);
  }, [ingredientsState, substituteTarget]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Add cocktail',
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
          style={[styles.flex, { backgroundColor: palette.background }]}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
          <Text style={[styles.label, { color: palette.onSurface }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Margarita"
            style={[
              styles.input,
              { borderColor: palette.outlineVariant, color: palette.text, backgroundColor: palette.surface },
            ]}
            placeholderTextColor={`${palette.onSurfaceVariant}99`}
          />
        </View>

          <View style={[styles.section, styles.rowWrap]}>
            <View style={[styles.card, styles.halfCard, { backgroundColor: palette.background }]}>
              <Text style={[styles.cardLabel, { color: palette.onSurface }]}>Glass</Text>
              <Pressable
                style={styles.glassTile}
                accessibilityRole="button"
                accessibilityLabel="Select glassware"
                onPress={() => setIsGlassModalVisible(true)}>
                {glassImageSource ? (
                  <Image source={glassImageSource} style={styles.glassPreview} contentFit="contain" />
                ) : (
                  <MaterialCommunityIcons name="glass-cocktail" size={48} color={palette.onSurfaceVariant} />
                )}
              </Pressable>
            </View>

            <View style={[styles.card, styles.halfCard, { backgroundColor: palette.background }]}>
              <Text style={[styles.cardLabel, { color: palette.onSurface }]}>Photo</Text>
              <View style={styles.photoTileWrapper}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={placeholderLabel}
                  style={[styles.photoTile, !imageSource && { backgroundColor: palette.surfaceVariant }]}
                  onPress={handlePickImage}
                  android_ripple={{ color: `${palette.surface}33` }}>
                  {imageSource ? (
                    <Image source={imageSource} style={styles.photoPreview} contentFit="contain" />
                  ) : (
                    <Text style={[styles.cardHint, { color: palette.onSurfaceVariant }]}>Tap to select image</Text>
                  )}
                </Pressable>
                {imageUri ? (
                  <Pressable
                    onPress={handleRemovePhoto}
                    hitSlop={8}
                    style={styles.removePhotoButton}
                    accessibilityRole="button"
                    accessibilityLabel="Remove photo">
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={palette.error} />
                  </Pressable>
                ) : null}
              </View>
            </View>
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
                  onPress={() => handleToggleTag(tag.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: tag.selected }}
                  androidRippleColor={`${palette.surface}33`}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: palette.onSurface }]}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Optional description"
              placeholderTextColor={`${palette.onSurfaceVariant}99`}
              style={[
                styles.input,
                styles.multilineInput,
                { borderColor: palette.outlineVariant, color: palette.text, backgroundColor: palette.surface },
              ]}
              multiline
              textAlignVertical="top"
              onFocus={(event) => scrollFieldIntoView(event.nativeEvent.target)}
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: palette.onSurface }]}>Instructions</Text>
            <TextInput
              value={instructions}
              onChangeText={setInstructions}
              placeholder="1. Grab some ice..."
              placeholderTextColor={`${palette.onSurfaceVariant}99`}
              style={[
                styles.input,
                styles.multilineInput,
                { borderColor: palette.outlineVariant, color: palette.text, backgroundColor: palette.surface },
              ]}
              multiline
              textAlignVertical="top"
              onFocus={(event) => scrollFieldIntoView(event.nativeEvent.target)}
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: palette.onSurface }]}>Ingredients</Text>
            <View style={styles.ingredientsList}>
              {ingredientsState.map((ingredient, index) => (
                <EditableIngredientRow
                  key={ingredient.key}
                  ingredient={ingredient}
                  inventoryIngredients={inventoryIngredients}
                  onChange={handleChangeIngredient}
                  onRemove={handleRemoveIngredient}
                  onMove={handleMoveIngredient}
                  onRequestUnitPicker={handleOpenUnitPicker}
                  onRequestAddSubstitute={handleOpenSubstituteModal}
                  onRemoveSubstitute={handleRemoveSubstitute}
                  onRequestCreateIngredient={handleRequestCreateIngredient}
                  onInputFocus={scrollFieldIntoView}
                  palette={palette}
                  index={index}
                  totalCount={ingredientsState.length}
                />
              ))}
            </View>
          <Pressable
            onPress={handleAddIngredient}
            style={[
              styles.addIngredientButton,
              { borderColor: palette.outlineVariant, backgroundColor: palette.surface },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add ingredient">
              <MaterialCommunityIcons name="plus" size={18} color={palette.tint} />
              <Text style={[styles.addIngredientLabel, { color: palette.tint }]}>Add ingredient</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={isSaving}
            style={[styles.submitButton, { backgroundColor: palette.tint, opacity: isSaving ? 0.6 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Save cocktail">
            <Text style={[styles.submitLabel, { color: palette.onPrimary }]}>Save cocktail</Text>
          </Pressable>
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={isGlassModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsGlassModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.onSurface }]}>Select glass</Text>
              <Pressable
                onPress={() => setIsGlassModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close">
                <MaterialCommunityIcons name="close" size={22} color={palette.onSurfaceVariant} />
              </Pressable>
            </View>
            <FlatList
              data={GLASSWARE}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.glassRow}
              renderItem={({ item }) => {
                const isSelected = glassId === item.id;
                const asset = resolveAssetFromCatalog(item.imageUri);
                return (
                  <Pressable
                    onPress={() => {
                      setGlassId(item.id);
                      setIsGlassModalVisible(false);
                    }}
                    style={[
                      styles.glassOption,
                      {
                        borderColor: isSelected ? palette.tint : palette.outlineVariant,
                        backgroundColor: isSelected ? `${palette.tint}12` : palette.surface,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${item.name}`}>
                    {asset ? (
                      <Image source={asset} style={styles.glassOptionImage} contentFit="cover" />
                    ) : (
                      <MaterialCommunityIcons
                        name="glass-cocktail"
                        size={32}
                        color={palette.onSurfaceVariant}
                      />
                    )}
                    <Text style={[styles.glassOptionLabel, { color: palette.onSurface }]} numberOfLines={2}>
                      {item.name}
                    </Text>
                  </Pressable>
                );
              }}
              contentContainerStyle={styles.glassList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={unitPickerTarget != null}
        transparent
        animationType="fade"
        onRequestClose={handleCloseUnitPicker}>
        <Pressable style={styles.modalOverlay} onPress={handleCloseUnitPicker}>
          <View style={[styles.modalCardSmall, { backgroundColor: palette.surface }]}>
            <Text style={[styles.modalTitle, { color: palette.onSurface }]}>Select unit</Text>
            <ScrollView contentContainerStyle={styles.unitList}>
              <Pressable
                onPress={() => handleSelectUnit(undefined)}
                style={[styles.unitOption, { borderColor: palette.outlineVariant }]}
                accessibilityRole="button"
                accessibilityLabel="No unit">
                <Text style={[styles.unitLabel, { color: palette.onSurface }]}>No unit</Text>
              </Pressable>
              {COCKTAIL_UNIT_OPTIONS.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => handleSelectUnit(option.id)}
                  style={[styles.unitOption, { borderColor: palette.outlineVariant }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${option.label}`}>
                  <Text style={[styles.unitLabel, { color: palette.onSurface }]}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <SubstituteModal
        visible={substituteTarget != null}
        onClose={handleCloseSubstituteModal}
        onSelect={handleSelectSubstituteCandidate}
        ingredientName={substituteModalIngredient?.name}
        excludedIngredientId={substituteModalIngredient?.ingredientId}
      />
    </>
  );
}

type EditableIngredientRowProps = {
  ingredient: EditableIngredient;
  inventoryIngredients: Ingredient[];
  onChange: (key: string, changes: Partial<EditableIngredient>) => void;
  onRemove: (key: string) => void;
  onMove: (key: string, direction: 'up' | 'down') => void;
  onRequestUnitPicker: (key: string) => void;
  onRequestAddSubstitute: (key: string) => void;
  onRemoveSubstitute: (ingredientKey: string, substituteKey: string) => void;
  onRequestCreateIngredient: (name: string) => void;
  onInputFocus: (target?: number | null) => void;
  index: number;
  totalCount: number;
  palette: typeof Colors;
};

function EditableIngredientRow({
  ingredient,
  inventoryIngredients,
  onChange,
  onRemove,
  onMove,
  onRequestUnitPicker,
  onRequestAddSubstitute,
  onRemoveSubstitute,
  onRequestCreateIngredient,
  onInputFocus,
  index,
  totalCount,
  palette,
}: EditableIngredientRowProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const hideSuggestionsTimeout = useRef<NodeJS.Timeout | null>(null);
  const [infoModal, setInfoModal] = useState<'base' | 'brand' | null>(null);

  const normalizedName = ingredient.name.trim().toLowerCase();

  const canReorder = totalCount > 1;
  const canMoveUp = canReorder && index > 0;
  const canMoveDown = canReorder && index < totalCount - 1;

  const ingredientRecord = useMemo(() => {
    if (ingredient.ingredientId == null) {
      return undefined;
    }

    return inventoryIngredients.find(
      (candidate) => Number(candidate.id ?? -1) === Number(ingredient.ingredientId),
    );
  }, [ingredient.ingredientId, inventoryIngredients]);

  const baseIngredientId = useMemo(() => {
    const candidate = ingredientRecord?.baseIngredientId;
    if (candidate == null) {
      return undefined;
    }

    const parsed = Number(candidate);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : undefined;
  }, [ingredientRecord?.baseIngredientId]);

  const isBrandedIngredient = baseIngredientId != null;

  const suggestions = useMemo(() => {
    if (normalizedName.length < MIN_AUTOCOMPLETE_LENGTH) {
      return [];
    }

    const filtered = inventoryIngredients.filter((candidate) => {
      const nameNormalized = candidate.searchNameNormalized ?? candidate.name?.toLowerCase() ?? '';
      if (nameNormalized.startsWith(normalizedName)) {
        return true;
      }

      return (candidate.searchTokensNormalized ?? []).some((token) => token.startsWith(normalizedName));
    });

    return filtered.slice(0, MAX_SUGGESTIONS);
  }, [inventoryIngredients, normalizedName]);

  useEffect(() => {
    if (normalizedName.length < MIN_AUTOCOMPLETE_LENGTH) {
      return;
    }
    const exactMatch = inventoryIngredients.find((candidate) => {
      const nameNormalized = candidate.searchNameNormalized ?? candidate.name?.toLowerCase() ?? '';
      return nameNormalized === normalizedName;
    });
    const exactId = Number(exactMatch?.id ?? -1);
    const numericExactId = Number.isFinite(exactId) && exactId >= 0 ? Math.trunc(exactId) : undefined;
    if (exactMatch && ingredient.ingredientId !== numericExactId) {
      onChange(ingredient.key, {
        ingredientId: numericExactId,
        name: exactMatch.name ?? ingredient.name,
      });
    }
  }, [ingredient.key, ingredient.ingredientId, ingredient.name, inventoryIngredients, normalizedName, onChange]);

  const handleNameFocus = useCallback(() => {
    setIsFocused(true);
    setShowSuggestions(true);
    if (hideSuggestionsTimeout.current) {
      clearTimeout(hideSuggestionsTimeout.current);
      hideSuggestionsTimeout.current = null;
    }
  }, []);

  const handleNameBlur = useCallback(() => {
    setIsFocused(false);
    hideSuggestionsTimeout.current = setTimeout(() => {
      setShowSuggestions(false);
      hideSuggestionsTimeout.current = null;
    }, 120);
  }, []);

  const handleSelectSuggestion = useCallback(
    (candidate: Ingredient) => {
      if (hideSuggestionsTimeout.current) {
        clearTimeout(hideSuggestionsTimeout.current);
        hideSuggestionsTimeout.current = null;
      }
      const candidateId = Number(candidate.id ?? -1);
      const numericId = Number.isFinite(candidateId) && candidateId >= 0 ? Math.trunc(candidateId) : undefined;
      onChange(ingredient.key, {
        ingredientId: numericId,
        name: candidate.name ?? ingredient.name,
      });
      setShowSuggestions(false);
    },
    [ingredient.key, ingredient.name, onChange],
  );

  const handleToggleOptional = useCallback(() => {
    onChange(ingredient.key, { optional: !ingredient.optional });
  }, [ingredient.key, ingredient.optional, onChange]);

  const handleToggleGarnish = useCallback(() => {
    onChange(ingredient.key, { garnish: !ingredient.garnish });
  }, [ingredient.key, ingredient.garnish, onChange]);

  const handleToggleAllowBase = useCallback(() => {
    onChange(ingredient.key, { allowBaseSubstitution: !ingredient.allowBaseSubstitution });
  }, [ingredient.allowBaseSubstitution, ingredient.key, onChange]);

  const handleToggleAllowBrand = useCallback(() => {
    onChange(ingredient.key, { allowBrandSubstitution: !ingredient.allowBrandSubstitution });
  }, [ingredient.allowBrandSubstitution, ingredient.key, onChange]);

  const handleCloseInfoModal = useCallback(() => {
    setInfoModal(null);
  }, []);

  const unitLabel = useMemo(() => {
    if (ingredient.unitId == null) {
      return 'No unit';
    }
    const entry = COCKTAIL_UNIT_DICTIONARY[ingredient.unitId];
    return entry?.singular ?? 'Custom';
  }, [ingredient.unitId]);

  useEffect(() => {
    return () => {
      if (hideSuggestionsTimeout.current) {
        clearTimeout(hideSuggestionsTimeout.current);
        hideSuggestionsTimeout.current = null;
      }
    };
  }, []);

  return (
    <View style={[styles.ingredientCard, { borderColor: palette.outlineVariant, backgroundColor: palette.surface }]}>
      <View style={styles.ingredientHeaderSimple}>
        <View style={styles.ingredientTitleRow}>
          <Text style={[styles.ingredientHeading, { color: palette.onSurface }]}>{`${index + 1}. Ingredient`}</Text>
          <View
            style={[
              styles.reorderControls,
              !canReorder && styles.reorderControlsPlaceholder,
            ]}
            pointerEvents={canReorder ? 'auto' : 'none'}>
            <Pressable
              onPress={() => onMove(ingredient.key, 'up')}
              disabled={!canMoveUp}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Move ingredient up"
              style={[styles.reorderButton, !canMoveUp && styles.reorderButtonDisabled]}>
              <MaterialIcons
                name="keyboard-arrow-up"
                size={18}
                color={canMoveUp ? palette.onSurfaceVariant : `${palette.onSurfaceVariant}66`}
              />
            </Pressable>
            <Pressable
              onPress={() => onMove(ingredient.key, 'down')}
              disabled={!canMoveDown}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Move ingredient down"
              style={[styles.reorderButton, !canMoveDown && styles.reorderButtonDisabled]}>
              <MaterialIcons
                name="keyboard-arrow-down"
                size={18}
                color={canMoveDown ? palette.onSurfaceVariant : `${palette.onSurfaceVariant}66`}
              />
            </Pressable>
          </View>
        </View>
        <Pressable
          onPress={() => onRemove(ingredient.key)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Remove ingredient"
          style={!canReorder && styles.hiddenControl}
          pointerEvents={canReorder ? 'auto' : 'none'}>
          <MaterialIcons name="delete-outline" size={20} color={palette.error} />
        </Pressable>
      </View>
      <View style={styles.ingredientNameWrapper}>
        <TextInput
          value={ingredient.name}
          onChangeText={(text) => {
            const nextNormalized = text.trim().toLowerCase();
            const shouldClearId = ingredient.ingredientId != null && nextNormalized !== normalizedName;
            onChange(ingredient.key, {
              name: text,
              ingredientId: shouldClearId ? undefined : ingredient.ingredientId,
            });
          }}
          placeholder="Type ingredient name"
          placeholderTextColor={`${palette.onSurfaceVariant}99`}
          style={[
            styles.input,
            styles.ingredientNameInput,
            {
              borderColor: palette.outlineVariant,
              color: palette.text,
              paddingRight:
                showSuggestions && suggestions.length > 0 && normalizedName.length >= MIN_AUTOCOMPLETE_LENGTH ? 72 : 16,
            },
          ]}
          onFocus={(event) => {
            handleNameFocus();
            onInputFocus(event.nativeEvent.target);
          }}
          onBlur={handleNameBlur}
          autoCapitalize="words"
        />

        {showSuggestions && suggestions.length > 0 && normalizedName.length >= MIN_AUTOCOMPLETE_LENGTH ? (
          <Pressable
            onPress={() => {
              setShowSuggestions(false);
              onRequestCreateIngredient(ingredient.name);
            }}
            style={[styles.ingredientNameCreate, { backgroundColor: palette.background, borderColor: palette.outlineVariant }]}
            accessibilityRole="button"
            accessibilityLabel="Create new ingredient"
            hitSlop={8}>
            <Text style={[styles.ingredientNameCreateLabel, { color: palette.tint }]}>+ Add</Text>
          </Pressable>
        ) : null}
      </View>

      {showSuggestions && suggestions.length ? (
        <View style={[styles.suggestionList, { borderColor: palette.outlineVariant, backgroundColor: palette.surface }]}
          pointerEvents={isFocused ? 'auto' : 'none'}>
          {suggestions.map((candidate) => (
            <Pressable
              key={candidate.id ?? candidate.name}
              onPress={() => handleSelectSuggestion(candidate)}
              style={styles.suggestionItem}
              accessibilityRole="button"
              accessibilityLabel={`Use ${candidate.name ?? 'ingredient'}`}>
              <Thumb label={candidate.name ?? undefined} uri={candidate.photoUri} />
              <Text style={[styles.suggestionLabel, { color: palette.onSurface }]} numberOfLines={1}>
                {candidate.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.rowInputs}>
        <View style={styles.amountColumn}>
          <Text style={[styles.inputLabel, { color: palette.onSurfaceVariant }]}>Amount</Text>
          <TextInput
            value={ingredient.amount}
            onChangeText={(text) => onChange(ingredient.key, { amount: text })}
            placeholder="e.g. 45"
            placeholderTextColor={`${palette.onSurfaceVariant}99`}
            keyboardType="decimal-pad"
            style={[styles.input, { borderColor: palette.outlineVariant, color: palette.text }]}
            onFocus={(event) => onInputFocus(event.nativeEvent.target)}
          />
        </View>
        <View style={styles.unitColumn}>
          <Text style={[styles.inputLabel, { color: palette.onSurfaceVariant }]}>Unit</Text>
          <Pressable
            onPress={() => onRequestUnitPicker(ingredient.key)}
            style={[styles.unitSelector, { borderColor: palette.outlineVariant, backgroundColor: palette.background }]}
            accessibilityRole="button"
            accessibilityLabel="Select unit">
            <Text style={[styles.unitLabel, { color: palette.onSurface }]}>{unitLabel}</Text>
            <MaterialIcons name="expand-more" size={18} color={palette.onSurfaceVariant} />
          </Pressable>
        </View>
      </View>

      <View style={styles.toggleRow}>
        <ToggleChip label="Garnish" active={ingredient.garnish} onToggle={handleToggleGarnish} palette={palette} />
        <ToggleChip label="Optional" active={ingredient.optional} onToggle={handleToggleOptional} palette={palette} />
      </View>

      {isBrandedIngredient ? (
        <View style={styles.toggleRow}>
          <ToggleChip
            label="Allow base substitute"
            active={ingredient.allowBaseSubstitution}
            onToggle={handleToggleAllowBase}
            onInfo={() => setInfoModal('base')}
            palette={palette}
          />
          <ToggleChip
            label="Allow branded substitute"
            active={ingredient.allowBrandSubstitution}
            onToggle={handleToggleAllowBrand}
            onInfo={() => setInfoModal('brand')}
            palette={palette}
          />
        </View>
      ) : null}

      <View style={styles.substitutesSection}>
        <Pressable
          onPress={() => onRequestAddSubstitute(ingredient.key)}
          style={[
            styles.addSubstituteButton,
            { borderColor: palette.outlineVariant, backgroundColor: palette.background },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Add substitute">
          <MaterialCommunityIcons name="plus" size={16} color={palette.tint} />
          <Text style={[styles.addSubstituteLabel, { color: palette.tint }]}>Add substitute</Text>
        </Pressable>
        {ingredient.substitutes.length ? (
          <View style={styles.substitutesList}>
            {ingredient.substitutes.map((substitute) => (
              <View
                key={substitute.key}
                style={[
                  styles.substitutePill,
                  { borderColor: palette.outlineVariant, backgroundColor: palette.surfaceVariant },
                  substitute.isBrand && { borderLeftColor: palette.tint, borderLeftWidth: 4 },
                ]}>
                <Text style={[styles.substituteLabel, { color: palette.onSurface }]} numberOfLines={1}>
                  {substitute.name}
                  {substitute.isBrand ? ' • brand' : ''}
                </Text>
                <Pressable
                  onPress={() => onRemoveSubstitute(ingredient.key, substitute.key)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${substitute.name}`}>
                  <MaterialCommunityIcons name="close" size={16} color={palette.onSurfaceVariant} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <Modal
        visible={infoModal != null}
        transparent
        animationType="fade"
        onRequestClose={handleCloseInfoModal}>
        <Pressable style={styles.modalOverlay} onPress={handleCloseInfoModal}>
          <View style={[styles.modalCardSmall, { backgroundColor: palette.surface }]}>
            <Text style={[styles.modalTitle, { color: palette.onSurface }]}>
              {infoModal === 'brand' ? 'Allow branded substitute' : 'Allow base substitute'}
            </Text>
            <Text style={[styles.modalSubtitle, { color: palette.onSurfaceVariant }]}>
              {infoModal === 'brand'
                ? "If the specified ingredient isn't available, the cocktail will be shown as available with branded ingredients of the base."
                : "If the specified ingredient isn't available, the cocktail will be shown as available with its base ingredient."}
            </Text>
            <Pressable
              onPress={handleCloseInfoModal}
              style={[styles.modalActionButton, { backgroundColor: palette.tint }]}
              accessibilityRole="button"
              accessibilityLabel="Close info">
              <Text style={[styles.modalActionLabel, { color: palette.onPrimary }]}>OK</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

type ToggleChipProps = {
  label: string;
  active: boolean;
  onToggle: () => void;
  onInfo?: () => void;
  palette: typeof Colors;
};

function ToggleChip({ label, active, onToggle, onInfo, palette }: ToggleChipProps) {
  return (
    <View style={styles.toggleChipContainer}>
      <Pressable
        onPress={onToggle}
        style={[
          styles.toggleChip,
          {
            backgroundColor: active ? `${palette.tint}1A` : 'transparent',
          },
        ]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: active }}>
        <MaterialCommunityIcons
          name={active ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
          size={18}
          color={active ? palette.tint : palette.onSurfaceVariant}
        />
        <Text style={[styles.toggleChipLabel, { color: palette.onSurfaceVariant }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
      {onInfo ? (
        <Pressable onPress={onInfo} hitSlop={8} accessibilityRole="button" accessibilityLabel={`About ${label}`}>
          <MaterialCommunityIcons name="information-outline" size={16} color={palette.onSurfaceVariant} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 20,
    paddingBottom: 120,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    backgroundColor: Colors.background,
  },
  multilineInput: {
    minHeight: 120,
  },
  rowWrap: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  card: {
    borderRadius: 12,
    padding: 12,
    gap: 8,
    backgroundColor: Colors.surface,
  },
  halfCard: {
    flex: 1,
    minWidth: '48%',
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  glassTile: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
  },
  glassPreview: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
  },
  cardHint: {
    fontSize: 12,
  },
  photoTileWrapper: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    position: 'relative',
  },
  photoTile: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  glassRow: {
    justifyContent: 'space-between',
    gap: 16,
  },
  glassOption: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 12,
  },
  glassOptionImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  glassOptionLabel: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  glassList: {
    gap: 16,
    paddingBottom: 16,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  manageTagsLink: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
  addIngredientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
    width: '50%',
    alignSelf: 'flex-start',
  },
  addIngredientLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  ingredientsList: {
    gap: 16,
  },
  ingredientCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  ingredientHeaderSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ingredientTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  ingredientHeading: {
    fontSize: 14,
    fontWeight: '600',
  },
  reorderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 6,
  },
  reorderControlsPlaceholder: {
    opacity: 0,
  },
  reorderButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  reorderButtonDisabled: {
    opacity: 0.6,
  },
  hiddenControl: {
    opacity: 0,
  },
  ingredientNameInput: {
    flex: 1,
  },
  ingredientNameWrapper: {
    position: 'relative',
  },
  ingredientNameCreate: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    gap: 4,
  },
  ingredientNameCreateLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  suggestionList: {
    position: 'absolute',
    top: 86,
    left: 0,
    right: 0,
    zIndex: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 4,
    gap: 4,
    backgroundColor: Colors.surface,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  suggestionLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  amountColumn: {
    flex: 1,
    gap: 6,
  },
  unitColumn: {
    flex: 1,
    gap: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  unitSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  unitLabel: {
    fontSize: 14,
    fontWeight: '400',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  toggleChipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  toggleChipLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.onSurfaceVariant,
  },
  substitutesSection: {
    gap: 10,
  },
  addSubstituteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 52,
    width: '50%',
    alignSelf: 'flex-start',
  },
  addSubstituteLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  substitutesList: {
    gap: 8,
  },
  substitutePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  substituteLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  substituteHint: {
    fontSize: 14,
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
  bottomSpacer: {
    height: 200,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 12,
    padding: 20,
    gap: 16,
    maxHeight: '90%',
  },
  modalCardSmall: {
    borderRadius: 12,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  modalActionButton: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalActionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalListContent: {
    gap: 8,
    paddingBottom: 12,
  },
  modalEmptyText: {
    textAlign: 'center',
    fontSize: 14,
    marginTop: 24,
  },
  unitList: {
    gap: 12,
  },
  unitOption: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButton: {
    padding: 6,
    borderRadius: 8,
  },
});
