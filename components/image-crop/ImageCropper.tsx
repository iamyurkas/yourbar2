import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { useAppColors } from '@/constants/theme';
import { CropOverlay } from '@/components/image-crop/CropOverlay';
import {
  clamp,
  computeCropRectInImagePixels,
  getInitialBaseScale,
  getMaxTranslation,
} from '@/libs/image-crop/cropMath';
import type { ImageCropResult } from '@/libs/image-crop/types';

type ImageCropperProps = {
  imageUri: string;
  aspectRatio?: number;
  minUserScale?: number;
  maxUserScale?: number;
  initialImageWidth?: number;
  initialImageHeight?: number;
  onCancel: () => void;
  onSave: (result: ImageCropResult) => void;
};

const DEFAULT_ASPECT_RATIO = 1;
const FRAME_HORIZONTAL_PADDING = 24;

export function ImageCropper({
  imageUri,
  aspectRatio = DEFAULT_ASPECT_RATIO,
  minUserScale = 1,
  maxUserScale = 6,
  initialImageWidth,
  initialImageHeight,
  onCancel,
  onSave,
}: ImageCropperProps) {
  const Colors = useAppColors();
  const [isSaving, setIsSaving] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(
    initialImageWidth && initialImageHeight
      ? { width: initialImageWidth, height: initialImageHeight }
      : null,
  );

  useEffect(() => {
    if (imageSize) {
      return;
    }

    let isMounted = true;
    Image.getSize(
      imageUri,
      (width, height) => {
        if (!isMounted) {
          return;
        }
        setImageSize({ width, height });
      },
      () => {
        if (isMounted) {
          setImageSize({ width: 1, height: 1 });
        }
      },
    );

    return () => {
      isMounted = false;
    };
  }, [imageSize, imageUri]);

  const cropFrame = useMemo(() => {
    const safeAspect = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : DEFAULT_ASPECT_RATIO;
    const maxWidth = Math.max(1, containerWidth - FRAME_HORIZONTAL_PADDING * 2);
    const maxHeight = Math.max(1, containerHeight - FRAME_HORIZONTAL_PADDING * 2);

    let width = maxWidth;
    let height = width / safeAspect;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * safeAspect;
    }

    return {
      width,
      height,
    };
  }, [aspectRatio, containerHeight, containerWidth]);

  const baseScale = useMemo(() => {
    if (!imageSize) {
      return 1;
    }

    return getInitialBaseScale({
      imageWidth: imageSize.width,
      imageHeight: imageSize.height,
      cropFrameWidth: cropFrame.width,
      cropFrameHeight: cropFrame.height,
    });
  }, [cropFrame.height, cropFrame.width, imageSize]);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const pinchStartTranslateX = useSharedValue(0);
  const pinchStartTranslateY = useSharedValue(0);
  const panStartTranslateX = useSharedValue(0);
  const panStartTranslateY = useSharedValue(0);
  const frameWidthSV = useSharedValue(0);
  const frameHeightSV = useSharedValue(0);
  const imageWidthSV = useSharedValue(1);
  const imageHeightSV = useSharedValue(1);
  const baseScaleSV = useSharedValue(1);

  useEffect(() => {
    frameWidthSV.value = cropFrame.width;
    frameHeightSV.value = cropFrame.height;
    if (imageSize) {
      imageWidthSV.value = imageSize.width;
      imageHeightSV.value = imageSize.height;
    }
    baseScaleSV.value = baseScale;
  }, [baseScale, baseScaleSV, cropFrame.height, cropFrame.width, frameHeightSV, frameWidthSV, imageHeightSV, imageSize, imageWidthSV]);

  const clampCurrentTranslation = useCallback(() => {
    const limits = getMaxTranslation({
      imageWidth: imageWidthSV.value,
      imageHeight: imageHeightSV.value,
      baseScale: baseScaleSV.value,
      userScale: scale.value,
      cropFrameWidth: frameWidthSV.value,
      cropFrameHeight: frameHeightSV.value,
    });

    translateX.value = clamp(translateX.value, -limits.maxX, limits.maxX);
    translateY.value = clamp(translateY.value, -limits.maxY, limits.maxY);
  }, [baseScaleSV, frameHeightSV, frameWidthSV, imageHeightSV, imageWidthSV, scale, translateX, translateY]);

  useEffect(() => {
    clampCurrentTranslation();
  }, [baseScale, clampCurrentTranslation, cropFrame.height, cropFrame.width, imageSize]);

  const panGesture = useMemo(
    () => Gesture.Pan()
      .onStart(() => {
        panStartTranslateX.value = translateX.value;
        panStartTranslateY.value = translateY.value;
      })
      .onUpdate((event) => {
        const limits = getMaxTranslation({
          imageWidth: imageWidthSV.value,
          imageHeight: imageHeightSV.value,
          baseScale: baseScaleSV.value,
          userScale: scale.value,
          cropFrameWidth: frameWidthSV.value,
          cropFrameHeight: frameHeightSV.value,
        });

        translateX.value = clamp(panStartTranslateX.value + event.translationX, -limits.maxX, limits.maxX);
        translateY.value = clamp(panStartTranslateY.value + event.translationY, -limits.maxY, limits.maxY);
      }),
    [
      baseScaleSV,
      frameHeightSV,
      frameWidthSV,
      imageHeightSV,
      imageWidthSV,
      panStartTranslateX,
      panStartTranslateY,
      scale,
      translateX,
      translateY,
    ],
  );

  const pinchGesture = useMemo(
    () => Gesture.Pinch()
      .onStart(() => {
        pinchStartScale.value = scale.value;
        pinchStartTranslateX.value = translateX.value;
        pinchStartTranslateY.value = translateY.value;
      })
      .onUpdate((event) => {
        const nextScale = clamp(pinchStartScale.value * event.scale, minUserScale, maxUserScale);

        const containerCenterX = containerWidth / 2;
        const containerCenterY = containerHeight / 2;
        const focalX = event.focalX - containerCenterX;
        const focalY = event.focalY - containerCenterY;
        const ratio = nextScale / pinchStartScale.value;

        // Keep the pixel under pinch focal point stable while zooming.
        const translatedX = focalX + (pinchStartTranslateX.value - focalX) * ratio;
        const translatedY = focalY + (pinchStartTranslateY.value - focalY) * ratio;

        const limits = getMaxTranslation({
          imageWidth: imageWidthSV.value,
          imageHeight: imageHeightSV.value,
          baseScale: baseScaleSV.value,
          userScale: nextScale,
          cropFrameWidth: frameWidthSV.value,
          cropFrameHeight: frameHeightSV.value,
        });

        scale.value = nextScale;
        translateX.value = clamp(translatedX, -limits.maxX, limits.maxX);
        translateY.value = clamp(translatedY, -limits.maxY, limits.maxY);
      }),
    [
      baseScaleSV,
      containerHeight,
      containerWidth,
      frameHeightSV,
      frameWidthSV,
      imageHeightSV,
      imageWidthSV,
      maxUserScale,
      minUserScale,
      pinchStartScale,
      pinchStartTranslateX,
      pinchStartTranslateY,
      scale,
      translateX,
      translateY,
    ],
  );

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const animatedImageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    };
  }, [translateX, translateY]);

  const animatedScaleStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value * baseScaleSV.value },
      ],
    };
  }, [baseScaleSV, scale]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerWidth(width);
    setContainerHeight(height);
  }, []);

  const finishSave = useCallback((result: ImageCropResult) => {
    setIsSaving(false);
    onSave(result);
  }, [onSave]);

  const failSave = useCallback(() => {
    setIsSaving(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!imageSize || containerWidth <= 0 || containerHeight <= 0 || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      // eslint-disable-next-line import/no-unresolved
      const ImageManipulator = await import('expo-image-manipulator');
      const cropRectPx = computeCropRectInImagePixels({
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
        containerWidth,
        containerHeight,
        cropFrameWidth: cropFrame.width,
        cropFrameHeight: cropFrame.height,
        baseScale,
        userScale: scale.value,
        translateX: translateX.value,
        translateY: translateY.value,
      });

      const manipulated = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: cropRectPx,
          },
        ],
        {
          compress: 1,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      finishSave({
        uri: manipulated.uri,
        width: manipulated.width,
        height: manipulated.height,
        metadata: {
          cropRectPx,
          imageWidth: imageSize.width,
          imageHeight: imageSize.height,
          containerWidth,
          containerHeight,
          cropFrameWidth: cropFrame.width,
          cropFrameHeight: cropFrame.height,
          baseScale,
          userScale: scale.value,
          translateX: translateX.value,
          translateY: translateY.value,
        },
      });
    } catch (error) {
      console.warn('Failed to crop image', error);
      failSave();
    }
  }, [
    baseScale,
    containerHeight,
    containerWidth,
    cropFrame.height,
    cropFrame.width,
    failSave,
    finishSave,
    imageSize,
    imageUri,
    isSaving,
    scale,
    translateX,
    translateY,
  ]);

  if (!imageSize) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.actionButton}>
          <Text style={[styles.actionText, { color: Colors.text }]}>{'Cancel'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isSaving}
          onPress={() => {
            void handleSave();
          }}
          style={styles.actionButton}
        >
          <Text style={[styles.actionText, { color: Colors.primary }]}>{isSaving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </View>

      <View onLayout={handleLayout} style={styles.cropAreaContainer}>
        {containerWidth > 0 && containerHeight > 0 ? (
          <GestureDetector gesture={composedGesture}>
            <Animated.View style={[styles.imageLayer, animatedImageStyle]}>
              <Animated.View style={animatedScaleStyle}>
                <Animated.Image
                  source={{ uri: imageUri }}
                  style={{
                    width: imageSize.width,
                    height: imageSize.height,
                  }}
                  resizeMode="contain"
                />
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        ) : null}

        <CropOverlay frameWidth={cropFrame.width} frameHeight={cropFrame.height} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButton: {
    minWidth: 72,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 17,
    fontWeight: '600',
  },
  cropAreaContainer: {
    flex: 1,
  },
  imageLayer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
