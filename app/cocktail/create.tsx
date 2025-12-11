import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
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
  View,
} from 'react-native';

import { resolveAssetFromCatalog } from '@/assets/image-manifest';
import { TagPill } from '@/components/TagPill';
import { BUILTIN_COCKTAIL_TAGS } from '@/constants/cocktail-tags';
import { GLASSWARE, type GlasswareOption } from '@/constants/glassware';
import { Colors } from '@/constants/theme';
import { useInventory, type Cocktail, type Ingredient } from '@/providers/inventory-provider';
import { palette } from '@/theme/theme';

type IngredientFormRow = {
  key: string;
  name: string;
  ingredientId?: number;
  amount: string;
  unitId: number;
  garnish: boolean;
  optional: boolean;
  allowBaseSubstitute: boolean;
  allowBrandSubstitute: boolean;
  substitutes: { id: number; name: string; isBrand?: boolean }[];
};

type UnitOption = { id: number; label: string };

const UNIT_OPTIONS: UnitOption[] = [
  { id: 11, label: 'ml' },
  { id: 12, label: 'oz' },
  { id: 6, label: 'dash' },
  { id: 7, label: 'drop' },
  { id: 4, label: 'tsp' },
  { id: 22, label: 'tbsp' },
  { id: 2, label: 'bar spoon' },
  { id: 1, label: 'piece' },
];

const DEFAULT_UNIT_ID = 11;

const MAX_SUGGESTIONS = 6;

