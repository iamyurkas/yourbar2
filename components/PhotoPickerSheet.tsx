import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppColors } from '@/constants/theme';

export type PhotoPickerResult = {
  uri: string;
  width: number;
  height: number;
  type: 'image';
};

type PhotoPickerSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  onSelect: (photo: PhotoPickerResult) => void;
  title?: string;
};

type RecentItem = { uri: string; width: number; height: number };

export function PhotoPickerSheet({ visible, onDismiss, onSelect, title = 'Choose photo' }: PhotoPickerSheetProps) {
  const Colors = useAppColors();
  const [recentSelections, setRecentSelections] = useState<RecentItem[]>([]);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [libraryStatus, requestLibraryPermission] = ImagePicker.useMediaLibraryPermissions();
  const [cameraStatus, requestCameraPermission] = ImagePicker.useCameraPermissions();

  const tiles = useMemo(() => recentSelections.slice(0, 60), [recentSelections]);

  const handlePickFromLibrary = useCallback(async () => {
    const status = libraryStatus?.granted ? libraryStatus : await requestLibraryPermission();
    if (!status?.granted) {
      setPermissionMessage('Allow photo library access to choose a photo.');
      return;
    }

    setPermissionMessage(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
      exif: false,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      const asset = result.assets[0];
      const selected = { uri: asset.uri, width: asset.width ?? 0, height: asset.height ?? 0 };
      setRecentSelections((prev) => [selected, ...prev.filter((item) => item.uri !== selected.uri)]);
      onSelect({ ...selected, type: 'image' });
      onDismiss();
    }
  }, [libraryStatus, onDismiss, onSelect, requestLibraryPermission]);

  const handleCameraPress = useCallback(async () => {
    const status = cameraStatus?.granted ? cameraStatus : await requestCameraPermission();
    if (!status?.granted) {
      setPermissionMessage('Allow camera access to capture a photo.');
      return;
    }

    setPermissionMessage(null);
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
      exif: false,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      const asset = result.assets[0];
      const selected = { uri: asset.uri, width: asset.width ?? 0, height: asset.height ?? 0 };
      setRecentSelections((prev) => [selected, ...prev.filter((item) => item.uri !== selected.uri)]);
      onSelect({ ...selected, type: 'image' });
      onDismiss();
    }
  }, [cameraStatus, onDismiss, onSelect, requestCameraPermission]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss} />
      <View style={[styles.sheet, { backgroundColor: Colors.surface }]}>
        <View style={styles.handle} />
        <Text style={[styles.title, { color: Colors.onSurface }]}>{title}</Text>
        {permissionMessage ? (
          <View style={styles.permissionRow}>
            <Text style={[styles.permissionText, { color: Colors.onSurfaceVariant }]}>{permissionMessage}</Text>
            <Pressable onPress={() => Linking.openSettings()} style={[styles.settingsButton, { borderColor: Colors.outlineVariant }]}>
              <Text style={[styles.settingsLabel, { color: Colors.tint }]}>Open Settings</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.grid}>
          <Pressable style={[styles.tile, { backgroundColor: Colors.background }]} onPress={handleCameraPress}>
            <MaterialCommunityIcons name="camera-outline" size={28} color={Colors.onSurfaceVariant} />
          </Pressable>
          <Pressable style={[styles.tile, { backgroundColor: Colors.background }]} onPress={handlePickFromLibrary}>
            <MaterialCommunityIcons name="image-multiple-outline" size={28} color={Colors.onSurfaceVariant} />
          </Pressable>
          {tiles.map((item) => (
            <Pressable key={item.uri} style={styles.tile} onPress={() => { onSelect({ ...item, type: 'image' }); onDismiss(); }}>
              <Image source={{ uri: item.uri }} style={styles.image} contentFit="cover" />
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000055' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 12,
    paddingBottom: 20,
    paddingTop: 8,
    minHeight: 360,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 3,
    backgroundColor: '#999',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 10, paddingHorizontal: 4 },
  permissionRow: { paddingHorizontal: 4, marginBottom: 8, gap: 8 },
  permissionText: { fontSize: 14 },
  settingsButton: { alignSelf: 'flex-start', borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  settingsLabel: { fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  tile: { width: '32.2%', aspectRatio: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
});
