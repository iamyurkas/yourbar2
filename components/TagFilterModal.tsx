import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { TagDot } from './RowParts';

type TagFilterOption = {
  id: number;
  name: string;
  color: string;
};

type TagFilterModalProps = {
  visible: boolean;
  tags: readonly TagFilterOption[];
  selectedTagId?: number;
  onSelect: (tagId?: number) => void;
  onClose: () => void;
  topOffset?: number;
};

const ROW_HEIGHT = 44;
const VISIBLE_ROWS = 5.5;

function withOpacity(color: string, fallback: string) {
  if (typeof color !== 'string') {
    return fallback;
  }
  const hex = color.trim();
  if (/^#([\da-f]{3}){1,2}$/i.test(hex)) {
    if (hex.length === 4) {
      const r = hex[1];
      const g = hex[2];
      const b = hex[3];
      return `#${r}${r}${g}${g}${b}${b}33`;
    }
    return `${hex}33`;
  }
  return fallback;
}

export function TagFilterModal({
  visible,
  tags,
  selectedTagId,
  onSelect,
  onClose,
  topOffset = 96,
}: TagFilterModalProps) {
  const palette = Colors;

  const tagOptions = useMemo(() => {
    return tags.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [tags]);

  const maxHeight = ROW_HEIGHT * VISIBLE_ROWS;

  const handleSelect = (tagId?: number) => {
    onSelect(tagId);
  };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <View style={[styles.anchor, { paddingTop: topOffset }]}>
          <View style={[styles.modal, { backgroundColor: palette.surface, borderColor: palette.outline }]}> 
            <ScrollView
              style={{ maxHeight }}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator>
              <Pressable
                accessibilityRole="button"
                onPress={() => handleSelect(undefined)}
                style={[
                  styles.tagButton,
                  {
                    borderColor: palette.outline,
                    backgroundColor: selectedTagId == null ? `${palette.tint}1A` : palette.surface,
                  },
                ]}
                hitSlop={4}>
                <View style={styles.tagRowContent}>
                  <Text style={[styles.tagLabel, { color: palette.onSurface }]}>All tags</Text>
                </View>
              </Pressable>
              {tagOptions.map((tag) => {
                const isSelected = tag.id === selectedTagId;
                const backgroundColor = isSelected
                  ? withOpacity(tag.color, `${palette.tint}22`)
                  : palette.surface;
                return (
                  <Pressable
                    key={tag.id}
                    accessibilityRole="button"
                    onPress={() => handleSelect(tag.id)}
                    style={[
                      styles.tagButton,
                      {
                        borderColor: palette.outline,
                        backgroundColor,
                      },
                    ]}
                    hitSlop={4}>
                    <View style={styles.tagRowContent}>
                      <TagDot color={tag.color} />
                      <Text style={[styles.tagLabel, { color: palette.onSurface }]}>{tag.name}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000055',
  },
  anchor: {
    flex: 1,
    alignItems: 'flex-end',
    paddingHorizontal: 16,
  },
  modal: {
    width: 220,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingVertical: 4,
  },
  tagButton: {
    height: ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tagRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tagLabel: {
    fontSize: 16,
  },
});

export type { TagFilterOption };
