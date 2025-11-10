import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';

export default function CreateIngredientScreen() {
  const palette = Colors;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [permissionStatus, requestPermission] = ImagePicker.useMediaLibraryPermissions();

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

  const tagSelection = useMemo(() => {
    const set = new Set(selectedTagIds);
    return BUILTIN_INGREDIENT_TAGS.map((tag) => ({
      ...tag,
      selected: set.has(tag.id),
    }));
  }, [selectedTagIds]);

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

  const handleSubmit = useCallback(() => {
    if (!name.trim()) {
      Alert.alert('Name is required', 'Please enter the ingredient name.');
      return;
    }

    Alert.alert(
      'Ingredient saved',
      'This prototype does not persist data yet, but the form is ready for integration.',
      [
        {
          text: 'Go back',
          onPress: () => {
            router.back();
          },
        },
      ],
    );
  }, [name]);

  return (
    <>
      <Stack.Screen options={{ title: 'New ingredient' }} />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={[styles.content, { backgroundColor: palette.background }]}
          style={styles.container}
          keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.onSurface }]}>Add a new ingredient</Text>
            <Text style={[styles.subtitle, { color: palette.onSurfaceVariant }]}>
              Keep your bar list tidy and easy to search.
            </Text>
          </View>

          <View
            style={[
              styles.formCard,
              {
                backgroundColor: palette.surfaceBright,
                borderColor: palette.outlineVariant,
                shadowColor: palette.shadow,
              },
            ]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={placeholderLabel}
              style={[
                styles.imagePlaceholder,
                { backgroundColor: palette.surfaceVariant, borderColor: palette.outline },
              ]}
              onPress={handlePickImage}
              android_ripple={{ color: `${palette.surface}33` }}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.image} contentFit="cover" />
              ) : (
                <View style={styles.placeholderContent}>
                  <View
                    style={[
                      styles.placeholderBadge,
                      { backgroundColor: `${palette.tint}1A`, borderColor: `${palette.tint}3D` },
                    ]}
                  >
                    <MaterialCommunityIcons name="image-plus" size={28} color={palette.tint} />
                  </View>
                  <Text style={[styles.placeholderText, { color: palette.onSurfaceVariant }]}>
                    Add a square image
                  </Text>
                  <Text style={[styles.placeholderHint, { color: palette.onSurfaceVariant }]}>
                    Tap to upload from your library
                  </Text>
                </View>
              )}
            </Pressable>

            <View style={styles.fieldGroup}>
              <View style={styles.fieldHeader}>
                <Text style={[styles.label, { color: palette.onSurface }]}>Name</Text>
                <Text style={[styles.hint, { color: palette.onSurfaceVariant }]}>Required</Text>
              </View>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="For example, Ginger syrup"
                style={[styles.input, { borderColor: palette.outline, color: palette.text }]}
                placeholderTextColor={`${palette.onSurfaceVariant}99`}
              />
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.fieldHeader}>
                <Text style={[styles.label, { color: palette.onSurface }]}>Tags</Text>
                <Text style={[styles.hint, { color: palette.onSurfaceVariant }]}>Select all that apply</Text>
              </View>
              <View style={styles.tagList}>
                {tagSelection.map((tag) => {
                  const isSelected = tag.selected;
                  const backgroundColor = isSelected ? `${tag.color}1F` : palette.surface;
                  const borderColor = isSelected ? tag.color : palette.outline;
                  const textColor = isSelected ? tag.color : palette.onSurfaceVariant;

                  return (
                    <Pressable
                      key={tag.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                      onPress={() => toggleTag(tag.id)}
                      style={[styles.tagChip, { backgroundColor, borderColor }]}
                      android_ripple={{ color: `${palette.surface}33` }}>
                      <Text style={[styles.tagLabel, { color: textColor }]}>{tag.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.fieldHeader}>
                <Text style={[styles.label, { color: palette.onSurface }]}>Description</Text>
                <Text style={[styles.hint, { color: palette.onSurfaceVariant }]}>Optional</Text>
              </View>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Add tasting notes, preferred brands or prep instructions"
                style={[styles.input, styles.multilineInput, { borderColor: palette.outline, color: palette.text }]}
                placeholderTextColor={`${palette.onSurfaceVariant}99`}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              style={[styles.submitButton, { backgroundColor: palette.tint, shadowColor: palette.tint }]}
              onPress={handleSubmit}
              disabled={isPickingImage}>
              <Text style={[styles.submitLabel, { color: palette.surface }]}>Save ingredient</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 28,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  formCard: {
    borderRadius: 24,
    padding: 24,
    gap: 24,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
  imagePlaceholder: {
    height: 190,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  placeholderBadge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  placeholderText: {
    fontSize: 15,
    fontWeight: '600',
  },
  placeholderHint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  fieldGroup: {
    gap: 12,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: Platform.select({ ios: 16, default: 14 }),
    fontSize: 16,
    backgroundColor: Colors.surface,
    shadowColor: '#000000',
    shadowOpacity: Platform.select({ ios: 0.04, default: 0 }),
    shadowRadius: Platform.select({ ios: 12, default: 0 }),
    shadowOffset: Platform.select({ ios: { width: 0, height: 6 }, default: { width: 0, height: 0 } }),
  },
  multilineInput: {
    minHeight: 150,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    rowGap: 14,
  },
  tagChip: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
  },
  tagLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  footer: {
    paddingBottom: 8,
  },
  submitButton: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
  },
  submitLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
