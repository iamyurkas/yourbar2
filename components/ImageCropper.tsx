// eslint-disable-next-line import/no-unresolved
import * as ImageManipulator from "expo-image-manipulator";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  clamp,
  clampTranslation,
  CropShape,
  getContainedImageSize,
  getCropSize,
  getMinimumScale,
  ImageDimensions,
  mapCropFrameToImagePixels,
  PreviewLayout,
} from "@/libs/image-crop-utils";

type ImageCropperProps = {
  imageUri: string;
  cropAspectRatio?: number;
  cropShape?: CropShape;
  onCancel: () => void;
  onCropped: (uri: string) => void;
};

const DEFAULT_CROP_ASPECT_RATIO = 1;
const CROP_HORIZONTAL_PADDING = 24;
const MAX_SCALE_MULTIPLIER = 6;

export function ImageCropper({
  imageUri,
  cropAspectRatio = DEFAULT_CROP_ASPECT_RATIO,
  cropShape = "rect",
  onCancel,
  onCropped,
}: ImageCropperProps) {
  const insets = useSafeAreaInsets();
  const [isBusy, setIsBusy] = useState(false);
  const [imageSize, setImageSize] = useState<ImageDimensions | null>(null);
  const [previewSize, setPreviewSize] = useState<PreviewLayout>({ width: 0, height: 0 });

  const containedImage = useMemo(() => {
    if (!imageSize) {
      return { width: 0, height: 0 };
    }

    return getContainedImageSize(imageSize, previewSize);
  }, [imageSize, previewSize]);

  const cropArea = useMemo(
    () => getCropSize(previewSize, cropAspectRatio, CROP_HORIZONTAL_PADDING),
    [previewSize, cropAspectRatio],
  );

  const minScale = useMemo(
    () => getMinimumScale(containedImage, cropArea),
    [containedImage, cropArea],
  );

  const maxScale = useMemo(
    () => Math.max(minScale * MAX_SCALE_MULTIPLIER, minScale),
    [minScale],
  );

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const previewWidth = useSharedValue(0);
  const previewHeight = useSharedValue(0);
  const containedWidth = useSharedValue(0);
  const containedHeight = useSharedValue(0);
  const cropWidth = useSharedValue(0);
  const cropHeight = useSharedValue(0);
  const minScaleShared = useSharedValue(1);
  const maxScaleShared = useSharedValue(6);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const pinchStartX = useSharedValue(0);
  const pinchStartY = useSharedValue(0);
  const pinchFocalOffsetX = useSharedValue(0);
  const pinchFocalOffsetY = useSharedValue(0);

  useEffect(() => {
    let active = true;

    Image.getSize(
      imageUri,
      (width, height) => {
        if (active) {
          setImageSize({ width, height });
        }
      },
      () => {
        if (active) {
          Alert.alert("Image error", "Unable to read image dimensions.");
          onCancel();
        }
      },
    );

    return () => {
      active = false;
    };
  }, [imageUri, onCancel]);

  useEffect(() => {
    previewWidth.value = previewSize.width;
    previewHeight.value = previewSize.height;
    containedWidth.value = containedImage.width;
    containedHeight.value = containedImage.height;
    cropWidth.value = cropArea.width;
    cropHeight.value = cropArea.height;
    minScaleShared.value = minScale;
    maxScaleShared.value = maxScale;

    scale.value = minScale;
    translateX.value = 0;
    translateY.value = 0;
  }, [
    containedHeight,
    containedImage.height,
    containedImage.width,
    containedWidth,
    cropArea.height,
    cropArea.width,
    cropHeight,
    cropWidth,
    maxScale,
    maxScaleShared,
    minScale,
    minScaleShared,
    previewHeight,
    previewSize.height,
    previewSize.width,
    previewWidth,
    scale,
    translateX,
    translateY,
  ]);

  const onPreviewLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPreviewSize({ width, height });
  }, []);

  const resetTransform = useCallback(() => {
    scale.value = minScaleShared.value;
    translateX.value = 0;
    translateY.value = 0;
  }, [minScaleShared, scale, translateX, translateY]);

  const panGesture = Gesture.Pan()
    .enabled(!isBusy)
    .onStart(() => {
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      const next = clampTranslation(
        {
          x: panStartX.value + event.translationX,
          y: panStartY.value + event.translationY,
        },
        scale.value,
        { width: containedWidth.value, height: containedHeight.value },
        { width: cropWidth.value, height: cropHeight.value },
      );

      translateX.value = next.x;
      translateY.value = next.y;
    });

  const pinchGesture = Gesture.Pinch()
    .enabled(!isBusy)
    .onStart((event) => {
      pinchStartScale.value = scale.value;
      pinchStartX.value = translateX.value;
      pinchStartY.value = translateY.value;
      pinchFocalOffsetX.value = event.focalX - previewWidth.value / 2;
      pinchFocalOffsetY.value = event.focalY - previewHeight.value / 2;
    })
    .onUpdate((event) => {
      const startScale = pinchStartScale.value || minScaleShared.value;
      const nextScale = clamp(
        startScale * event.scale,
        minScaleShared.value,
        maxScaleShared.value,
      );

      const scaleRatio = nextScale / startScale;

      const nextX = pinchStartX.value + (1 - scaleRatio) * pinchFocalOffsetX.value;
      const nextY = pinchStartY.value + (1 - scaleRatio) * pinchFocalOffsetY.value;

      const clamped = clampTranslation(
        { x: nextX, y: nextY },
        nextScale,
        { width: containedWidth.value, height: containedHeight.value },
        { width: cropWidth.value, height: cropHeight.value },
      );

      scale.value = nextScale;
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .enabled(!isBusy)
    .onEnd(() => {
      runOnJS(resetTransform)();
    });

  const gesture = Gesture.Simultaneous(panGesture, pinchGesture, doubleTapGesture);

  const imageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const cropFrameStyle = useMemo(() => {
    const frameStyle = {
      width: cropArea.width,
      height: cropArea.height,
      borderRadius: cropShape === "circle" ? cropArea.width / 2 : 16,
    } as const;

    return frameStyle;
  }, [cropArea.height, cropArea.width, cropShape]);

  const canRenderCropper = Boolean(imageSize && containedImage.width > 0 && cropArea.width > 0);

  const handleCrop = useCallback(async () => {
    if (!imageSize || !containedImage.width || !containedImage.height || !cropArea.width || !cropArea.height) {
      return;
    }

    setIsBusy(true);

    try {
      const cropRect = mapCropFrameToImagePixels({
        originalImage: imageSize,
        containedImage,
        cropArea,
        scale: scale.value,
        translateX: translateX.value,
        translateY: translateY.value,
      });

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: cropRect.originX,
              originY: cropRect.originY,
              width: cropRect.width,
              height: cropRect.height,
            },
          },
        ],
        {
          compress: 0.95,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      onCropped(result.uri);
    } catch {
      Alert.alert("Crop failed", "Unable to crop this image. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }, [containedImage, cropArea, imageSize, imageUri, onCropped, scale, translateX, translateY]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.topBar}>
        <Pressable disabled={isBusy} onPress={onCancel} style={styles.buttonGhost}>
          <Text style={styles.buttonGhostText}>Cancel</Text>
        </Pressable>
        <Pressable disabled={isBusy} onPress={resetTransform} style={styles.buttonGhost}>
          <Text style={styles.buttonGhostText}>Reset</Text>
        </Pressable>
      </View>

      <View style={styles.previewContainer} onLayout={onPreviewLayout}>
        {canRenderCropper ? (
          <GestureDetector gesture={gesture}>
            <View style={styles.previewInner}>
              <Animated.Image
                source={{ uri: imageUri }}
                style={[
                  {
                    width: containedImage.width,
                    height: containedImage.height,
                  },
                  imageAnimatedStyle,
                ]}
                resizeMode="contain"
              />

              <View pointerEvents="none" style={styles.overlayContainer}>
                <View style={styles.overlayTop} />
                <View style={styles.overlayMiddleRow}>
                  <View style={styles.overlaySide} />
                  <View style={[styles.cropFrame, cropFrameStyle]} />
                  <View style={styles.overlaySide} />
                </View>
                <View style={styles.overlayBottom} />
              </View>
            </View>
          </GestureDetector>
        ) : (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        )}
      </View>

      <View style={styles.bottomBar}>
        <Pressable
          disabled={isBusy || !canRenderCropper}
          onPress={handleCrop}
          style={({ pressed }) => [
            styles.buttonPrimary,
            (pressed || isBusy || !canRenderCropper) && styles.buttonPrimaryPressed,
          ]}
        >
          <Text style={styles.buttonPrimaryText}>{isBusy ? "Cropping..." : "Crop & Save"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0B0B0B",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  previewContainer: {
    flex: 1,
    overflow: "hidden",
  },
  previewInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "stretch",
    justifyContent: "center",
  },
  overlayTop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  overlayMiddleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  overlaySide: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.62)",
    alignSelf: "stretch",
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  cropFrame: {
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "transparent",
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  buttonGhost: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  buttonGhostText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonPrimary: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  buttonPrimaryPressed: {
    opacity: 0.72,
  },
  buttonPrimaryText: {
    color: "#121212",
    fontSize: 16,
    fontWeight: "700",
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
