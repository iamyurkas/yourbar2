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
      <ScrollView
        contentContainerStyle={styles.content}
        style={styles.container}
        keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={[styles.label, { color: palette.onSurfaceVariant }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="For example, Ginger syrup"
            style={[styles.input, { borderColor: palette.outline, color: palette.text }]}
            placeholderTextColor={`${palette.onSurfaceVariant}99`}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={placeholderLabel}
          style={[styles.imagePlaceholder, { borderColor: palette.outline }]} 
          onPress={handlePickImage}
          android_ripple={{ color: `${palette.surface}33` }}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} contentFit="cover" />
          ) : (
            <View style={styles.placeholderContent}>
              <MaterialCommunityIcons name="image-plus" size={32} color={palette.onSurfaceVariant} />
              <Text style={[styles.placeholderText, { color: palette.onSurfaceVariant }]}>150 × 150</Text>
              <Text style={[styles.placeholderHint, { color: palette.onSurfaceVariant }]}>
                Tap to add a photo
              </Text>
            </View>
          )}
        </Pressable>

        <View style={styles.section}>
          <Text style={[styles.label, { color: palette.onSurfaceVariant }]}>Tags</Text>
          <Text style={[styles.hint, { color: palette.onSurfaceVariant }]}>Select one or more tags</Text>
          <View style={styles.tagList}>
            {tagSelection.map((tag) => {
              const isSelected = tag.selected;
              const backgroundColor = isSelected ? tag.color : palette.surface;
              const borderColor = tag.color;
              const textColor = isSelected ? Colors.surface : tag.color;

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

        <View style={styles.section}>
          <Text style={[styles.label, { color: palette.onSurfaceVariant }]}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Add tasting notes or usage suggestions"
            style={[styles.input, styles.multilineInput, { borderColor: palette.outline, color: palette.text }]}
            placeholderTextColor={`${palette.onSurfaceVariant}99`}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <Pressable
          accessibilityRole="button"
          style={[styles.submitButton, { backgroundColor: palette.tint }]}
          onPress={handleSubmit}
          disabled={isPickingImage}>
          <Text style={[styles.submitLabel, { color: palette.surface }]}>Save</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  content: {
    padding: 24,
    gap: 24,
  },
  section: {
    gap: 8,
  },
  label: {
    fontSize: 16,
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
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  placeholderHint: {
    fontSize: 12,
    textAlign: 'center',
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tagChip: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tagLabel: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  submitButton: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
