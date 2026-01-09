import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { TAG_COLORS } from '@/constants/tag-colors';
import { Colors } from '@/constants/theme';

type TagEditorModalProps = {
  visible: boolean;
  title: string;
  confirmLabel: string;
  initialName?: string | null;
  initialColor?: string | null;
  onClose: () => void;
  onSave: (data: { name: string; color: string }) => void;
};

export function TagEditorModal({
  visible,
  title,
  confirmLabel,
  initialName,
  initialColor,
  onClose,
  onSave,
}: TagEditorModalProps) {
  const palette = Colors;
  const [name, setName] = useState(initialName ?? '');
  const [color, setColor] = useState(initialColor ?? TAG_COLORS[0]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setName(initialName ?? '');
    setColor(initialColor ?? TAG_COLORS[0]);
  }, [initialColor, initialName, visible]);

  const trimmedName = useMemo(() => name.trim(), [name]);
  const canSave = trimmedName.length > 0;

  const handleSave = () => {
    if (!canSave) {
      return;
    }

    onSave({ name: trimmedName, color });
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityRole="button">
        <Pressable
          style={[
            styles.card,
            { backgroundColor: palette.surface, borderColor: palette.outline, shadowColor: palette.shadow },
          ]}
          onPress={(event) => event.stopPropagation?.()}
          accessibilityRole="menu"
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.onSurface }]}>{title}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <MaterialCommunityIcons name="close" size={22} color={palette.onSurfaceVariant} />
            </Pressable>
          </View>
          <Text style={[styles.label, { color: palette.onSurfaceVariant }]}>Tag name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="New tag"
            placeholderTextColor={`${palette.onSurfaceVariant}99`}
            style={[
              styles.input,
              { borderColor: palette.outlineVariant, color: palette.text, backgroundColor: palette.surface },
            ]}
          />
          <Text style={[styles.label, { color: palette.onSurfaceVariant }]}>Color</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.colorRow}
          >
            {TAG_COLORS.map((swatch) => {
              const selected = swatch === color;
              return (
                <Pressable
                  key={swatch}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setColor(swatch)}
                  style={[
                    styles.colorSwatch,
                    {
                      backgroundColor: swatch,
                      borderColor: selected ? palette.onSurface : palette.outlineVariant,
                    },
                  ]}
                >
                  {selected ? (
                    <MaterialCommunityIcons name="check" size={14} color={palette.surface} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave }}
            onPress={handleSave}
            style={[
              styles.saveButton,
              { backgroundColor: canSave ? palette.tint : palette.outlineVariant },
            ]}
          >
            <Text style={[styles.saveLabel, { color: palette.onPrimary }]}>{confirmLabel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
});
