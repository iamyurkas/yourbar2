import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CropZoom, type CropZoomRefType } from "react-native-zoom-toolkit";

import { useAppColors } from "@/constants/theme";
import { useI18n } from "@/libs/i18n/use-i18n";
import { cropImageWithSkia } from "@/libs/photo-crop-utils";

type AspectRatio = {
  id: string;
  labelKey: string;
  width: number;
  height: number;
};

const ASPECT_RATIOS: AspectRatio[] = [
  { id: "free", labelKey: "crop.free", width: 0, height: 0 },
  { id: "original", labelKey: "crop.original", width: -1, height: -1 },
  { id: "1:1", labelKey: "crop.square", width: 1, height: 1 },
  { id: "3:4", labelKey: "crop.3_4", width: 3, height: 4 },
  { id: "4:3", labelKey: "crop.4_3", width: 4, height: 3 },
  { id: "16:9", labelKey: "crop.16_9", width: 16, height: 9 },
  { id: "9:16", labelKey: "crop.9_16", width: 9, height: 16 },
];

type Props = {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
  onConfirm: (croppedUri: string) => void;
};

export function ImageCropModal({
  visible,
  imageUri,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const Colors = useAppColors();
  const insets = useSafeAreaInsets();
  const cropZoomRef = useRef<CropZoomRefType>(null);

  const [containerLayout, setContainerLayout] = useState({ width: 0, height: 0 });
  const [resolution, setResolution] = useState({ width: 0, height: 0 });
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>(ASPECT_RATIOS[1]); // Default to Square
  const [isProcessing, setIsProcessing] = useState(false);

  const handleContainerLayout = useCallback((event: LayoutChangeEvent) => {
    setContainerLayout({
      width: event.nativeEvent.layout.width,
      height: event.nativeEvent.layout.height,
    });
  }, []);

  const handleImageLoad = useCallback((event: { source: { width: number; height: number } }) => {
    setResolution({
      width: event.source.width,
      height: event.source.height,
    });
  }, []);

  const cropSize = useMemo(() => {
    if (containerLayout.width === 0 || containerLayout.height === 0) {
      return { width: 300, height: 300 };
    }

    const margin = 32;
    const maxWidth = containerLayout.width - margin;
    const maxHeight = containerLayout.height - margin;

    let targetRatio = 1;
    if (selectedRatio.id === "original" && resolution.width > 0) {
      targetRatio = resolution.width / resolution.height;
    } else if (selectedRatio.id === "free") {
      // For "Free" we just use the max available space but centered as a square by default,
      // or we can just use the container's ratio.
      // Let's use a 1:1 default for free if not specified, but let the user zoom freely.
      targetRatio = 1;
    } else if (selectedRatio.width > 0) {
      targetRatio = selectedRatio.width / selectedRatio.height;
    }

    if (targetRatio > maxWidth / maxHeight) {
      // Limited by width
      return { width: maxWidth, height: maxWidth / targetRatio };
    } else {
      // Limited by height
      return { width: maxHeight * targetRatio, height: maxHeight };
    }
  }, [selectedRatio, resolution, containerLayout]);

  const handleRotate = useCallback(() => {
    cropZoomRef.current?.rotate();
  }, []);

  const handleReset = useCallback(() => {
    cropZoomRef.current?.reset();
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!imageUri || !cropZoomRef.current || isProcessing) return;

    setIsProcessing(true);
    try {
      const result = cropZoomRef.current.crop();
      const croppedUri = await cropImageWithSkia(
        imageUri,
        result.crop,
        result.context
      );
      onConfirm(croppedUri);
    } catch (error) {
      console.error("Failed to crop image:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [imageUri, onConfirm, isProcessing]);

  if (!imageUri) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: Colors.background }]}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <Pressable onPress={onClose} style={styles.headerButton} accessibilityRole="button" accessibilityLabel={t("common.cancel")}>
            <MaterialCommunityIcons name="close" size={26} color={Colors.onSurface} />
          </Pressable>
          <Text style={[styles.title, { color: Colors.onSurface }]}>{t("common.save")}</Text>
          <Pressable onPress={handleConfirm} style={styles.headerButton} disabled={isProcessing} accessibilityRole="button" accessibilityLabel={t("common.save")}>
            <MaterialCommunityIcons
              name="check"
              size={26}
              color={isProcessing ? Colors.onSurfaceVariant : Colors.tint}
            />
          </Pressable>
        </View>

        <View style={styles.cropContainer} onLayout={handleContainerLayout}>
          {resolution.width > 0 && containerLayout.width > 0 && (
            <CropZoom
              ref={cropZoomRef}
              cropSize={cropSize}
              resolution={resolution}
              minScale={0.5}
            >
              <Image
                source={{ uri: imageUri }}
                style={{ width: resolution.width, height: resolution.height }}
                contentFit="contain"
              />
            </CropZoom>
          )}
          {/* Invisible image to get resolution */}
          <Image
            source={{ uri: imageUri }}
            style={styles.hiddenImage}
            onLoad={handleImageLoad}
          />
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.controls}>
            <Pressable onPress={handleRotate} style={styles.controlButton} accessibilityRole="button">
              <MaterialCommunityIcons name="rotate-right" size={24} color={Colors.onSurface} />
              <Text style={[styles.controlText, { color: Colors.onSurface }]}>{t("crop.rotate")}</Text>
            </Pressable>
            <Pressable onPress={handleReset} style={styles.controlButton} accessibilityRole="button">
              <MaterialCommunityIcons name="refresh" size={24} color={Colors.onSurface} />
              <Text style={[styles.controlText, { color: Colors.onSurface }]}>{t("common.clear")}</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.ratioList}
          >
            {ASPECT_RATIOS.map((ratio) => (
              <Pressable
                key={ratio.id}
                onPress={() => setSelectedRatio(ratio)}
                style={[
                  styles.ratioButton,
                  { borderColor: Colors.outlineVariant },
                  selectedRatio.id === ratio.id && { backgroundColor: Colors.tint + "20", borderColor: Colors.tint },
                ]}
              >
                <Text
                  style={[
                    styles.ratioText,
                    { color: Colors.onSurface },
                    selectedRatio.id === ratio.id && { color: Colors.tint, fontWeight: "600" },
                  ]}
                >
                  {t(ratio.labelKey)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerButton: {
    padding: 8,
  },
  cropContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  hiddenImage: {
    width: 0,
    height: 0,
    position: "absolute",
  },
  footer: {
    paddingTop: 16,
    gap: 20,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 60,
  },
  controlButton: {
    alignItems: "center",
    gap: 6,
  },
  controlText: {
    fontSize: 12,
    fontWeight: "500",
  },
  ratioList: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 12,
  },
  ratioButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 90,
    alignItems: "center",
  },
  ratioText: {
    fontSize: 14,
  },
});
