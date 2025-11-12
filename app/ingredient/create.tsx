import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveAssetFromCatalog } from '@/assets/image-manifest';
import { Thumb } from '@/components/RowParts';
import { TagPill } from '@/components/TagPill';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import { Colors } from '@/constants/theme';
import { useKeyboardHeight } from '@/libs/useKeyboardHeight';
import { useInventory, type Ingredient } from '@/providers/inventory-provider';

type SectionKey = 'name' | 'description' | 'tags';

const SECTION_PADDING = 24;

export default function CreateIngredientScreen() {
  const paletteColors = Colors;
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { ingredients, shoppingIngredientIds, createIngredient } = useInventory();
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
  const [permissionStatus, requestPermission] = ImagePicker.useMediaLibraryPermissions();

  const scrollRef = useRef<ScrollView | null>(null);
  const baseSearchInputRef = useRef<TextInput | null>(null);
  const sectionPositions = useRef<Record<SectionKey, number>>({
    name: 0,
    description: 0,
    tags: 0,
  });

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

  const handleSubmit = useCallback(async () => {
    if (isSaving) {
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name is required', 'Please enter the ingredient name.');
      return;
    }

    const descriptionValue = description.trim();
    const selectedTagsForSubmit = selectedTagIds
      .map((tagId) => BUILTIN_INGREDIENT_TAGS.find((tag) => tag.id === tagId))
      .filter((tag): tag is (typeof BUILTIN_INGREDIENT_TAGS)[number] => Boolean(tag));

    try {
      setIsSaving(true);
      const created = createIngredient({
        name: trimmedName,
        description: descriptionValue || undefined,
        photoUri: imageUri ?? undefined,
        baseIngredientId,
        tags: selectedTagsForSubmit,
      });

      if (!created) {
        Alert.alert('Could not save ingredient', 'Please try again later.');
        return;
      }

      const targetId = created.id ?? created.name;
      if (!targetId) {
        router.back();
        return;
      }

      router.replace({
        pathname: '/ingredient/[ingredientId]',
        params: { ingredientId: String(targetId) },
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    baseIngredientId,
    createIngredient,
    description,
    imageUri,
    isSaving,
    name,
    selectedTagIds,
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
    (ingredient: Ingredient | null) => {
      if (!ingredient) {
        setBaseIngredientId(null);
        setBaseSearch('');
        setIsBaseModalVisible(false);
        return;
      }

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

  const contentBottomInset = keyboardHeight + insets.bottom + SECTION_PADDING;

  return (
    <>
      <Stack.Screen options={{ title: 'New ingredient' }} />
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
                  !imageUri && { backgroundColor: paletteColors.surfaceVariant },
                ]}
                onPress={handlePickImage}
                android_ripple={{ color: `${paletteColors.surface}33` }}
              >
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.image} contentFit="cover" />
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
              onPress={handleSubmit}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={paletteColors.surface} />
              ) : (
                <Text style={[styles.submitLabel, { color: paletteColors.surface }]}>Save Ingredient</Text>
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
              <Pressable onPress={handleClearBaseIngredient} hitSlop={8}>
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
});
