import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppColors } from '@/constants/theme';

type PhotoSourceModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onTakePhoto: () => void;
  onChooseFromLibrary: () => void;
};

export function PhotoSourceModal({
  visible,
  title,
  onClose,
  onTakePhoto,
  onChooseFromLibrary,
}: PhotoSourceModalProps) {
  const Colors = useAppColors();

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: Colors.backdrop }]} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: Colors.surface }]}
          onPress={(event) => event.stopPropagation()}>
          <View style={[styles.grabber, { backgroundColor: Colors.outlineVariant }]} />
          <Text style={[styles.title, { color: Colors.onSurface }]}>{title}</Text>

          <Pressable
            style={[styles.actionButton, { backgroundColor: Colors.surfaceVariant }]}
            onPress={onTakePhoto}
            accessibilityRole="button"
            accessibilityLabel="Take photo">
            <MaterialCommunityIcons name="camera-outline" size={22} color={Colors.onSurface} />
            <Text style={[styles.actionLabel, { color: Colors.onSurface }]}>Take photo</Text>
          </Pressable>

          <Pressable
            style={[styles.actionButton, { backgroundColor: Colors.surfaceVariant }]}
            onPress={onChooseFromLibrary}
            accessibilityRole="button"
            accessibilityLabel="Choose from gallery">
            <MaterialCommunityIcons name="image-multiple-outline" size={22} color={Colors.onSurface} />
            <Text style={[styles.actionLabel, { color: Colors.onSurface }]}>Choose from gallery</Text>
          </Pressable>

          <Pressable
            style={[styles.cancelButton, { borderColor: Colors.outlineVariant }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel">
            <Text style={[styles.cancelLabel, { color: Colors.onSurfaceVariant }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 22,
    gap: 12,
  },
  grabber: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  actionButton: {
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  cancelLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
