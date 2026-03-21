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

type CropRect = { x: number; y: number; width: number; height: number };

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

const MIN_CROP_WIDTH = 80;
const MIN_CROP_HEIGHT = 80;
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
    width: maxCropSize,
    height: maxCropSize,
  });

  useEffect(() => {
    if (!visible) {
      return;
    }

    const width = Math.max(MIN_CROP_WIDTH, layout.drawWidth * 0.75);
    const height = Math.max(MIN_CROP_HEIGHT, layout.drawHeight * 0.75);
    setCropRect({
      x: clamp(
        layout.offsetX + (layout.drawWidth - width) / 2,
        layout.offsetX,
        layout.offsetX + layout.drawWidth - width,
      ),
      y: clamp(
        layout.offsetY + (layout.drawHeight - height) / 2,
        layout.offsetY,
        layout.offsetY + layout.drawHeight - height,
      ),
      width,
      height,
    });
  }, [layout.drawHeight, layout.drawWidth, layout.offsetX, layout.offsetY, visible]);

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
            layout.offsetX + layout.drawWidth - start.width,
          );
          const y = clamp(
            start.y + gesture.dy,
            layout.offsetY,
            layout.offsetY + layout.drawHeight - start.height,
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
          const nextWidth = clamp(
            start.width + gesture.dx,
            MIN_CROP_WIDTH,
            maxByWidth,
          );
          const nextHeight = clamp(
            start.height + gesture.dy,
            MIN_CROP_HEIGHT,
            maxByHeight,
          );

          setCropRect({ ...start, width: nextWidth, height: nextHeight });
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
    const relativeWidth = cropRect.width / layout.drawWidth;
    const relativeHeight = cropRect.height / layout.drawHeight;

    const x = clamp(Math.round(relativeX * imageWidth), 0, imageWidth - 1);
    const y = clamp(Math.round(relativeY * imageHeight), 0, imageHeight - 1);
    const width = clamp(Math.round(relativeWidth * imageWidth), 1, imageWidth - x);
    const height = clamp(Math.round(relativeHeight * imageHeight), 1, imageHeight - y);

    onConfirm({ x, y, width, height });
  }, [cropRect, imageHeight, imageUri, imageWidth, layout.drawHeight, layout.drawWidth, layout.offsetX, layout.offsetY, onCancel, onConfirm]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Crop image</Text>
          <Text style={styles.subtitle}>Move and resize the crop area to pick the exact frame.</Text>

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
                  width: cropRect.width,
                  height: cropRect.height,
                },
              ]}
              {...moveResponder.panHandlers}
            />
            <View
              style={[
                styles.handle,
                {
                  left: cropRect.x + cropRect.width - HANDLE_SIZE / 2,
                  top: cropRect.y + cropRect.height - HANDLE_SIZE / 2,
                },
              ]}
              {...resizeResponder.panHandlers}
            />
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
