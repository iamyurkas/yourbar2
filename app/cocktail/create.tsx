import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resolveAssetFromCatalog, resolveGlasswareUriFromId } from '@/assets/image-manifest';
import { TagPill } from '@/components/TagPill';
import { GLASSWARE } from '@/constants/glassware';
import { BUILTIN_COCKTAIL_TAGS } from '@/constants/cocktail-tags';
import { Colors } from '@/constants/theme';
import { UNIT_LABELS, UNIT_OPTIONS } from '@/constants/units';
import {
  useInventory,
  type CocktailTag,
  type Ingredient,
  type CreateCocktailIngredientInput,
} from '@/providers/inventory-provider';
import { palette as appPalette } from '@/theme/theme';

const MIN_AUTOCOMPLETE_LENGTH = 2;

type SubstituteSelection = { id?: number; name: string; isBranded?: boolean };

type EditableIngredient = {
  key: string;
  name: string;
  ingredientId?: number;
  amount: string;
  unitId?: number;
  garnish: boolean;
  optional: boolean;
  allowSubstitutes: boolean;
  substitutes: SubstituteSelection[];
};

type SourceParam = 'cocktails' | 'ingredient' | undefined;

type SubstituteModalState = {
  visible: boolean;
  targetKey?: string;
  search: string;
};

type UnitPickerState = {
  visible: boolean;
  targetKey?: string;
};

