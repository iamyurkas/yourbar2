import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image as RNImage,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

type ImageCropperModalProps = {
  visible: boolean;
  imageUri: string | null;
  onCancel: () => void;
  onApply: (uri: string) => void;
};

type ToolkitModule = {
  CropZoom: React.ComponentType<any>;
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
  const cropRef = useRef<any>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [cropWidth, setCropWidth] = useState(240);
  const [cropHeight, setCropHeight] = useState(240);
  const [resolution, setResolution] = useState<{ width: number; height: number } | null>(null);
  const [isFetchingResolution, setIsFetchingResolution] = useState(false);
  const [CropZoomComponent, setCropZoomComponent] = useState<React.ComponentType<any> | null>(null);
  const [toolkitAvailable, setToolkitAvailable] = useState(true);

  const { width, height } = useWindowDimensions();
  const maxCropWidth = Math.max(MIN_CROP_SIZE, Math.floor(width * 0.9));
  const maxCropHeight = Math.max(MIN_CROP_SIZE, Math.floor(height * 0.6));

  useEffect(() => {
    if (!visible) {
      return;
    }
    setCropWidth(Math.floor(maxCropWidth * 0.8));
    setCropHeight(Math.floor(maxCropHeight * 0.8));
  }, [maxCropHeight, maxCropWidth, visible, imageUri]);

  useEffect(() => {
    if (!visible || !imageUri) {
      return;
    }

    let isMounted = true;
    setIsFetchingResolution(true);
    RNImage.getSize(
      imageUri,
      (w, h) => {
        if (!isMounted) {
          return;
        }
        setResolution({ width: w, height: h });
        setIsFetchingResolution(false);
      },
      () => {
        if (!isMounted) {
          return;
        }
        setResolution(null);
        setIsFetchingResolution(false);
      },
    );

    return () => {
      isMounted = false;
    };
  }, [imageUri, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let isMounted = true;
    const loadToolkit = async () => {
      try {
        const toolkit = (await import("react-native-zoom-toolkit")) as ToolkitModule;
        if (!isMounted) {
          return;
        }
        setCropZoomComponent(() => toolkit.CropZoom);
        setToolkitAvailable(true);
      } catch {
        if (!isMounted) {
          return;
        }
        setCropZoomComponent(null);
        setToolkitAvailable(false);
      }
    };

    void loadToolkit();

    return () => {
      isMounted = false;
    };
  }, [visible]);

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

    if (!toolkitAvailable) {
      onApply(imageUri);
      return;
    }

    const directCropResult = await cropRef.current?.crop?.(1280);
    if (typeof directCropResult === "string" && directCropResult.length > 0) {
      onApply(directCropResult);
      return;
    }
    if (
      directCropResult
      && typeof directCropResult === "object"
      && "uri" in directCropResult
      && typeof (directCropResult as { uri?: unknown }).uri === "string"
    ) {
      onApply((directCropResult as { uri: string }).uri);
      return;
    }

    const result = cropRef.current?.crop?.();
    if (!result) {
      onApply(imageUri);
      return;
    }

    const actions: Array<Record<string, unknown>> = [];
    if (result.resize) {
      actions.push({ resize: result.resize });
    }
    if (result.context?.flipHorizontal) {
      actions.push({ flip: "horizontal" });
    }
    if (result.context?.flipVertical) {
      actions.push({ flip: "vertical" });
    }
    if (result.context?.rotationAngle) {
      actions.push({ rotate: result.context.rotationAngle });
    }
    actions.push({ crop: result.crop });

    try {
      setIsCropping(true);
      let manipulatorApi: any = null;
      let horizontalFlipValue: unknown = "horizontal";
      let verticalFlipValue: unknown = "vertical";
      let jpegFormatValue: unknown = "jpeg";
      try {
        try {
          const expoModulesCore = await import("expo-modules-core");
          const requireOptionalNativeModule = (expoModulesCore as any).requireOptionalNativeModule;
          if (typeof requireOptionalNativeModule === "function") {
            const nativeModule = requireOptionalNativeModule("ExpoImageManipulator");
            if (!nativeModule) {
              onApply(imageUri);
              return;
            }
          }
        } catch {
          onApply(imageUri);
          return;
        }

        const loadedModule = await import("expo-image-manipulator");
        const defaultExport = (loadedModule as any).default;
        manipulatorApi =
          defaultExport?.manipulateAsync
            ? defaultExport
            : (loadedModule as any).manipulateAsync
              ? loadedModule
              : null;
        horizontalFlipValue =
          manipulatorApi?.FlipType?.Horizontal ??
          (loadedModule as any).FlipType?.Horizontal ??
          "horizontal";
        verticalFlipValue =
          manipulatorApi?.FlipType?.Vertical ??
          (loadedModule as any).FlipType?.Vertical ??
          "vertical";
        jpegFormatValue =
          manipulatorApi?.SaveFormat?.JPEG ??
          (loadedModule as any).SaveFormat?.JPEG ??
          "jpeg";
      } catch {
        onApply(imageUri);
        return;
      }

      if (!manipulatorApi?.manipulateAsync) {
        onApply(imageUri);
        return;
      }

      const normalizedActions = actions.map((action) => {
        if ("flip" in action) {
          return {
            flip:
              action.flip === "horizontal"
                ? horizontalFlipValue
                : verticalFlipValue,
          };
        }
        return action;
      });

      const croppedImage = await manipulatorApi.manipulateAsync(
        imageUri,
        normalizedActions,
        {
          compress: 1,
          format: jpegFormatValue,
        },
      );
      onApply(croppedImage?.uri ?? imageUri);
    } catch (error) {
      console.warn("Failed to apply crop, fallback to original image", error);
      onApply(imageUri);
    } finally {
      setIsCropping(false);
    }
  }, [imageUri, onApply, toolkitAvailable]);

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

  const canUseCropZoom = Boolean(imageUri && CropZoomComponent && resolution && !isFetchingResolution);
  const CropZoomView = CropZoomComponent as React.ComponentType<any>;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.root}>
        {canUseCropZoom ? (
          <CropZoomView
            ref={cropRef}
            cropSize={cropSize}
            resolution={resolution}
            OverlayComponent={renderOverlay}
            maxScale={8}
          >
            <Image source={{ uri: imageUri! }} style={styles.imageFill} contentFit="contain" />
          </CropZoomView>
        ) : (
          <View style={styles.loaderWrap}>
            {toolkitAvailable ? (
              <ActivityIndicator color="#fff" size="large" />
            ) : (
              <Text style={styles.fallbackText}>
                Crop toolkit unavailable in current runtime. Original image will be used.
              </Text>
            )}
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
              disabled={isCropping || !imageUri}
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
    paddingHorizontal: 24,
  },
  fallbackText: {
    color: "#fff",
    textAlign: "center",
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
