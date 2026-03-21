import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Colors } from "@/constants/theme";

type CropRect = { x: number; y: number; size: number };

type Props = {
  visible: boolean;
  imageUri: string | null;
  imageWidth: number;
  imageHeight: number;
  onCancel: () => void;
  onConfirm: (crop: { x: number; y: number; width: number; height: number }) => void;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const MIN_CROP_SIZE = 80;
const CROP_VIEW_SIZE = 320;
const HANDLE_SIZE = 26;

export function ManualImageCropperModal({
  visible,
  imageUri,
  imageWidth,
  imageHeight,
  onCancel,
  onConfirm,
}: Props) {
  const layout = useMemo(() => {
    if (imageWidth <= 0 || imageHeight <= 0) {
      return { drawWidth: CROP_VIEW_SIZE, drawHeight: CROP_VIEW_SIZE, offsetX: 0, offsetY: 0 };
    }

    const scale = Math.min(CROP_VIEW_SIZE / imageWidth, CROP_VIEW_SIZE / imageHeight);
    const drawWidth = imageWidth * scale;
    const drawHeight = imageHeight * scale;

    return {
      drawWidth,
      drawHeight,
      offsetX: (CROP_VIEW_SIZE - drawWidth) / 2,
      offsetY: (CROP_VIEW_SIZE - drawHeight) / 2,
    };
  }, [imageHeight, imageWidth]);

  const maxCropSize = Math.min(layout.drawWidth, layout.drawHeight);

  const [cropRect, setCropRect] = useState<CropRect>({
    x: layout.offsetX,
    y: layout.offsetY,
    size: maxCropSize,
  });

  useEffect(() => {
    if (!visible) {
      return;
    }

    const size = Math.max(MIN_CROP_SIZE, maxCropSize * 0.7);
    setCropRect({
      x: clamp(layout.offsetX + (layout.drawWidth - size) / 2, layout.offsetX, layout.offsetX + layout.drawWidth - size),
      y: clamp(layout.offsetY + (layout.drawHeight - size) / 2, layout.offsetY, layout.offsetY + layout.drawHeight - size),
      size,
    });
  }, [layout.drawHeight, layout.drawWidth, layout.offsetX, layout.offsetY, maxCropSize, visible]);

  const dragStart = useRef<CropRect | null>(null);

  const moveResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStart.current = cropRect;
        },
        onPanResponderMove: (_, gesture) => {
          const start = dragStart.current;
          if (!start) {
            return;
          }

          const x = clamp(
            start.x + gesture.dx,
            layout.offsetX,
            layout.offsetX + layout.drawWidth - start.size,
          );
          const y = clamp(
            start.y + gesture.dy,
            layout.offsetY,
            layout.offsetY + layout.drawHeight - start.size,
          );

          setCropRect({ ...start, x, y });
        },
      }),
    [cropRect, layout.drawHeight, layout.drawWidth, layout.offsetX, layout.offsetY],
  );

  const resizeStart = useRef<CropRect | null>(null);

  const resizeResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          resizeStart.current = cropRect;
        },
        onPanResponderMove: (_, gesture) => {
          const start = resizeStart.current;
          if (!start) {
            return;
          }

          const maxByWidth = layout.offsetX + layout.drawWidth - start.x;
          const maxByHeight = layout.offsetY + layout.drawHeight - start.y;
          const nextSize = clamp(
            start.size + Math.max(gesture.dx, gesture.dy),
            MIN_CROP_SIZE,
            Math.min(maxByWidth, maxByHeight),
          );

          setCropRect({ ...start, size: nextSize });
        },
      }),
    [cropRect, layout.drawHeight, layout.drawWidth, layout.offsetX, layout.offsetY],
  );

  const handleConfirm = useCallback(() => {
    if (!imageUri || imageWidth <= 0 || imageHeight <= 0) {
      onCancel();
      return;
    }

    const relativeX = (cropRect.x - layout.offsetX) / layout.drawWidth;
    const relativeY = (cropRect.y - layout.offsetY) / layout.drawHeight;
    const relativeSize = cropRect.size / layout.drawWidth;

    const x = clamp(Math.round(relativeX * imageWidth), 0, imageWidth - 1);
    const y = clamp(Math.round(relativeY * imageHeight), 0, imageHeight - 1);
    const width = clamp(Math.round(relativeSize * imageWidth), 1, imageWidth - x);
    const height = clamp(Math.round((cropRect.size / layout.drawHeight) * imageHeight), 1, imageHeight - y);

    onConfirm({ x, y, width, height });
  }, [cropRect, imageHeight, imageUri, imageWidth, layout.drawHeight, layout.drawWidth, layout.offsetX, layout.offsetY, onCancel, onConfirm]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Crop image</Text>
          <Text style={styles.subtitle}>Move and resize the square to pick the exact area.</Text>

          <View style={styles.cropViewport}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.image} contentFit="contain" />
            ) : null}

            <View
              style={[
                styles.cropRect,
                {
                  left: cropRect.x,
                  top: cropRect.y,
                  width: cropRect.size,
                  height: cropRect.size,
                },
              ]}
              {...moveResponder.panHandlers}
            >
              <View style={styles.handle} {...resizeResponder.panHandlers} />
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.cancelButton]} onPress={onCancel}>
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.confirmButton]} onPress={handleConfirm}>
              <Text style={styles.confirmLabel}>Apply crop</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  title: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    color: Colors.onSurfaceVariant,
    fontSize: 14,
  },
  cropViewport: {
    width: CROP_VIEW_SIZE,
    height: CROP_VIEW_SIZE,
    alignSelf: "center",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Colors.background,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  cropRect: {
    position: "absolute",
    borderWidth: 2,
    borderColor: Colors.tint,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  handle: {
    position: "absolute",
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    right: -HANDLE_SIZE / 2,
    bottom: -HANDLE_SIZE / 2,
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: Colors.tint,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: Colors.surfaceBright,
  },
  confirmButton: {
    backgroundColor: Colors.tint,
  },
  cancelLabel: {
    color: Colors.text,
    fontWeight: "600",
  },
  confirmLabel: {
    color: Colors.onPrimary,
    fontWeight: "700",
  },
});