function getParamValue(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function isBrandedIngredient(ingredient?: Ingredient | null) {
  if (!ingredient) {
    return false;
  }

  const baseId = Number(ingredient.baseIngredientId ?? -1);
  return Number.isFinite(baseId) && baseId >= 0;
}

export default function CreateCocktailScreen() {
  const palette = Colors;
  const params = useLocalSearchParams<{
    source?: string | string[];
    ingredientId?: string | string[];
    ingredientName?: string | string[];
  }>();
  const { ingredients, createCocktail } = useInventory();
  const [permissionStatus, requestPermission] = ImagePicker.useMediaLibraryPermissions();

  const sourceParam = getParamValue(params.source) as SourceParam;
  const ingredientParam = getParamValue(params.ingredientId);
  const ingredientNameParam = getParamValue(params.ingredientName);

  const ingredientByName = useMemo(() => {
    const map = new Map<string, Ingredient>();
    ingredients.forEach((item) => {
      if (item.name) {
        map.set(item.name.toLowerCase(), item);
      }
    });
    return map;
  }, [ingredients]);

  const resolvedInitialIngredient = useMemo(() => {
    if (ingredientParam) {
      const numericId = Number(ingredientParam);
      if (!Number.isNaN(numericId)) {
        const byId = ingredients.find((item) => Number(item.id ?? -1) === numericId);
        if (byId) {
          return byId;
        }
      }

      const normalized = ingredientParam.toLowerCase();
      const byName = ingredientByName.get(normalized);
      if (byName) {
        return byName;
      }
    }

    if (ingredientNameParam) {
      const normalized = ingredientNameParam.toLowerCase();
      const byName = ingredientByName.get(normalized);
      if (byName) {
        return byName;
      }
    }

    return undefined;
  }, [ingredientByName, ingredientParam, ingredientNameParam, ingredients]);

  const ingredientKeyRef = useRef(0);
  const pendingIngredientSlotRef = useRef<string | null>(null);
  const knownIngredientIdsRef = useRef<Set<number>>(new Set());
  const initialIngredientAppliedRef = useRef(false);

  const makeIngredientRow = useCallback(
    (partial?: Partial<EditableIngredient>): EditableIngredient => {
      ingredientKeyRef.current += 1;
      const key = `ingredient-${Date.now()}-${ingredientKeyRef.current}`;
      return {
        key,
        name: partial?.name ?? '',
        ingredientId: partial?.ingredientId,
        amount: partial?.amount ?? '',
        unitId: partial?.unitId,
        garnish: partial?.garnish ?? false,
        optional: partial?.optional ?? false,
        allowSubstitutes: partial?.allowSubstitutes ?? false,
        substitutes: partial?.substitutes ? [...partial.substitutes] : [],
      } satisfies EditableIngredient;
    },
    [],
  );

  const [name, setName] = useState('');
  const [glassId, setGlassId] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [ingredientRows, setIngredientRows] = useState<EditableIngredient[]>([makeIngredientRow()]);
  const [activeIngredientKey, setActiveIngredientKey] = useState<string | null>(null);
  const [unitPicker, setUnitPicker] = useState<UnitPickerState>({ visible: false });
  const [substituteModal, setSubstituteModal] = useState<SubstituteModalState>({
    visible: false,
    search: '',
  });
  const [isGlassModalVisible, setIsGlassModalVisible] = useState(false);
  const [isTagModalVisible, setIsTagModalVisible] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!resolvedInitialIngredient || initialIngredientAppliedRef.current) {
      return;
    }

    initialIngredientAppliedRef.current = true;
    const resolvedId = Number(resolvedInitialIngredient.id ?? -1);

    setIngredientRows((rows) => {
      if (rows.length === 0) {
        return [
          makeIngredientRow({
            name: resolvedInitialIngredient.name ?? '',
            ingredientId: Number.isFinite(resolvedId) && resolvedId >= 0 ? resolvedId : undefined,
          }),
        ];
      }

      const firstRow = rows[0];
      if (!firstRow.name && firstRow.ingredientId == null) {
        const updatedFirst: EditableIngredient = {
          ...firstRow,
          name: resolvedInitialIngredient.name ?? '',
          ingredientId: Number.isFinite(resolvedId) && resolvedId >= 0 ? resolvedId : undefined,
        };
        return [updatedFirst, ...rows.slice(1)];
      }

      return [
        makeIngredientRow({
          name: resolvedInitialIngredient.name ?? '',
          ingredientId: Number.isFinite(resolvedId) && resolvedId >= 0 ? resolvedId : undefined,
        }),
        ...rows,
      ];
    });
  }, [makeIngredientRow, resolvedInitialIngredient]);

  useEffect(() => {
    const ids = new Set<number>();
    ingredients.forEach((item) => {
      const idValue = Number(item.id ?? -1);
      if (Number.isFinite(idValue) && idValue >= 0) {
        ids.add(idValue);
      }
    });

    if (pendingIngredientSlotRef.current) {
      const previousIds = knownIngredientIdsRef.current;
      const newIngredients = ingredients.filter((item) => {
        const idValue = Number(item.id ?? -1);
        return Number.isFinite(idValue) && idValue >= 0 && !previousIds.has(idValue);
      });

      const selected = newIngredients[0];
      const slotKey = pendingIngredientSlotRef.current;
      if (selected && slotKey) {
        const numericId = Number(selected.id ?? -1);
        setIngredientRows((rows) =>
          rows.map((row) => {
            if (row.key !== slotKey) {
              return row;
            }

            return {
              ...row,
              name: selected.name ?? row.name,
              ingredientId: Number.isFinite(numericId) && numericId >= 0 ? numericId : row.ingredientId,
            } satisfies EditableIngredient;
          }),
        );
        pendingIngredientSlotRef.current = null;
      }
    }

    knownIngredientIdsRef.current = ids;
  }, [ingredients]);

  const handleClose = useCallback(() => {
    if (sourceParam === 'ingredient' && ingredientParam) {
      if (router.canGoBack()) {
        router.back();
        return;
      }

      router.replace({
        pathname: '/ingredient/[ingredientId]',
        params: { ingredientId: ingredientParam },
      });
      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/cocktails');
    }
  }, [ingredientParam, sourceParam]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        handleClose();
        return true;
      });

      return () => subscription.remove();
    }, [handleClose]),
  );

  const placeholderLabel = useMemo(() => (photoUri ? 'Change photo' : 'Add photo'), [photoUri]);

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
        'Enable photo library permissions in system settings to add a cocktail image.',
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
          setPhotoUri(asset.uri);
        }
      }
    } catch (error) {
      console.warn('Failed to pick image', error);
      Alert.alert('Could not pick image', 'Please try again later.');
    } finally {
      setIsPickingImage(false);
    }
  }, [ensureMediaPermission, isPickingImage]);

  const selectedGlass = useMemo(() => GLASSWARE.find((item) => item.id === glassId), [glassId]);

  const selectedGlassSource = useMemo(() => {
    if (!glassId) {
      return undefined;
    }

    const uri = resolveGlasswareUriFromId(glassId);
    if (!uri) {
      return undefined;
    }

    return resolveAssetFromCatalog(uri) ?? { uri };
  }, [glassId]);

  const toggleTag = useCallback((id: number) => {
    setSelectedTagIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((tagId) => tagId !== id);
      }

      return [...prev, id];
    });
  }, []);

  const tagSelection = useMemo(() => {
    const set = new Set(selectedTagIds);
    return BUILTIN_COCKTAIL_TAGS.map((tag) => ({
      ...tag,
      selected: set.has(tag.id),
    }));
  }, [selectedTagIds]);

  const ingredientSuggestions = useMemo(() => {
    if (!activeIngredientKey) {
      return [];
    }

    const activeRow = ingredientRows.find((row) => row.key === activeIngredientKey);
    if (!activeRow) {
      return [];
    }

    const query = activeRow.name.trim().toLowerCase();
    if (query.length < MIN_AUTOCOMPLETE_LENGTH) {
      return [];
    }

    const seenIds = new Set<number>();
    return ingredients
      .filter((ingredient) => {
        if (!ingredient.searchNameNormalized) {
          return false;
        }

        const idValue = Number(ingredient.id ?? -1);
        if (Number.isFinite(idValue)) {
          if (seenIds.has(idValue)) {
            return false;
          }
          seenIds.add(idValue);
        }

        if (ingredient.searchNameNormalized.includes(query)) {
          return true;
        }

        return ingredient.searchTokensNormalized.some((token) => token.includes(query));
      })
      .slice(0, 8);
  }, [activeIngredientKey, ingredientRows, ingredients]);

  const updateIngredientRow = useCallback((key: string, updates: Partial<EditableIngredient>) => {
    setIngredientRows((rows) =>
      rows.map((row) => {
        if (row.key !== key) {
          return row;
        }

        const nextSubstitutes = updates.substitutes
          ? [...updates.substitutes]
          : row.substitutes;

        return {
          ...row,
          ...updates,
          substitutes: nextSubstitutes,
        } satisfies EditableIngredient;
      }),
    );
  }, []);

  const handleIngredientNameChange = useCallback((key: string, text: string) => {
    setIngredientRows((rows) =>
      rows.map((row) => {
        if (row.key !== key) {
          return row;
        }

        return {
          ...row,
          name: text,
          ingredientId: undefined,
        } satisfies EditableIngredient;
      }),
    );
  }, []);

  const handleIngredientNameBlur = useCallback(
    (key: string) => {
      setIngredientRows((rows) =>
        rows.map((row) => {
          if (row.key !== key) {
            return row;
          }

          const normalized = row.name.trim().toLowerCase();
          if (!normalized) {
            return row;
          }

          const match = ingredientByName.get(normalized);
          if (!match) {
            return row;
          }

          const numericId = Number(match.id ?? -1);
          return {
            ...row,
            name: match.name ?? row.name,
            ingredientId: Number.isFinite(numericId) && numericId >= 0 ? numericId : row.ingredientId,
          } satisfies EditableIngredient;
        }),
      );
    },
    [ingredientByName],
  );

  const handleSelectSuggestion = useCallback(
    (ingredient: Ingredient) => {
      if (!activeIngredientKey) {
        return;
      }

      const numericId = Number(ingredient.id ?? -1);
      setIngredientRows((rows) =>
        rows.map((row) => {
          if (row.key !== activeIngredientKey) {
            return row;
          }

          return {
            ...row,
            name: ingredient.name ?? row.name,
            ingredientId: Number.isFinite(numericId) && numericId >= 0 ? numericId : row.ingredientId,
          } satisfies EditableIngredient;
        }),
      );
      setActiveIngredientKey(null);
    },
    [activeIngredientKey],
  );
  const handleAddIngredientRow = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIngredientRows((rows) => [...rows, makeIngredientRow()]);
  }, [makeIngredientRow]);

  const handleRemoveIngredient = useCallback((key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIngredientRows((rows) => {
      if (rows.length <= 1) {
        return rows;
      }

      return rows.filter((row) => row.key !== key);
    });
  }, []);

  const handleMoveIngredient = useCallback((key: string, direction: number) => {
    if (!direction) {
      return;
    }

    setIngredientRows((rows) => {
      const index = rows.findIndex((row) => row.key === key);
      if (index === -1) {
        return rows;
      }

      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= rows.length) {
        return rows;
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const next = [...rows];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }, []);

  const handleOpenUnitPicker = useCallback((key: string) => {
    setUnitPicker({ visible: true, targetKey: key });
  }, []);

  const handleCloseUnitPicker = useCallback(() => {
    setUnitPicker({ visible: false });
  }, []);

  const handleSelectUnit = useCallback(
    (unitId?: number) => {
      setUnitPicker((prev) => {
        if (prev.targetKey) {
          updateIngredientRow(prev.targetKey, { unitId });
        }
        return { visible: false } satisfies UnitPickerState;
      });
    },
    [updateIngredientRow],
  );

  const handleOpenSubstituteModal = useCallback((key: string) => {
    setSubstituteModal({ visible: true, targetKey: key, search: '' });
  }, []);

  const handleCloseSubstituteModal = useCallback(() => {
    setSubstituteModal({ visible: false, targetKey: undefined, search: '' });
  }, []);

  const handleSubstituteSearchChange = useCallback((text: string) => {
    setSubstituteModal((prev) => ({ ...prev, search: text }));
  }, []);

  const substituteOptions = useMemo(() => {
    if (!substituteModal.visible) {
      return [];
    }

    const query = substituteModal.search.trim().toLowerCase();
    if (!query) {
      return ingredients.slice(0, 30);
    }

    return ingredients
      .filter((ingredient) => {
        if (!ingredient.searchNameNormalized) {
          return false;
        }

        if (ingredient.searchNameNormalized.includes(query)) {
          return true;
        }

        return ingredient.searchTokensNormalized.some((token) => token.includes(query));
      })
      .slice(0, 30);
  }, [ingredients, substituteModal.search, substituteModal.visible]);

  const handleSelectSubstitute = useCallback(
    (ingredient: Ingredient) => {
      if (!substituteModal.targetKey) {
        return;
      }

      const targetKey = substituteModal.targetKey;
      const numericId = Number(ingredient.id ?? -1);
      const normalizedName = ingredient.name?.toLowerCase() ?? '';

      setIngredientRows((rows) =>
        rows.map((row) => {
          if (row.key !== targetKey) {
            return row;
          }

          const alreadyExists = row.substitutes.some((substitute) => {
            if (substitute.id != null && Number(substitute.id) === numericId) {
              return true;
            }

            return substitute.name.toLowerCase() === normalizedName;
          });

          if (alreadyExists) {
            return row;
          }

          const nextSubstitutes: SubstituteSelection[] = [
            ...row.substitutes,
            {
              id: Number.isFinite(numericId) && numericId >= 0 ? numericId : undefined,
              name: ingredient.name ?? '',
              isBranded: isBrandedIngredient(ingredient),
            },
          ];

          return {
            ...row,
            substitutes: nextSubstitutes,
          } satisfies EditableIngredient;
        }),
      );
    },
    [substituteModal.targetKey],
  );

  const handleRemoveSubstitute = useCallback((key: string, index: number) => {
    setIngredientRows((rows) =>
      rows.map((row) => {
        if (row.key !== key) {
          return row;
        }

        const next = row.substitutes.filter((_, substituteIndex) => substituteIndex !== index);
        return {
          ...row,
          substitutes: next,
        } satisfies EditableIngredient;
      }),
    );
  }, []);

  const handleCreateIngredientFromRow = useCallback((key: string) => {
    pendingIngredientSlotRef.current = key;
    router.push({ pathname: '/ingredient/create', params: { source: 'cocktail' } });
  }, []);

  const selectedTags = useMemo(() => {
    return selectedTagIds
      .map((id) => BUILTIN_COCKTAIL_TAGS.find((tag) => tag.id === id))
      .filter((tag): tag is CocktailTag => Boolean(tag));
  }, [selectedTagIds]);

  const handleSave = useCallback(() => {
    if (isSaving) {
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name is required', 'Please enter the cocktail name.');
      return;
    }

    const sanitizedIngredients = ingredientRows
      .map((row) => {
        const trimmedIngredientName = row.name.trim();
        if (!trimmedIngredientName) {
          return null;
        }

        const substitutes =
          row.substitutes.length > 0
            ? row.substitutes.map((substitute) => ({ id: substitute.id, name: substitute.name }))
            : undefined;

        return {
          name: trimmedIngredientName,
          ingredientId: row.ingredientId,
          amount: row.amount.trim() || undefined,
          unitId: row.unitId,
          garnish: row.garnish || undefined,
          optional: row.optional || undefined,
          allowSubstitutes: row.allowSubstitutes || undefined,
          substitutes,
        } satisfies CreateCocktailIngredientInput;
      })
      .filter((value): value is CreateCocktailIngredientInput => Boolean(value));

    if (!sanitizedIngredients.length) {
      Alert.alert('Add ingredients', 'Please add at least one ingredient.');
      return;
    }

    const selectedTagObjects = selectedTagIds
      .map((id) => BUILTIN_COCKTAIL_TAGS.find((tag) => tag.id === id))
      .filter((tag): tag is CocktailTag => Boolean(tag));

    setIsSaving(true);
    try {
      const created = createCocktail({
        name: trimmedName,
        glassId: glassId ?? undefined,
        description: description.trim() || undefined,
        instructions: instructions.trim() || undefined,
        photoUri: photoUri ?? undefined,
        tags: selectedTagObjects,
        ingredients: sanitizedIngredients,
      });

      if (!created) {
        Alert.alert('Could not save cocktail', 'Please check the form and try again.');
        return;
      }

      const targetId = created.id ?? created.name;
      if (!targetId) {
        router.replace('/(tabs)/cocktails');
        return;
      }

      router.replace({ pathname: '/cocktail/[cocktailId]', params: { cocktailId: String(targetId) } });
    } finally {
      setIsSaving(false);
    }
  }, [
    createCocktail,
    description,
    glassId,
    ingredientRows,
    instructions,
    isSaving,
    name,
    photoUri,
    selectedTagIds,
  ]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}> 
      <Stack.Screen
        options={{
          title: 'New cocktail',
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={handleClose}
              style={[styles.headerButton, { backgroundColor: `${palette.outline}55` }]}
              accessibilityRole="button"
              accessibilityLabel="Go back">
              <MaterialIcons name="arrow-back" size={22} color={palette.onSurface} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.select({ ios: 12, default: 0 }) ?? 0}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { backgroundColor: palette.background }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: palette.onSurfaceVariant }]}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Cocktail name"
              placeholderTextColor={palette.onSurfaceVariant}
              style={[styles.textInput, { borderColor: palette.outline, color: palette.onSurface }]}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.mediaRow}>
            <Pressable
              style={[styles.glassSelector, { borderColor: palette.outline, backgroundColor: palette.surface }]}
              onPress={() => setIsGlassModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Select glass">
              {selectedGlassSource ? (
                <Image source={selectedGlassSource} style={styles.glassImage} contentFit="cover" />
              ) : (
                <View style={styles.glassPlaceholder}>
                  <MaterialCommunityIcons
                    name="glass-mug-variant"
                    size={32}
                    color={palette.onSurfaceVariant}
                  />
                  <Text style={[styles.placeholder, { color: palette.onSurfaceVariant }]}>Choose glass</Text>
                </View>
              )}
              {selectedGlass ? (
                <Text style={[styles.glassLabel, { color: palette.onSurface }]}>{selectedGlass.name}</Text>
              ) : null}
            </Pressable>

            <Pressable
              style={[styles.photoTile, { borderColor: palette.outline }]}
              onPress={handlePickImage}
              accessibilityRole="button"
              accessibilityLabel="Add cocktail photo">
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoImage} contentFit="cover" />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <MaterialCommunityIcons
                    name="camera-plus"
                    size={30}
                    color={palette.onSurfaceVariant}
                  />
                  <Text style={[styles.placeholder, { color: palette.onSurfaceVariant }]}>{placeholderLabel}</Text>
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: palette.onSurface }]}>Tags</Text>
              <Pressable
                onPress={() => setIsTagModalVisible(true)}
                style={styles.manageButton}
                accessibilityRole="button"
                accessibilityLabel="Manage tags">
                <Text style={[styles.manageButtonLabel, { color: palette.tint }]}>Manage</Text>
              </Pressable>
            </View>
            {selectedTags.length ? (
              <View style={styles.tagList}>
                {selectedTags.map((tag) => (
                  <Pressable key={tag.id} onPress={() => toggleTag(tag.id)}>
                    <TagPill
                      name={tag.name}
                      color={tag.color}
                      selected
                    />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={[styles.placeholder, { color: palette.onSurfaceVariant }]}>No tags yet</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.onSurface }]}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Short description"
              placeholderTextColor={palette.onSurfaceVariant}
              multiline
              textAlignVertical="top"
              style={[styles.multilineInput, { borderColor: palette.outline, color: palette.onSurface }]}
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.onSurface }]}>Instructions</Text>
            <TextInput
              value={instructions}
              onChangeText={setInstructions}
              placeholder="Step-by-step instructions"
              placeholderTextColor={palette.onSurfaceVariant}
              multiline
              textAlignVertical="top"
              style={[styles.multilineInput, { borderColor: palette.outline, color: palette.onSurface }]}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: palette.onSurface }]}>Ingredients</Text>
              <Pressable
                onPress={handleAddIngredientRow}
                accessibilityRole="button"
                style={styles.manageButton}
                accessibilityLabel="Add ingredient row">
                <Text style={[styles.manageButtonLabel, { color: palette.tint }]}>+ Add</Text>
              </Pressable>
            </View>

            <View style={styles.ingredientList}>
              {ingredientRows.map((row, index) => (
                <View
                  key={row.key}
                  style={[styles.ingredientCard, { backgroundColor: palette.surface }]}>
                  <View style={styles.ingredientHeader}>
                    <Text style={[styles.ingredientTitle, { color: palette.onSurface }]}>Ingredient {index + 1}</Text>
                    <View style={styles.ingredientHeaderActions}>
                      <Pressable
                        onPress={() => handleMoveIngredient(row.key, -1)}
                        disabled={index === 0}
                        style={[styles.headerIconButton, { backgroundColor: `${palette.outline}55` }]}
                        accessibilityRole="button"
                        accessibilityLabel="Move ingredient up">
                        <MaterialIcons
                          name="arrow-upward"
                          size={18}
                          color={index === 0 ? palette.onSurfaceVariant : palette.onSurface}
                        />
                      </Pressable>
                      <Pressable
                        onPress={() => handleMoveIngredient(row.key, 1)}
                        disabled={index === ingredientRows.length - 1}
                        style={[styles.headerIconButton, { backgroundColor: `${palette.outline}55` }]}
                        accessibilityRole="button"
                        accessibilityLabel="Move ingredient down">
                        <MaterialIcons
                          name="arrow-downward"
                          size={18}
                          color={index === ingredientRows.length - 1 ? palette.onSurfaceVariant : palette.onSurface}
                        />
                      </Pressable>
                      <Pressable
                        onPress={() => handleRemoveIngredient(row.key)}
                        disabled={ingredientRows.length <= 1}
                        style={[styles.headerIconButton, { backgroundColor: `${palette.error}1A` }]}
                        accessibilityRole="button"
                        accessibilityLabel="Remove ingredient">
                        <MaterialIcons
                          name="delete"
                          size={18}
                          color={ingredientRows.length <= 1 ? palette.onSurfaceVariant : palette.error}
                        />
                      </Pressable>
                    </View>
                  </View>

                  <TextInput
                    value={row.name}
                    onChangeText={(text) => handleIngredientNameChange(row.key, text)}
                    onFocus={() => setActiveIngredientKey(row.key)}
                    onBlur={() => handleIngredientNameBlur(row.key)}
                    placeholder="Ingredient name"
                    placeholderTextColor={palette.onSurfaceVariant}
                    style={[styles.textInput, styles.inputCompact, { borderColor: palette.outline, color: palette.onSurface }]}
                    autoCapitalize="words"
                  />

                  {activeIngredientKey === row.key && ingredientSuggestions.length > 0 ? (
                    <View
                      style={[
                        styles.suggestionList,
                        { borderColor: palette.outline, backgroundColor: palette.surfaceVariant },
                      ]}>
                      {ingredientSuggestions.map((suggestion) => (
                        <Pressable
                          key={String(suggestion.id ?? suggestion.name)}
                          style={styles.suggestionItem}
                          onPress={() => handleSelectSuggestion(suggestion)}>
                          <Text style={[styles.suggestionLabel, { color: palette.onSurface }]}>
                            {suggestion.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.inlineRow}>
                    <View style={styles.amountContainer}>
                      <Text style={[styles.inlineLabel, { color: palette.onSurfaceVariant }]}>Amount</Text>
                      <TextInput
                        value={row.amount}
                        onChangeText={(text) => updateIngredientRow(row.key, { amount: text })}
                        placeholder="e.g. 45"
                        placeholderTextColor={palette.onSurfaceVariant}
                        keyboardType="decimal-pad"
                        style={[styles.textInput, styles.inputCompact, { borderColor: palette.outline, color: palette.onSurface }]}
                      />
                    </View>
                    <View style={styles.unitContainer}>
                      <Text style={[styles.inlineLabel, { color: palette.onSurfaceVariant }]}>Unit</Text>
                      <Pressable
                        onPress={() => handleOpenUnitPicker(row.key)}
                        style={[styles.unitButton, { borderColor: palette.outline }]}
                        accessibilityRole="button"
                        accessibilityLabel="Select unit">
                        <Text style={[styles.unitLabel, { color: palette.onSurface }]}> 
                          {row.unitId != null ? UNIT_LABELS[row.unitId]?.singular ?? 'Custom' : 'Select unit'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.flagRow}>
                    <View style={styles.flagItem}>
                      <Switch
                        value={row.garnish}
                        onValueChange={(value) => updateIngredientRow(row.key, { garnish: value })}
                        trackColor={{ true: palette.tint, false: `${palette.outline}55` }}
                        thumbColor={Platform.OS === 'android' ? (row.garnish ? palette.onPrimary : palette.surface) : undefined}
                      />
                      <Text style={[styles.flagLabel, { color: palette.onSurface }]}>Garnish</Text>
                    </View>
                    <View style={styles.flagItem}>
                      <Switch
                        value={row.optional}
                        onValueChange={(value) => updateIngredientRow(row.key, { optional: value })}
                        trackColor={{ true: palette.tint, false: `${palette.outline}55` }}
                        thumbColor={Platform.OS === 'android' ? (row.optional ? palette.onPrimary : palette.surface) : undefined}
                      />
                      <Text style={[styles.flagLabel, { color: palette.onSurface }]}>Optional</Text>
                    </View>
                    <View style={styles.flagItem}>
                      <Switch
                        value={row.allowSubstitutes}
                        onValueChange={(value) => updateIngredientRow(row.key, { allowSubstitutes: value })}
                        trackColor={{ true: palette.tint, false: `${palette.outline}55` }}
                        thumbColor={Platform.OS === 'android' ? (row.allowSubstitutes ? palette.onPrimary : palette.surface) : undefined}
                      />
                      <Text style={[styles.flagLabel, { color: palette.onSurface }]}>Allow substitutes</Text>
                    </View>
                  </View>

                  <View style={styles.substituteBlock}>
                    <View style={styles.substituteHeader}>
                      <Text style={[styles.substituteTitle, { color: palette.onSurface }]}>Substitutes</Text>
                      <Pressable
                        onPress={() => handleOpenSubstituteModal(row.key)}
                        disabled={!row.allowSubstitutes}
                        style={[styles.substituteAdd, !row.allowSubstitutes && styles.disabledButton]}
                        accessibilityRole="button"
                        accessibilityLabel="Add substitute">
                        <Text
                          style={[
                            styles.substituteAddLabel,
                            { color: row.allowSubstitutes ? palette.tint : palette.onSurfaceVariant },
                          ]}>
                          + Add substitute
                        </Text>
                      </Pressable>
                    </View>
                    {row.substitutes.length ? (
                      <View style={styles.substituteList}>
                        {row.substitutes.map((substitute, substituteIndex) => (
                          <View
                            key={`${row.key}-substitute-${substituteIndex}`}
                            style={[
                              styles.substitutePill,
                              { borderColor: palette.outline },
                              substitute.isBranded && { borderLeftColor: palette.tint, borderLeftWidth: 4 },
                            ]}>
                            <Text style={[styles.substituteText, { color: palette.onSurface }]}>
                              {substitute.name}
                            </Text>
                            <Pressable
                              onPress={() => handleRemoveSubstitute(row.key, substituteIndex)}
                              accessibilityLabel={`Remove substitute ${substitute.name}`}>
                              <MaterialIcons name="close" size={16} color={palette.onSurfaceVariant} />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={[styles.placeholder, { color: palette.onSurfaceVariant }]}>No substitutes yet</Text>
                    )}
                  </View>

                  <Pressable
                    onPress={() => handleCreateIngredientFromRow(row.key)}
                    style={[styles.createIngredientButton, { borderColor: palette.outline }]}
                    accessibilityRole="button"
                    accessibilityLabel="Create new ingredient">
                    <Text style={[styles.createIngredientLabel, { color: palette.onSurface }]}>+ New ingredient</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>

          <Pressable
            style={[
              styles.saveButton,
              { backgroundColor: palette.tint, opacity: isSaving ? 0.75 : 1 },
            ]}
            onPress={handleSave}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Save cocktail">
            <Text style={[styles.saveButtonLabel, { color: palette.onPrimary }]}>Save cocktail</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={isGlassModalVisible}
        animationType="slide"
        onRequestClose={() => setIsGlassModalVisible(false)}
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}>
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: palette.background }]}> 
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: palette.onSurface }]}>Select glass</Text>
            <Pressable onPress={() => setIsGlassModalVisible(false)} style={styles.modalAction}>
              <Text style={[styles.modalActionLabel, { color: palette.tint }]}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            data={GLASSWARE}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setGlassId(item.id);
                  setIsGlassModalVisible(false);
                }}
                style={[styles.glassItem, { borderBottomColor: palette.outline, borderBottomWidth: StyleSheet.hairlineWidth }]}
                accessibilityRole="button"
                accessibilityLabel={`Select ${item.name}`}>
                <Image source={item.image} style={styles.glassThumb} contentFit="cover" />
                <Text style={[styles.modalTitle, { color: palette.onSurface }]}>{item.name}</Text>
                {glassId === item.id ? (
                  <MaterialIcons name="check" size={20} color={palette.tint} />
                ) : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={isTagModalVisible}
        animationType="slide"
        onRequestClose={() => setIsTagModalVisible(false)}
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}>
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: palette.background }]}> 
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: palette.onSurface }]}>Manage tags</Text>
            <Pressable onPress={() => setIsTagModalVisible(false)} style={styles.modalAction}>
              <Text style={[styles.modalActionLabel, { color: palette.tint }]}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {tagSelection.map((tag) => (
              <Pressable
                key={tag.id}
                onPress={() => toggleTag(tag.id)}
                style={[styles.tagOption, { borderBottomColor: palette.outline, borderBottomWidth: StyleSheet.hairlineWidth }]}
                accessibilityRole="button"
                accessibilityLabel={`Toggle tag ${tag.name}`}>
                <Text style={[styles.tagOptionLabel, { color: palette.onSurface }]}>{tag.name}</Text>
                {tag.selected ? (
                  <MaterialIcons name="check" size={20} color={palette.tint} />
                ) : (
                  <MaterialIcons name="add" size={20} color={palette.onSurfaceVariant} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={unitPicker.visible}
        animationType="slide"
        onRequestClose={handleCloseUnitPicker}
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}>
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: palette.background }]}> 
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: palette.onSurface }]}>Select unit</Text>
            <Pressable onPress={handleCloseUnitPicker} style={styles.modalAction}>
              <Text style={[styles.modalActionLabel, { color: palette.tint }]}>Close</Text>
            </Pressable>
          </View>
          <ScrollView>
            <Pressable onPress={() => handleSelectUnit(undefined)} style={styles.unitOption}>
              <Text style={[styles.unitOptionLabel, { color: palette.onSurface }]}>No unit</Text>
            </Pressable>
            {UNIT_OPTIONS.map((unit) => (
              <Pressable
                key={unit.id}
                onPress={() => handleSelectUnit(unit.id)}
                style={styles.unitOption}
                accessibilityRole="button"
                accessibilityLabel={`Select unit ${unit.label}`}>
                <Text style={[styles.unitOptionLabel, { color: palette.onSurface }]}>{unit.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={substituteModal.visible}
        animationType="slide"
        onRequestClose={handleCloseSubstituteModal}
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}>
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: palette.background }]}> 
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: palette.onSurface }]}>Add substitute</Text>
            <Pressable onPress={handleCloseSubstituteModal} style={styles.modalAction}>
              <Text style={[styles.modalActionLabel, { color: palette.tint }]}>Done</Text>
            </Pressable>
          </View>
          <TextInput
            value={substituteModal.search}
            onChangeText={handleSubstituteSearchChange}
            placeholder="Search ingredients"
            placeholderTextColor={palette.onSurfaceVariant}
            style={[styles.substituteSearch, { borderColor: palette.outline, color: palette.onSurface }]}
          />
          <ScrollView>
            {substituteOptions.length ? (
              substituteOptions.map((option) => (
                <Pressable
                  key={String(option.id ?? option.name)}
                  onPress={() => handleSelectSubstitute(option)}
                  style={styles.substituteOption}
                  accessibilityRole="button"
                  accessibilityLabel={`Add substitute ${option.name}`}>
                  <Text style={[styles.substituteOptionText, { color: palette.onSurface }]}>{option.name}</Text>
                  {isBrandedIngredient(option) ? (
                    <MaterialIcons name="local-offer" size={18} color={palette.tint} />
                  ) : null}
                </Pressable>
              ))
            ) : (
              <Text style={[styles.placeholder, { color: palette.onSurfaceVariant, paddingHorizontal: 20, paddingVertical: 16 }]}>
                No matches
              </Text>
            )}
          </ScrollView>
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
  content: {
    padding: 24,
    paddingBottom: 120,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '500',
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
    minHeight: 120,
    padding: 16,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  mediaRow: {
    flexDirection: 'row',
    gap: 16,
  },
  glassSelector: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  glassImage: {
    width: 96,
    height: 96,
    borderRadius: 12,
    overflow: 'hidden',
  },
  glassPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  glassLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  photoTile: {
    width: 140,
    height: 140,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholder: {
    fontSize: 14,
    textAlign: 'center',
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  manageButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  manageButtonLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  ingredientList: {
    gap: 16,
  },
  ingredientCard: {
    borderRadius: 16,
    padding: 16,
    gap: 16,
    shadowColor: appPalette.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  ingredientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ingredientTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  ingredientHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputCompact: {
    paddingVertical: 12,
  },
  suggestionList: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: -8,
    marginBottom: 4,
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestionLabel: {
    fontSize: 14,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 16,
  },
  amountContainer: {
    flex: 1,
    gap: 6,
  },
  unitContainer: {
    width: 140,
    gap: 6,
  },
  inlineLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  unitButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  unitLabel: {
    fontSize: 14,
  },
  flagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  flagItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flagLabel: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
  substituteBlock: {
    gap: 12,
  },
  substituteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  substituteTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  substituteAdd: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  disabledButton: {
    opacity: 0.4,
  },
  substituteAddLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  substituteList: {
    gap: 8,
  },
  substitutePill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  substituteText: {
    fontSize: 13,
    flex: 1,
  },
  createIngredientButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  createIngredientLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalAction: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modalActionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  glassItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  glassThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tagOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  tagOptionLabel: {
    fontSize: 15,
  },
  unitOption: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  unitOptionLabel: {
    fontSize: 15,
  },
  substituteOption: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  substituteOptionText: {
    fontSize: 15,
    flex: 1,
  },
  modalContent: {
    paddingBottom: 24,
  },
  substituteSearch: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
});
