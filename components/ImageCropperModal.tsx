import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  Action,
  FlipType,
  SaveFormat,
  manipulateAsync,
} from "expo-image-manipulator";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  CropZoom,
  type CropZoomType,
  useImageResolution,
} from "react-native-zoom-toolkit";

type ImageCropperModalProps = {
  visible: boolean;
  imageUri: string | null;
  onCancel: () => void;
  onApply: (uri: string) => void;
};

const MIN_CROP_SIZE = 120;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function ImageCropperModal({
  visible,
  imageUri,
  onCancel,
  onApply,
}: ImageCropperModalProps) {
  const cropRef = useRef<CropZoomType>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [cropWidth, setCropWidth] = useState(240);
  const [cropHeight, setCropHeight] = useState(240);

  const { width, height } = useWindowDimensions();
  const maxCropWidth = Math.max(MIN_CROP_SIZE, Math.floor(width * 0.9));
  const maxCropHeight = Math.max(MIN_CROP_SIZE, Math.floor(height * 0.6));

  const { isFetching, resolution } = useImageResolution({ uri: imageUri ?? "" });

  useEffect(() => {
    if (!visible) {
      return;
    }
    setCropWidth(Math.floor(maxCropWidth * 0.8));
    setCropHeight(Math.floor(maxCropHeight * 0.8));
  }, [maxCropHeight, maxCropWidth, visible, imageUri]);

  const cropSize = useMemo(
    () => ({
      width: clamp(cropWidth, MIN_CROP_SIZE, maxCropWidth),
      height: clamp(cropHeight, MIN_CROP_SIZE, maxCropHeight),
    }),
    [cropHeight, cropWidth, maxCropHeight, maxCropWidth],
  );

  const adjustCropSize = useCallback(
    (axis: "width" | "height", delta: number) => {
      if (axis === "width") {
        setCropWidth((current) =>
          clamp(current + delta, MIN_CROP_SIZE, maxCropWidth),
        );
        return;
      }
      setCropHeight((current) =>
        clamp(current + delta, MIN_CROP_SIZE, maxCropHeight),
      );
    },
    [maxCropHeight, maxCropWidth],
  );

  const handleApplyCrop = useCallback(async () => {
    if (!imageUri) {
      return;
    }

    const result = cropRef.current?.crop();
    if (!result) {
      return;
    }

    const actions: Action[] = [];
    if (result.resize) {
      actions.push({ resize: result.resize });
    }
    if (result.context.flipHorizontal) {
      actions.push({ flip: FlipType.Horizontal });
    }
    if (result.context.flipVertical) {
      actions.push({ flip: FlipType.Vertical });
    }
    if (result.context.rotationAngle !== 0) {
      actions.push({ rotate: result.context.rotationAngle });
    }
    actions.push({ crop: result.crop });

    try {
      setIsCropping(true);
      const croppedImage = await manipulateAsync(imageUri, actions, {
        compress: 1,
        format: SaveFormat.JPEG,
      });
      onApply(croppedImage.uri);
    } finally {
      setIsCropping(false);
    }
  }, [imageUri, onApply]);

  const renderOverlay = useCallback(
    () => (
      <View pointerEvents="none" style={styles.overlayRoot}>
        <View
          style={[
            styles.overlayFrame,
            { width: cropSize.width, height: cropSize.height },
          ]}
        />
      </View>
    ),
    [cropSize.height, cropSize.width],
  );

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.root}>
        {imageUri && resolution && !isFetching ? (
          <CropZoom
            ref={cropRef}
            cropSize={cropSize}
            resolution={resolution}
            OverlayComponent={renderOverlay}
            maxScale={8}
          >
            <Image source={{ uri: imageUri }} style={styles.imageFill} contentFit="contain" />
          </CropZoom>
        ) : (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        )}

        <View style={styles.controlsPanel}>
          <View style={styles.adjustmentsRow}>
            <Pressable onPress={() => adjustCropSize("width", -24)} style={styles.controlButton}>
              <MaterialCommunityIcons name="arrow-expand-horizontal" size={20} color="#fff" />
            </Pressable>
            <Pressable onPress={() => adjustCropSize("width", 24)} style={styles.controlButton}>
              <MaterialCommunityIcons name="arrow-expand-horizontal" size={20} color="#7fead7" />
            </Pressable>
            <Pressable onPress={() => adjustCropSize("height", -24)} style={styles.controlButton}>
              <MaterialCommunityIcons name="arrow-expand-vertical" size={20} color="#fff" />
            </Pressable>
            <Pressable onPress={() => adjustCropSize("height", 24)} style={styles.controlButton}>
              <MaterialCommunityIcons name="arrow-expand-vertical" size={20} color="#7fead7" />
            </Pressable>
          </View>

          <View style={styles.actionsRow}>
            <Pressable onPress={onCancel} style={[styles.actionButton, styles.cancelButton]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleApplyCrop}
              style={[styles.actionButton, styles.applyButton]}
              disabled={isCropping}
            >
              {isCropping ? (
                <ActivityIndicator color="#001f1d" size="small" />
              ) : (
                <Text style={styles.applyText}>Apply crop</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#111",
  },
  imageFill: {
    width: "100%",
    height: "100%",
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  overlayFrame: {
    borderColor: "#7fead7",
    borderWidth: 2,
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  controlsPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: 12,
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  adjustmentsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  controlButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
  },
  applyButton: {
    backgroundColor: "#7fead7",
  },
  cancelText: {
    color: "#fff",
    fontWeight: "600",
  },
  applyText: {
    color: "#001f1d",
    fontWeight: "700",
  },
});