export default function CreateCocktailScreen() {
  const paletteColors = Colors;
  const scrollRef = useRef<ScrollView | null>(null);
  const { origin, ingredientId: originIngredientId } = useLocalSearchParams<{
    origin?: string;
    ingredientId?: string;
  }>();

  const { ingredients, createCocktail } = useInventory();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [glass, setGlass] = useState<GlasswareOption | null>(null);
  const [isGlassPickerVisible, setIsGlassPickerVisible] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [permissionStatus, requestPermission] = ImagePicker.useMediaLibraryPermissions();
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [ingredientRows, setIngredientRows] = useState<IngredientFormRow[]>(() => {
    const initialIngredientId = originIngredientId ? Number(originIngredientId) : undefined;
    if (initialIngredientId && Number.isFinite(initialIngredientId)) {
      const initialIngredient = ingredients.find(
        (item) => Number(item.id ?? -1) === initialIngredientId,
      );

      if (initialIngredient) {
        return [
          {
            key: `ingredient-${initialIngredientId}`,
            name: initialIngredient.name,
            ingredientId: Number(initialIngredient.id),
            amount: '',
            unitId: DEFAULT_UNIT_ID,
            garnish: false,
            optional: false,
            allowBaseSubstitute: false,
            allowBrandSubstitute: false,
            substitutes: [],
          },
        ];
      }
    }

    return [createEmptyIngredientRow()];
  });
  const [activeSubstituteRowKey, setActiveSubstituteRowKey] = useState<string | null>(null);
  const [substituteSearch, setSubstituteSearch] = useState('');

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

  const tagSelection = useMemo(() => {
    const set = new Set(selectedTagIds);
    return BUILTIN_COCKTAIL_TAGS.map((tag) => ({
      ...tag,
      selected: set.has(tag.id),
    }));
  }, [selectedTagIds]);

  const toggleTag = useCallback((tagId: number) => {
    setSelectedTagIds((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId);
      }

      return [...prev, tagId];
    });
  }, []);

  const handleGlassSelect = useCallback((option: GlasswareOption) => {
    setGlass(option);
    setIsGlassPickerVisible(false);
  }, []);

  const ingredientSuggestions = useCallback(
    (query: string) => {
      const normalized = query.trim().toLowerCase();
      if (normalized.length < 2) {
        return [] as Ingredient[];
      }

      return ingredients
        .filter((ingredient) => ingredient.searchNameNormalized.includes(normalized))
        .slice(0, MAX_SUGGESTIONS);
    },
    [ingredients],
  );

  const updateIngredientRow = useCallback(
    (key: string, patch: Partial<IngredientFormRow>) => {
      setIngredientRows((prev) =>
        prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
      );
    },
    [],
  );

  const removeIngredientRow = useCallback((key: string) => {
    setIngredientRows((prev) => (prev.length > 1 ? prev.filter((row) => row.key !== key) : prev));
  }, []);

  const addIngredientRow = useCallback(() => {
    setIngredientRows((prev) => [...prev, createEmptyIngredientRow()]);
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
  }, []);

  const moveIngredientRow = useCallback((key: string, direction: -1 | 1) => {
    setIngredientRows((prev) => {
      const index = prev.findIndex((row) => row.key === key);
      if (index === -1) {
        return prev;
      }

      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) {
        return prev;
      }

      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }, []);

  const handleAddSubstitute = useCallback((rowKey: string) => {
    setActiveSubstituteRowKey(rowKey);
    setSubstituteSearch('');
  }, []);

  const closeSubstituteModal = useCallback(() => {
    setActiveSubstituteRowKey(null);
    setSubstituteSearch('');
  }, []);

  const activeSubstituteRow = useMemo(
    () => ingredientRows.find((row) => row.key === activeSubstituteRowKey),
    [activeSubstituteRowKey, ingredientRows],
  );

  const filteredSubstituteOptions = useMemo(() => {
    if (!activeSubstituteRow) {
      return [] as Ingredient[];
    }

    return ingredientSuggestions(substituteSearch);
  }, [activeSubstituteRow, ingredientSuggestions, substituteSearch]);

  const glassId = glass?.id;

  const handleSelectSubstitute = useCallback(
    (option: Ingredient) => {
      if (!activeSubstituteRow) {
        return;
      }

      const newSubstitute = {
        id: Number(option.id ?? -1),
        name: option.name,
        isBrand: option.baseIngredientId != null,
      } satisfies IngredientFormRow['substitutes'][number];

      updateIngredientRow(activeSubstituteRow.key, {
        substitutes: ensureUniqueSubstitutes([...activeSubstituteRow.substitutes, newSubstitute]),
      });
      closeSubstituteModal();
    },
    [activeSubstituteRow, closeSubstituteModal, updateIngredientRow],
  );

  const handleRemoveSubstitute = useCallback(
    (rowKey: string, substituteId: number) => {
      updateIngredientRow(rowKey, {
        substitutes: ingredientRows
          .find((row) => row.key === rowKey)
          ?.substitutes.filter((substitute) => substitute.id !== substituteId) ?? [],
      });
    },
    [ingredientRows, updateIngredientRow],
  );

  const handleSave = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name is required', 'Please enter the cocktail name.');
      return;
    }

    const sanitizedIngredients = ingredientRows
      .map((row, index) => {
        const trimmedIngredientName = row.name.trim();
        if (!trimmedIngredientName) {
          return undefined;
        }

        const normalizedId = row.ingredientId != null ? Number(row.ingredientId) : undefined;
        const ingredientId =
          normalizedId != null && Number.isFinite(normalizedId) ? Math.trunc(normalizedId) : undefined;

        return {
          order: index + 1,
          ingredientId,
          name: trimmedIngredientName,
          amount: row.amount.trim() || undefined,
          unitId: row.unitId,
          garnish: row.garnish || undefined,
          optional: row.optional || undefined,
          allowBaseSubstitute: row.allowBaseSubstitute || undefined,
          allowBrandSubstitute: row.allowBrandSubstitute || undefined,
          substitutes: row.substitutes.length > 0 ? row.substitutes : undefined,
        } satisfies NonNullable<Cocktail['ingredients']>[number];
      })
      .filter(Boolean) as NonNullable<Cocktail['ingredients']>;

    if (sanitizedIngredients.length === 0) {
      Alert.alert('Add at least one ingredient', 'Please include an ingredient to save the cocktail.');
      return;
    }

    const selectedTags = selectedTagIds
      .map((tagId) => BUILTIN_COCKTAIL_TAGS.find((tag) => tag.id === tagId))
      .filter((tag): tag is (typeof BUILTIN_COCKTAIL_TAGS)[number] => Boolean(tag));

    const created = createCocktail({
      name: trimmedName,
      description: description.trim() || undefined,
      instructions: instructions.trim() || undefined,
      glassId,
      photoUri: imageUri ?? undefined,
      tags: selectedTags,
      ingredients: sanitizedIngredients,
    });

    if (!created) {
      Alert.alert('Could not save cocktail', 'Please try again later.');
      return;
    }

    const targetId = created.id ?? created.name;
    if (!targetId) {
      router.back();
      return;
    }

    router.replace({
      pathname: '/cocktail/[cocktailId]',
      params: { cocktailId: String(targetId) },
    });
  }, [
    createCocktail,
    description,
    glassId,
    imageUri,
    ingredientRows,
    instructions,
    name,
    selectedTagIds,
  ]);

  const handleBack = useCallback(() => {
    if (origin === 'ingredient' && originIngredientId) {
      router.replace({
        pathname: '/ingredient/[ingredientId]',
        params: { ingredientId: String(originIngredientId) },
      });
      return;
    }

    router.replace('/(tabs)/cocktails');
  }, [origin, originIngredientId]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Add Cocktail',
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={handleBack}
              hitSlop={12}
              style={({ pressed }) => [styles.headerBack, pressed ? styles.headerBackPressed : null]}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={paletteColors.text} />
              <Text style={[styles.headerBackLabel, { color: paletteColors.text }]}>Back</Text>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.flex, { backgroundColor: paletteColors.background }]}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={[styles.label, { color: paletteColors.onSurfaceVariant }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Margarita"
            style={[styles.input, { borderColor: paletteColors.outline, color: paletteColors.text }]}
            placeholderTextColor={paletteColors.outline}
            autoCapitalize="words"
          />

          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={[styles.label, { color: paletteColors.onSurfaceVariant }]}>Glass</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Select glassware"
                onPress={() => setIsGlassPickerVisible(true)}
                style={[styles.tile, { borderColor: paletteColors.outline }]}
                android_ripple={{ color: `${paletteColors.outline}33` }}>
                {glass ? (
                  <View style={styles.tileContent}>
                    <Image source={glass.image} style={styles.glassImage} contentFit="contain" />
                    <Text style={[styles.tileLabel, { color: paletteColors.text }]}>{glass.name}</Text>
                  </View>
                ) : (
                  <Text style={[styles.tilePlaceholder, { color: paletteColors.outline }]}>Select glass</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.flex}>
              <Text style={[styles.label, { color: paletteColors.onSurfaceVariant }]}>Photo</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pick photo"
                onPress={handlePickImage}
                style={[styles.tile, { borderColor: paletteColors.outline }]}
                android_ripple={{ color: `${paletteColors.outline}33` }}>
                {imageUri ? (
                  <Image
                    source={resolveAssetFromCatalog(imageUri) ?? { uri: imageUri }}
                    style={styles.photo}
                    contentFit="cover"
                  />
                ) : (
                  <Text style={[styles.tilePlaceholder, { color: paletteColors.outline }]}>Tap to select image</Text>
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: paletteColors.onSurfaceVariant }]}>Tags</Text>
            <View style={styles.tagList}>
              {tagSelection
                .filter((tag) => tag.selected)
                .map((tag) => (
                  <TagPill
                    key={tag.id}
                    label={tag.name}
                    color={tag.color}
                    selected
                    onPress={() => toggleTag(tag.id)}
                  />
                ))}
              {tagSelection.filter((tag) => tag.selected).length === 0 ? (
                <Text style={{ color: paletteColors.onSurfaceVariant }}>No tags selected</Text>
              ) : null}
            </View>

            <Text style={[styles.subLabel, { color: paletteColors.onSurfaceVariant }]}>Add Tag</Text>
            <View style={styles.tagList}>
              {tagSelection.map((tag) => (
                <TagPill
                  key={tag.id}
                  label={tag.name}
                  color={tag.color}
                  selected={tag.selected}
                  onPress={() => toggleTag(tag.id)}
                  style={styles.tagSpacing}
                />
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => Alert.alert('Manage tags', 'Custom tag management coming soon.')}
              hitSlop={8}>
              <Text style={[styles.link, { color: paletteColors.tint }]}>Manage tags</Text>
            </Pressable>
          </View>

          <Text style={[styles.label, { color: paletteColors.onSurfaceVariant }]}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Optional description"
            style={[styles.textArea, { borderColor: paletteColors.outline, color: paletteColors.text }]}
            placeholderTextColor={paletteColors.outline}
            multiline
          />

          <Text style={[styles.label, { color: paletteColors.onSurfaceVariant }]}>Instructions</Text>
          <TextInput
            value={instructions}
            onChangeText={setInstructions}
            placeholder="1. Grab some ice..."
            style={[styles.textArea, { borderColor: paletteColors.outline, color: paletteColors.text }]}
            placeholderTextColor={paletteColors.outline}
            multiline
          />

          <View style={styles.section}>
            <Text style={[styles.label, { color: paletteColors.onSurfaceVariant }]}>Ingredients</Text>
            {ingredientRows.map((row, index) => {
              const suggestions = ingredientSuggestions(row.name);
              return (
                <View key={row.key} style={styles.ingredientCard}>
                  <View style={styles.ingredientHeader}>
                    <Text style={[styles.ingredientTitle, { color: paletteColors.text }]}>Ingredient</Text>
                    <View style={styles.ingredientActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Move ingredient up"
                        onPress={() => moveIngredientRow(row.key, -1)}
                        hitSlop={8}
                        disabled={index === 0}
                        style={({ pressed }) => [
                          styles.iconButton,
                          pressed ? styles.iconButtonPressed : null,
                          index === 0 ? styles.iconButtonDisabled : null,
                        ]}>
                        <MaterialIcons name="arrow-upward" size={18} color={paletteColors.tint} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Move ingredient down"
                        onPress={() => moveIngredientRow(row.key, 1)}
                        hitSlop={8}
                        disabled={index === ingredientRows.length - 1}
                        style={({ pressed }) => [
                          styles.iconButton,
                          pressed ? styles.iconButtonPressed : null,
                          index === ingredientRows.length - 1 ? styles.iconButtonDisabled : null,
                        ]}>
                        <MaterialIcons name="arrow-downward" size={18} color={paletteColors.tint} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Remove ingredient"
                        onPress={() => removeIngredientRow(row.key)}
                        hitSlop={8}
                        style={({ pressed }) => [
                          styles.iconButton,
                          pressed ? styles.iconButtonPressed : null,
                        ]}>
                        <MaterialIcons name="delete" size={18} color={paletteColors.error} />
                      </Pressable>
                    </View>
                  </View>

                  <TextInput
                    value={row.name}
                    onChangeText={(text) => updateIngredientRow(row.key, { name: text })}
                    placeholder="Type ingredient name"
                    style={[styles.input, { borderColor: paletteColors.outline, color: paletteColors.text }]}
                    placeholderTextColor={paletteColors.outline}
                    autoCapitalize="words"
                  />
                  {row.name.trim().length >= 2 ? (
                    <View style={styles.suggestionPanel}>
                      {suggestions.length === 0 ? (
                        <Text style={{ color: paletteColors.onSurfaceVariant }}>
                          No exact match. Tap + to create new ingredient.
                        </Text>
                      ) : (
                        suggestions.map((item) => (
                          <Pressable
                            key={item.id ?? item.name}
                            onPress={() =>
                              updateIngredientRow(row.key, {
                                name: item.name,
                                ingredientId: Number(item.id),
                              })
                            }
                            style={({ pressed }) => [
                              styles.suggestionRow,
                              pressed ? styles.suggestionRowPressed : null,
                            ]}
                            android_ripple={{ color: `${paletteColors.outline}33` }}>
                            <Image
                              source={resolveAssetFromCatalog(item.photoUri) ?? undefined}
                              style={styles.suggestionThumb}
                              contentFit="cover"
                            />
                            <View style={styles.suggestionText}>
                              <Text style={{ color: paletteColors.text }}>{item.name}</Text>
                              {item.baseIngredientId ? (
                                <Text style={{ color: paletteColors.onSurfaceVariant }}>
                                  Brand / derived
                                </Text>
                              ) : null}
                            </View>
                          </Pressable>
                        ))
                      )}
                    </View>
                  ) : null}

                  <View style={styles.row}>
                    <View style={[styles.flex, styles.fieldSpacing]}>
                      <Text style={[styles.subLabel, { color: paletteColors.onSurfaceVariant }]}>Amount</Text>
                      <TextInput
                        value={row.amount}
                        onChangeText={(text) => updateIngredientRow(row.key, { amount: text })}
                        placeholder="e.g. 45"
                        style={[styles.input, { borderColor: paletteColors.outline, color: paletteColors.text }]}
                        placeholderTextColor={paletteColors.outline}
                        keyboardType="decimal-pad"
                      />
                    </View>

                    <View style={styles.unitColumn}>
                      <Text style={[styles.subLabel, { color: paletteColors.onSurfaceVariant }]}>Unit</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Change unit"
                        onPress={() =>
                          updateIngredientRow(row.key, {
                            unitId: nextUnit(row.unitId, UNIT_OPTIONS),
                          })
                        }
                        style={[styles.unitPicker, { borderColor: paletteColors.outline }]}
                        android_ripple={{ color: `${paletteColors.outline}33` }}>
                        <Text style={{ color: paletteColors.text }}>
                          {UNIT_OPTIONS.find((unit) => unit.id === row.unitId)?.label ?? 'ml'}
                        </Text>
                        <MaterialIcons name="arrow-drop-down" size={20} color={paletteColors.text} />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.flagRow}>
                    <Checkbox
                      label="Garnish"
                      checked={row.garnish}
                      onToggle={() => updateIngredientRow(row.key, { garnish: !row.garnish })}
                    />
                    <Checkbox
                      label="Optional"
                      checked={row.optional}
                      onToggle={() => updateIngredientRow(row.key, { optional: !row.optional })}
                    />
                  </View>

                  <View style={styles.flagRow}>
                    <Checkbox
                      label="Allow base substitute"
                      checked={row.allowBaseSubstitute}
                      onToggle={() =>
                        updateIngredientRow(row.key, {
                          allowBaseSubstitute: !row.allowBaseSubstitute,
                        })
                      }
                    />
                    <Checkbox
                      label="Allow brand alt"
                      checked={row.allowBrandSubstitute}
                      onToggle={() =>
                        updateIngredientRow(row.key, {
                          allowBrandSubstitute: !row.allowBrandSubstitute,
                        })
                      }
                    />
                  </View>

                  <View style={styles.substituteHeader}>
                    <Text style={[styles.subLabel, { color: paletteColors.onSurfaceVariant }]}>Substitutes</Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => handleAddSubstitute(row.key)}
                      style={({ pressed }) => [
                        styles.addSubstituteButton,
                        pressed ? styles.addSubstituteButtonPressed : null,
                      ]}
                      android_ripple={{ color: `${paletteColors.outline}33` }}>
                      <MaterialIcons name="add" size={18} color={paletteColors.tint} />
                      <Text style={{ color: paletteColors.tint }}>Add substitute</Text>
                    </Pressable>
                  </View>
                  {row.substitutes.length > 0 ? (
                    <View style={styles.substituteList}>
                      {row.substitutes.map((substitute) => (
                        <View
                          key={`${row.key}-${substitute.id}`}
                          style={[styles.substitutePill, substitute.isBrand ? styles.brandPill : null]}>
                          <Text style={{ color: paletteColors.text, flex: 1 }} numberOfLines={1}>
                            {substitute.name}
                          </Text>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => handleRemoveSubstitute(row.key, substitute.id)}
                            hitSlop={8}>
                            <MaterialIcons name="close" size={16} color={paletteColors.onSurfaceVariant} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}

            <Pressable
              accessibilityRole="button"
              onPress={addIngredientRow}
              style={({ pressed }) => [styles.addIngredientButton, pressed ? styles.addIngredientButtonPressed : null]}>
              <MaterialIcons name="add" size={20} color={paletteColors.tint} />
              <Text style={[styles.addIngredientLabel, { color: paletteColors.tint }]}>Add ingredient</Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveButton,
              { backgroundColor: paletteColors.tint },
              pressed ? styles.saveButtonPressed : null,
            ]}>
            <Text style={[styles.saveButtonLabel, { color: paletteColors.surface }]}>Save cocktail</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={isGlassPickerVisible} transparent animationType="fade" onRequestClose={() => setIsGlassPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: paletteColors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: paletteColors.text }]}>Select glass</Text>
              <Pressable onPress={() => setIsGlassPickerVisible(false)} accessibilityRole="button" hitSlop={8}>
                <MaterialIcons name="close" size={20} color={paletteColors.onSurfaceVariant} />
              </Pressable>
            </View>
            <FlatList
              data={GLASSWARE}
              keyExtractor={(item) => item.id}
              numColumns={2}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleGlassSelect(item)}
                  style={({ pressed }) => [
                    styles.glassOption,
                    pressed ? styles.glassOptionPressed : null,
                    glass?.id === item.id ? styles.glassOptionSelected : null,
                  ]}
                  android_ripple={{ color: `${paletteColors.outline}33` }}>
                  <Image source={item.image} style={styles.glassOptionImage} contentFit="contain" />
                  <Text style={[styles.glassOptionLabel, { color: paletteColors.text }]}>{item.name}</Text>
                </Pressable>
              )}
              columnWrapperStyle={styles.glassOptionRow}
              contentContainerStyle={styles.glassGrid}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={activeSubstituteRow != null}
        animationType="slide"
        onRequestClose={closeSubstituteModal}
        transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentLarge, { backgroundColor: paletteColors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: paletteColors.text }]}>Add substitute</Text>
              <Pressable onPress={closeSubstituteModal} accessibilityRole="button" hitSlop={8}>
                <MaterialIcons name="close" size={20} color={paletteColors.onSurfaceVariant} />
              </Pressable>
            </View>
            <TextInput
              value={substituteSearch}
              onChangeText={setSubstituteSearch}
              placeholder="Search ingredient"
              style={[styles.input, { borderColor: paletteColors.outline, color: paletteColors.text }]}
              placeholderTextColor={paletteColors.onSurfaceVariant}
              autoFocus
            />
            <FlatList
              data={filteredSubstituteOptions}
              keyExtractor={(item) => String(item.id ?? item.name)}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleSelectSubstitute(item)}
                  style={({ pressed }) => [
                    styles.suggestionRow,
                    pressed ? styles.suggestionRowPressed : null,
                  ]}>
                  <Image
                    source={resolveAssetFromCatalog(item.photoUri) ?? undefined}
                    style={styles.suggestionThumb}
                    contentFit="cover"
                  />
                  <View style={styles.suggestionText}>
                    <Text style={{ color: paletteColors.text }}>{item.name}</Text>
                    {item.baseIngredientId ? (
                      <Text style={{ color: paletteColors.onSurfaceVariant }}>Brand / derived</Text>
                    ) : null}
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={{ color: paletteColors.onSurfaceVariant, marginTop: 12 }}>
                  Start typing to search ingredients
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

