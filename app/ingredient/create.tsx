import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { Image } from 'expo-image';
// eslint-disable-next-line import/no-unresolved -- Expo-managed module provided at runtime
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resolveAssetFromCatalog } from '@/assets/image-manifest';
import { ListRow, Thumb } from '@/components/RowParts';
import { Colors } from '@/constants/theme';
import { useInventory, type Ingredient } from '@/providers/inventory-provider';
import { palette as themePalette } from '@/theme/theme';

export default function IngredientCreateScreen() {
  const paletteColors = Colors;
  const headerHeight = useHeaderHeight();
  const scrollViewRef = useRef<ScrollView>(null);
  const baseFieldOffset = useRef(0);
  const baseFieldHeight = useRef(0);
  const baseInputRef = useRef<TextInput>(null);

  const { ingredients } = useInventory();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [baseQuery, setBaseQuery] = useState('');
  const [selectedBase, setSelectedBase] = useState<Ingredient | undefined>();
  const [isBaseModalVisible, setBaseModalVisible] = useState(false);

  const [mediaPermission, requestMediaPermission] = ImagePicker.useMediaLibraryPermissions();

  const normalizedBaseQuery = baseQuery.trim().toLowerCase();
  const baseTokens = useMemo(
    () => normalizedBaseQuery.split(/\s+/).filter(Boolean),
    [normalizedBaseQuery],
  );

  const filteredBaseIngredients = useMemo(() => {
    if (!normalizedBaseQuery) {
      return [] as Ingredient[];
    }

    return ingredients.filter((item) => {
      const searchName = item.searchNameNormalized;
      const searchTokens = item.searchTokensNormalized ?? [];

      if (baseTokens.length === 0) {
        return false;
      }

      return baseTokens.every((token) => {
        if (!token) {
          return false;
        }

        if (searchName.startsWith(token)) {
          return true;
        }

        return searchTokens.some((candidate) => candidate.startsWith(token));
      });
    });
  }, [baseTokens, ingredients, normalizedBaseQuery]);

  const baseIngredientThumbnailSource = useMemo(() => {
    if (!selectedBase?.photoUri) {
      return undefined;
    }

    const asset = resolveAssetFromCatalog(selectedBase.photoUri);
    if (asset) {
      return asset;
    }

    if (/^https?:/i.test(selectedBase.photoUri)) {
      return { uri: selectedBase.photoUri } as const;
    }

    return undefined;
  }, [selectedBase?.photoUri]);

  const handleScrollToBaseField = useCallback(() => {
    const offset = Math.max(baseFieldOffset.current - headerHeight, 0);
    scrollViewRef.current?.scrollTo({ y: offset, animated: true });
  }, [headerHeight]);

  const handleBaseFieldLayout = useCallback((event: LayoutChangeEvent) => {
    baseFieldOffset.current = event.nativeEvent.layout.y;
    baseFieldHeight.current = event.nativeEvent.layout.height;
  }, []);

  const ensureMediaPermission = useCallback(async () => {
    if (mediaPermission?.granted) {
      return true;
    }

    const response = await requestMediaPermission();
    if (response?.granted) {
      return true;
    }

    Alert.alert('Permission required', 'Allow photo library access to pick an image.');
    return false;
  }, [mediaPermission?.granted, requestMediaPermission]);

  const handlePickImage = useCallback(async () => {
    const hasPermission = await ensureMediaPermission();
    if (!hasPermission) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0]?.uri);
    }
  }, [ensureMediaPermission]);

  const handleClearPhoto = useCallback(() => {
    setPhotoUri(undefined);
  }, []);

  const handleBaseQueryChange = useCallback(
    (value: string) => {
      setBaseQuery(value);
      setSelectedBase((previous) => {
        if (!previous) {
          return undefined;
        }

        const normalizedValue = value.trim().toLowerCase();
        const normalizedName = (previous.name ?? '').trim().toLowerCase();
        return normalizedValue === normalizedName ? previous : undefined;
      });

      if (!isBaseModalVisible && value.trim().length > 0) {
        setBaseModalVisible(true);
      }
    },
    [isBaseModalVisible],
  );

  const handleBaseFocus = useCallback(() => {
    handleScrollToBaseField();
  }, [handleScrollToBaseField]);

  const handleBaseFieldPress = useCallback(() => {
    handleScrollToBaseField();
    baseInputRef.current?.focus();
  }, [handleScrollToBaseField]);

  const handleSelectBase = useCallback(
    (ingredient: Ingredient) => {
      setSelectedBase(ingredient);
      setBaseQuery(ingredient.name ?? '');
      setBaseModalVisible(false);
    },
    [],
  );

  const handleDismissBaseModal = useCallback(() => {
    setBaseModalVisible(false);

    if (!normalizedBaseQuery) {
      return;
    }

    const match = ingredients.find(
      (candidate) => (candidate.name ?? '').trim().toLowerCase() === normalizedBaseQuery,
    );

    if (match) {
      setSelectedBase(match);
      setBaseQuery(match.name ?? '');
    }
  }, [ingredients, normalizedBaseQuery]);

  const handleClearBase = useCallback(() => {
    setSelectedBase(undefined);
    setBaseQuery('');
  }, []);

  const renderBaseItem = useCallback(
    ({ item }: { item: Ingredient }) => (
      <ListRow
        title={item.name ?? ''}
        onPress={() => handleSelectBase(item)}
        highlightColor={themePalette.highlightSubtle}
        selected={selectedBase?.id === item.id}
        accessibilityRole="button"
        thumbnail={<Thumb label={item.name ?? ''} uri={item.photoUri} />}
        metaAlignment="flex-start"
      />
    ),
    [handleSelectBase, selectedBase?.id],
  );

  const baseKeyExtractor = useCallback((item: Ingredient) => String(item.id ?? item.name), []);

  const modalTop = useMemo(() => {
    const height = baseFieldHeight.current || 0;
    const offset = headerHeight + height + 12;
    return offset;
  }, [headerHeight]);

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.safeArea, { backgroundColor: paletteColors.background }]}>
      <Stack.Screen options={{ title: 'Create ingredient' }} />
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={[styles.label, { color: paletteColors.onSurface }]}>Ingredient name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter ingredient name"
            placeholderTextColor={paletteColors.onSurfaceVariant}
            style={[styles.textInput, { borderColor: paletteColors.outline, color: paletteColors.onSurface }]}
            autoCapitalize="words"
            autoCorrect
            returnKeyType="done"
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: paletteColors.onSurface }]}>Photo</Text>
          <View style={styles.photoRow}>
            <Pressable
              onPress={handlePickImage}
              accessibilityRole="button"
              accessibilityLabel="Pick ingredient photo"
              style={[
                styles.photoPlaceholder,
                {
                  borderColor: paletteColors.outline,
                  backgroundColor: paletteColors.surface,
                },
              ]}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoImage} contentFit="cover" />
              ) : (
                <View style={styles.photoPlaceholderContent}>
                  <MaterialCommunityIcons
                    name="image-plus"
                    size={36}
                    color={paletteColors.onSurfaceVariant}
                  />
                  <Text style={[styles.photoHint, { color: paletteColors.onSurfaceVariant }]}>Add photo</Text>
                </View>
              )}
            </Pressable>
            {photoUri ? (
              <Pressable
                onPress={handleClearPhoto}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                style={styles.clearPhotoButton}>
                <MaterialCommunityIcons name="close" size={20} color={paletteColors.error} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.section} onLayout={handleBaseFieldLayout}>
          <Text style={[styles.label, { color: paletteColors.onSurface }]}>Base ingredient</Text>
          <Pressable onPress={handleBaseFieldPress} style={{ flex: 1 }} accessibilityRole="button">
            <View
              style={[
                styles.baseRow,
                {
                  borderColor: paletteColors.outline,
                  backgroundColor: paletteColors.surface,
                },
              ]}>
              <View style={styles.baseThumb}>
                {baseIngredientThumbnailSource ? (
                  <Image source={baseIngredientThumbnailSource} style={styles.baseImage} contentFit="contain" />
                ) : (
                  <View
                    style={[styles.basePlaceholder, { backgroundColor: paletteColors.surfaceVariant }]}> 
                    <MaterialCommunityIcons
                      name="image-off"
                      size={20}
                      color={paletteColors.onSurfaceVariant}
                    />
                  </View>
                )}
              </View>
              <TextInput
                ref={baseInputRef}
                value={baseQuery}
                onChangeText={handleBaseQueryChange}
                onFocus={handleBaseFocus}
                placeholder="Search base ingredient"
                placeholderTextColor={paletteColors.onSurfaceVariant}
                style={[styles.baseInput, { color: paletteColors.onSurface }]}
                autoCapitalize="words"
                autoCorrect
              />
              {selectedBase ? (
                <Pressable
                  onPress={handleClearBase}
                  accessibilityRole="button"
                  accessibilityLabel="Remove base ingredient"
                  hitSlop={8}
                  style={styles.unlinkButton}>
                  <MaterialCommunityIcons name="link-variant-off" size={20} color={paletteColors.error} />
                </Pressable>
              ) : null}
              <MaterialIcons name="expand-more" size={24} color={paletteColors.onSurfaceVariant} />
            </View>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: paletteColors.onSurface }]}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Add description"
            placeholderTextColor={paletteColors.onSurfaceVariant}
            style={[styles.textArea, { borderColor: paletteColors.outline, color: paletteColors.onSurface }]}
            multiline
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={isBaseModalVisible}
        onRequestClose={handleDismissBaseModal}>
        <Pressable
          style={[styles.modalBackdrop, { paddingTop: modalTop }]}
          onPress={handleDismissBaseModal}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={[styles.modalContent, { backgroundColor: paletteColors.surface }]}> 
              <Text style={[styles.modalTitle, { color: paletteColors.onSurface }]}>Select base ingredient</Text>
              <FlatList
                data={filteredBaseIngredients}
                keyExtractor={baseKeyExtractor}
                renderItem={renderBaseItem}
                ItemSeparatorComponent={() => (
                  <View style={[styles.modalDivider, { backgroundColor: paletteColors.outline }]} />
                )}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={[styles.emptyModalLabel, { color: paletteColors.onSurfaceVariant }]}>No matches yet</Text>
                }
              />
            </View>
          </TouchableWithoutFeedback>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 24,
  },
  section: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 120,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  photoPlaceholder: {
    width: 150,
    height: 150,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPlaceholderContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoHint: {
    fontSize: 12,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  clearPhotoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  baseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  baseThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  baseImage: {
    width: '100%',
    height: '100%',
  },
  basePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  baseInput: {
    flex: 1,
    fontSize: 16,
  },
  unlinkButton: {
    marginRight: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
  },
  modalContent: {
    borderRadius: 16,
    padding: 16,
    maxHeight: 360,
    gap: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  emptyModalLabel: {
    textAlign: 'center',
    paddingVertical: 12,
    fontSize: 14,
  },
});
