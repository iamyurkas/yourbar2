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

export default function CreateIngredientScreen() {
  const palette = Colors;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [permissionStatus, requestPermission] = ImagePicker.useMediaLibraryPermissions();

  const placeholderLabel = useMemo(() => {
    if (imageUri) {
      return 'Змінити зображення';
    }

    return 'Додати зображення';
  }, [imageUri]);

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
        'Доступ до медіатеки',
        'Надайте доступ до фото у налаштуваннях пристрою, щоб додати зображення інгредієнта.',
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
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
      Alert.alert('Не вдалося вибрати зображення', 'Повторіть спробу пізніше.');
    } finally {
      setIsPickingImage(false);
    }
  }, [ensureMediaPermission, isPickingImage]);

  const handleSubmit = useCallback(() => {
    if (!name.trim()) {
      Alert.alert('Назва обовʼязкова', 'Будь ласка, введіть назву інгредієнта.');
      return;
    }

    Alert.alert(
      'Інгредієнт збережено',
      'Цей прототип поки що не синхронізується з базою даних, але форма готова до інтеграції.',
      [
        {
          text: 'Повернутися',
          onPress: () => {
            router.back();
          },
        },
      ],
    );
  }, [name]);

  return (
    <>
      <Stack.Screen options={{ title: 'Новий інгредієнт' }} />
      <ScrollView
        contentContainerStyle={styles.content}
        style={styles.container}
        keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={[styles.label, { color: palette.onSurfaceVariant }]}>Назва</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Наприклад, Імбирний сироп"
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
                Натисніть, щоб додати фото
              </Text>
            </View>
          )}
        </Pressable>

        <View style={styles.section}>
          <Text style={[styles.label, { color: palette.onSurfaceVariant }]}>Опис</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Додайте нотатки про смак або поради щодо використання"
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
          <Text style={[styles.submitLabel, { color: palette.surface }]}>Зберегти</Text>
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