function createEmptyIngredientRow(): IngredientFormRow {
  return {
    key: `ingredient-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: '',
    amount: '',
    unitId: DEFAULT_UNIT_ID,
    garnish: false,
    optional: false,
    allowBaseSubstitute: false,
    allowBrandSubstitute: false,
    substitutes: [],
  };
}

function nextUnit(currentUnitId: number, options: UnitOption[]): number {
  const index = options.findIndex((unit) => unit.id === currentUnitId);
  if (index === -1 || index === options.length - 1) {
    return options[0]?.id ?? DEFAULT_UNIT_ID;
  }

  return options[index + 1]?.id ?? options[0]?.id ?? DEFAULT_UNIT_ID;
}

function ensureUniqueSubstitutes(
  substitutes: IngredientFormRow['substitutes'],
): IngredientFormRow['substitutes'] {
  const seen = new Set<number>();
  const result: IngredientFormRow['substitutes'] = [];

  substitutes.forEach((item) => {
    if (seen.has(item.id)) {
      return;
    }

    seen.add(item.id);
    result.push(item);
  });

  return result;
}

type CheckboxProps = {
  label: string;
  checked: boolean;
  onToggle: () => void;
};

function Checkbox({ label, checked, onToggle }: CheckboxProps) {
  const paletteColors = Colors;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={({ pressed }) => [styles.checkbox, pressed ? styles.checkboxPressed : null]}
      android_ripple={{ color: `${paletteColors.outline}33` }}>
      <MaterialCommunityIcons
        name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
        size={20}
        color={paletteColors.tint}
      />
      <Text style={[styles.checkboxLabel, { color: paletteColors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 48,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  subLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flexGrow: {
    flexGrow: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 90,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  tile: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 140,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  tileContent: {
    alignItems: 'center',
    gap: 8,
  },
  tileLabel: {
    fontWeight: '600',
    fontSize: 14,
  },
  tilePlaceholder: {
    textAlign: 'center',
  },
  glassImage: {
    width: 110,
    height: 110,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tagSpacing: {
    marginRight: 4,
    marginBottom: 4,
  },
  link: {
    marginTop: 8,
    fontWeight: '600',
  },
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.outlineVariant,
    paddingTop: 12,
    gap: 12,
  },
  ingredientCard: {
    borderWidth: 1,
    borderRadius: 12,
    borderColor: palette.outline,
    padding: 12,
    marginTop: 12,
    gap: 12,
    backgroundColor: palette.surface,
    shadowColor: palette.shadow,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  ingredientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ingredientTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  ingredientActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
  },
  iconButtonPressed: {
    opacity: 0.65,
  },
  iconButtonDisabled: {
    opacity: 0.35,
  },
  fieldSpacing: {
    flex: 1,
  },
  unitColumn: {
    width: 120,
  },
  unitPicker: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flagRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  checkboxPressed: {
    opacity: 0.75,
  },
  checkboxLabel: {
    fontSize: 14,
  },
  substituteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addSubstituteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.outline,
  },
  addSubstituteButtonPressed: {
    opacity: 0.7,
  },
  substituteList: {
    gap: 8,
  },
  substitutePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.outline,
  },
  brandPill: {
    borderLeftWidth: 6,
    borderLeftColor: palette.tint,
  },
  addIngredientButton: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.outline,
    flexDirection: 'row',
    gap: 6,
  },
  addIngredientButtonPressed: {
    opacity: 0.8,
  },
  addIngredientLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonPressed: {
    opacity: 0.85,
  },
  saveButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  suggestionPanel: {
    borderWidth: 1,
    borderColor: palette.outline,
    borderRadius: 10,
    padding: 8,
    gap: 8,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  suggestionRowPressed: {
    opacity: 0.75,
  },
  suggestionThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: palette.surfaceVariant,
  },
  suggestionText: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    borderRadius: 12,
    padding: 12,
    maxHeight: '80%',
  },
  modalContentLarge: {
    borderRadius: 12,
    padding: 12,
    maxHeight: '85%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  glassGrid: {
    paddingHorizontal: 4,
  },
  glassOptionRow: {
    gap: 8,
    justifyContent: 'space-between',
  },
  glassOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.outline,
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  glassOptionPressed: {
    opacity: 0.8,
  },
  glassOptionSelected: {
    borderColor: palette.tint,
  },
  glassOptionImage: {
    width: 96,
    height: 96,
  },
  glassOptionLabel: {
    textAlign: 'center',
    fontWeight: '600',
  },
  headerBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  headerBackPressed: {
    opacity: 0.7,
  },
  headerBackLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
