import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
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
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
  type LayoutChangeEvent,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resolveAssetFromCatalog } from '@/assets/image-manifest';
import { ListRow, Thumb } from '@/components/RowParts';
import { Colors } from '@/constants/theme';
import { useInventory, type Ingredient } from '@/providers/inventory-provider';

type PickerModule = typeof import('expo-image-picker');

type BaseFieldPosition = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export default function CreateIngredientScreen() {
  const palette = Colors;
  const headerHeight = useHeaderHeight();
  const { ingredients } = useInventory();

  const scrollRef = useRef<ScrollView>(null);
  const baseFieldRef = useRef<View>(null);
  const baseInputRef = useRef<TextInput>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [baseQuery, setBaseQuery] = useState('');
  const [selectedBaseId, setSelectedBaseId] = useState<number | null>(null);
  const [isBaseModalVisible, setBaseModalVisible] = useState(false);
  const [baseFieldOffsetY, setBaseFieldOffsetY] = useState<number | null>(null);
  const [baseFieldPosition, setBaseFieldPosition] = useState<BaseFieldPosition | null>(null);

  const selectedBaseIngredient = useMemo(() => {
    if (selectedBaseId == null) {
      return undefined;
    }

    return ingredients.find((ingredient) => {
      const id = Number(ingredient.id ?? -1);
      return Number.isFinite(id) && id === selectedBaseId;
    });
  }, [ingredients, selectedBaseId]);

  const filteredBaseOptions = useMemo(() => {
    const normalized = baseQuery.trim().toLowerCase();
    if (!normalized) {
      return ingredients;
    }

    return ingredients.filter((ingredient) => {
      const nameMatch = ingredient.searchNameNormalized.startsWith(normalized);
      if (nameMatch) {
        return true;
      }

      return ingredient.searchTokensNormalized.some((token) => token.startsWith(normalized));
    });
  }, [baseQuery, ingredients]);

  const selectedBasePhotoSource = useMemo(() => {
    const candidate = selectedBaseIngredient?.photoUri;
    if (!candidate) {
      return undefined;
    }

    const asset = resolveAssetFromCatalog(candidate);
    if (asset) {
      return asset;
    }

    if (/^https?:/i.test(candidate)) {
      return { uri: candidate } as const;
    }

    return undefined;
  }, [selectedBaseIngredient?.photoUri]);

  const refreshBaseFieldPosition = useCallback(() => {
    if (!baseFieldRef.current) {
      setBaseFieldPosition(null);
      return;
    }

    baseFieldRef.current.measureInWindow((x, y, width, height) => {
      setBaseFieldPosition({ x, y, width, height });
    });
  }, []);

  useEffect(() => {
    if (isBaseModalVisible) {
      const frame = requestAnimationFrame(refreshBaseFieldPosition);
      return () => cancelAnimationFrame(frame);
    }
    return undefined;
  }, [isBaseModalVisible, refreshBaseFieldPosition]);

  const scrollBaseFieldIntoView = useCallback(() => {
    if (baseFieldOffsetY == null) {
      return;
    }

    const targetOffset = Math.max(0, baseFieldOffsetY - headerHeight - 16);
    scrollRef.current?.scrollTo({ y: targetOffset, animated: true });
  }, [baseFieldOffsetY, headerHeight]);

  const matchesSelectedBase = useCallback(
    (value: string) => {
      const reference = selectedBaseIngredient?.name;
      if (!reference) {
        return false;
      }

      return reference.trim().toLowerCase() === value.trim().toLowerCase();
    },
    [selectedBaseIngredient?.name],
  );

  const ensureBaseSelection = useCallback(
    (value: string) => {
      const normalized = value.trim().toLowerCase();
      if (!normalized) {
        setSelectedBaseId(null);
        return;
      }

      const match = ingredients.find((ingredient) => {
        const name = ingredient.name?.trim().toLowerCase();
        if (!name) {
          return false;
        }

        return name === normalized;
      });

      if (!match) {
        setSelectedBaseId(null);
        return;
      }

      const numericId = Number(match.id ?? -1);
      if (!Number.isFinite(numericId) || numericId < 0) {
        setSelectedBaseId(null);
        return;
      }

      setSelectedBaseId(numericId);
    },
    [ingredients],
  );

  const handleBaseFieldLayout = useCallback(
    (event: LayoutChangeEvent) => {
      setBaseFieldOffsetY(event.nativeEvent.layout.y);
      refreshBaseFieldPosition();
    },
    [refreshBaseFieldPosition],
  );

  const handleBasePress = useCallback(() => {
    baseInputRef.current?.focus();
    scrollBaseFieldIntoView();
  }, [scrollBaseFieldIntoView]);

  const handleBaseFocus = useCallback(
    (_event: NativeSyntheticEvent<TextInputFocusEventData>) => {
      scrollBaseFieldIntoView();
    },
    [scrollBaseFieldIntoView],
  );

  const handleBaseQueryChange = useCallback(
    (text: string) => {
      setBaseQuery(text);

      if (text.trim().length === 0) {
        setBaseModalVisible(false);
        setSelectedBaseId(null);
        return;
      }

      if (!matchesSelectedBase(text)) {
        setSelectedBaseId(null);
      }

      if (!isBaseModalVisible) {
        setBaseModalVisible(true);
      }
    },
    [isBaseModalVisible, matchesSelectedBase],
  );

  const handleBaseOptionPress = useCallback((ingredient: Ingredient) => {
    const numericId = Number(ingredient.id ?? -1);
    if (Number.isFinite(numericId) && numericId >= 0) {
      setSelectedBaseId(numericId);
    } else {
      setSelectedBaseId(null);
    }

    setBaseQuery(ingredient.name ?? '');
    setBaseModalVisible(false);
    baseInputRef.current?.focus();
  }, []);

  const handleDismissBaseModal = useCallback(() => {
    setBaseModalVisible(false);
    ensureBaseSelection(baseQuery);
    baseInputRef.current?.focus();
  }, [baseQuery, ensureBaseSelection]);

  const handleClearBase = useCallback(() => {
    setSelectedBaseId(null);
    setBaseQuery('');
    setBaseModalVisible(false);
    baseInputRef.current?.focus();
  }, []);

  const handleSelectPhoto = useCallback(async () => {
    let pickerModule: PickerModule | undefined;
    try {
      // eslint-disable-next-line import/no-unresolved
      pickerModule = await import('expo-image-picker');
    } catch (error) {
      console.warn('Failed to load image picker', error);
      Alert.alert('Image picker unavailable', 'Unable to load the image picker module.');
      return;
    }

    try {
      const permission = await pickerModule.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission needed',
          'Media library access is required to choose a photo for the ingredient.',
        );
        return;
      }

      const result = await pickerModule.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (asset?.uri) {
        setPhotoUri(asset.uri);
      }
    } catch (error) {
      console.warn('Failed to pick image', error);
      Alert.alert('Unable to select image', 'Something went wrong while selecting the image.');
    }
  }, []);

  const renderBaseOption = useCallback(
    ({ item }: { item: Ingredient }) => {
      const numericId = Number(item.id ?? -1);
      const selected = Number.isFinite(numericId) && numericId === selectedBaseId;

      return (
        <ListRow
          title={item.name ?? ''}
          subtitle={item.category ?? undefined}
          onPress={() => handleBaseOptionPress(item)}
          selected={selected}
          highlightColor={`${palette.tint}1F`}
          thumbnail={<Thumb label={item.name ?? undefined} uri={item.photoUri ?? undefined} />}
          metaAlignment="flex-start"
        />
      );
    },
    [handleBaseOptionPress, palette.tint, selectedBaseId],
  );

  const keyExtractor = useCallback((item: Ingredient, index: number) => {
    const id = item.id;
    if (id != null) {
      return String(id);
    }

    if (item.name) {
      return `name-${item.name}`;
    }

    return `ingredient-${index}`;
  }, []);

  const ingredientPhotoSource = useMemo(() => {
    if (!photoUri) {
      return undefined;
    }

    if (/^https?:/i.test(photoUri)) {
      return { uri: photoUri } as const;
    }

    return { uri: photoUri } as const;
  }, [photoUri]);

  return (
    <>
      <Stack.Screen options={{ title: 'Create ingredient' }} />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]} edges={['bottom']}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            style={[styles.photoPlaceholder, { borderColor: palette.outline }]} 
            accessibilityRole="button"
            accessibilityLabel={photoUri ? 'Change ingredient photo' : 'Add ingredient photo'}
            onPress={handleSelectPhoto}
          >
            {ingredientPhotoSource ? (
              <Image source={ingredientPhotoSource} style={styles.photo} contentFit="cover" />
            ) : (
              <View style={styles.photoContent}>
                <MaterialCommunityIcons name="image-plus" size={32} color={palette.onSurfaceVariant} />
                <Text style={[styles.photoText, { color: palette.onSurfaceVariant }]}>Add photo</Text>
              </View>
            )}
          </Pressable>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: palette.onSurfaceVariant }]}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ingredient name"
              placeholderTextColor={`${palette.onSurfaceVariant}80`}
              style={[styles.input, { color: palette.onSurface, borderColor: palette.outline }]}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: palette.onSurfaceVariant }]}>Base ingredient</Text>
            <Pressable
              ref={baseFieldRef}
              onLayout={handleBaseFieldLayout}
              style={[styles.baseField, { borderColor: palette.outline, backgroundColor: palette.surface }]}
              onPress={handleBasePress}
            >
              <View style={[styles.baseThumbnail, { backgroundColor: palette.surfaceVariant }]}>
                {selectedBasePhotoSource ? (
                  <Image source={selectedBasePhotoSource} style={styles.baseImage} contentFit="contain" />
                ) : (
                  <MaterialCommunityIcons name="image-off" size={20} color={palette.onSurfaceVariant} />
                )}
              </View>
              <TextInput
                ref={baseInputRef}
                value={baseQuery}
                onChangeText={handleBaseQueryChange}
                onFocus={handleBaseFocus}
                placeholder="Select base ingredient"
                placeholderTextColor={`${palette.onSurfaceVariant}80`}
                style={[styles.baseInput, { color: palette.onSurface }]}
                autoCapitalize="words"
              />
              {selectedBaseIngredient ? (
                <Pressable
                  style={styles.unlinkButton}
                  onPress={handleClearBase}
                  accessibilityRole="button"
                  accessibilityLabel="Remove base ingredient"
                  hitSlop={8}
                >
                  <MaterialCommunityIcons name="link-variant-off" size={20} color={palette.error} />
                </Pressable>
              ) : null}
            </Pressable>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: palette.onSurfaceVariant }]}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the ingredient"
              placeholderTextColor={`${palette.onSurfaceVariant}80`}
              style={[styles.textArea, { color: palette.onSurface, borderColor: palette.outline }]}
              multiline
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={isBaseModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleDismissBaseModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleDismissBaseModal} />
          {baseFieldPosition ? (
            <View
              style={[
                styles.modalCard,
                {
                  top: baseFieldPosition.y + baseFieldPosition.height + 8,
                  left: baseFieldPosition.x,
                  width: baseFieldPosition.width,
                  backgroundColor: palette.surface,
                },
              ]}
            >
              <FlatList
                data={filteredBaseOptions}
                keyExtractor={keyExtractor}
                renderItem={renderBaseOption}
                style={styles.modalList}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={styles.modalEmptyState}>
                    <Text style={[styles.modalEmptyText, { color: palette.onSurfaceVariant }]}>No matches</Text>
                  </View>
                }
              />
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
    gap: 24,
  },
  photoPlaceholder: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoContent: {
    alignItems: 'center',
    gap: 8,
  },
  photoText: {
    fontSize: 16,
    fontWeight: '600',
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  baseField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  baseThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  baseImage: {
    width: '100%',
    height: '100%',
  },
  baseInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  unlinkButton: {
    padding: 4,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 140,
    fontSize: 16,
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  modalCard: {
    position: 'absolute',
    maxHeight: '50%',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  modalList: {
    maxHeight: 360,
  },
  modalEmptyState: {
    padding: 16,
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 14,
  },
});
