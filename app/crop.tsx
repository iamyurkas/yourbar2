import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resolveCropResult } from '@/libs/image-cropper';

const MAX_SCALE = 4;
const MIN_SCALE = 1;

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

export default function CropScreen() {
  const params = useLocalSearchParams();
  const requestId = typeof params.requestId === 'string' ? params.requestId : undefined;
  const uri = typeof params.uri === 'string' ? params.uri : undefined;
  const widthParam = typeof params.width === 'string' ? Number(params.width) : undefined;
  const heightParam = typeof params.height === 'string' ? Number(params.height) : undefined;

  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(
    widthParam && heightParam ? { width: widthParam, height: heightParam } : null,
  );
  const [rotation, setRotation] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [displaySize, setDisplaySize] = useState({ width: 1, height: 1 });

  const resolvedRef = useRef(false);
  const { width: screenWidth } = useWindowDimensions();

  const frameSize = useSharedValue(0);
  const displayWidth = useSharedValue(0);
  const displayHeight = useSharedValue(0);
  const baseScale = useSharedValue(1);
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (!uri || !requestId) {
      return;
    }

    return () => {
      if (!resolvedRef.current) {
        resolveCropResult(requestId, null);
      }
    };
  }, [requestId, uri]);

  useEffect(() => {
    if (imageSize || !uri) {
      return;
    }

    Image.getSize(
      uri,
      (width, height) => setImageSize({ width, height }),
      () => {},
    );
  }, [imageSize, uri]);

  useEffect(() => {
    if (!imageSize) {
      return;
    }

    const rotatedWidth = rotation % 180 === 0 ? imageSize.width : imageSize.height;
    const rotatedHeight = rotation % 180 === 0 ? imageSize.height : imageSize.width;
    setDisplaySize({ width: rotatedWidth, height: rotatedHeight });
    displayWidth.value = rotatedWidth;
    displayHeight.value = rotatedHeight;
    if (frameSize.value > 0) {
      baseScale.value = Math.max(frameSize.value / rotatedWidth, frameSize.value / rotatedHeight);
    }
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
  }, [imageSize, rotation, baseScale, displayHeight, displayWidth, frameSize, scale, translateX, translateY]);

  const maxTranslateX = useDerivedValue(() => {
    const renderedWidth = displayWidth.value * baseScale.value * scale.value;
    return Math.max(0, (renderedWidth - frameSize.value) / 2);
  });

  const maxTranslateY = useDerivedValue(() => {
    const renderedHeight = displayHeight.value * baseScale.value * scale.value;
    return Math.max(0, (renderedHeight - frameSize.value) / 2);
  });

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          // no-op
        })
        .onUpdate((event) => {
          translateX.value = clamp(translateX.value + event.changeX, -maxTranslateX.value, maxTranslateX.value);
          translateY.value = clamp(translateY.value + event.changeY, -maxTranslateY.value, maxTranslateY.value);
        }),
    [maxTranslateX, maxTranslateY, translateX, translateY],
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          startScale.value = scale.value;
        })
        .onUpdate((event) => {
          const nextScale = clamp(startScale.value * event.scale, MIN_SCALE, MAX_SCALE);
          scale.value = nextScale;
          translateX.value = clamp(translateX.value, -maxTranslateX.value, maxTranslateX.value);
          translateY.value = clamp(translateY.value, -maxTranslateY.value, maxTranslateY.value);
        }),
    [maxTranslateX, maxTranslateY, scale, startScale, translateX, translateY],
  );

  const composedGesture = useMemo(() => Gesture.Simultaneous(panGesture, pinchGesture), [panGesture, pinchGesture]);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: baseScale.value * scale.value },
      { rotateZ: `${rotation}deg` },
      { scaleX: isFlipped ? -1 : 1 },
    ],
  }));

  const handleLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      const size = event.nativeEvent.layout.width;
      frameSize.value = size;
      if (imageSize) {
        const rotatedWidth = rotation % 180 === 0 ? imageSize.width : imageSize.height;
        const rotatedHeight = rotation % 180 === 0 ? imageSize.height : imageSize.width;
        baseScale.value = Math.max(size / rotatedWidth, size / rotatedHeight);
      }
    },
    [baseScale, frameSize, imageSize, rotation],
  );

  const handleClose = useCallback(() => {
    if (requestId) {
      resolveCropResult(requestId, null);
      resolvedRef.current = true;
    }
    router.back();
  }, [requestId]);

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!uri || !requestId || !imageSize) {
      return;
    }

    if (isProcessing) {
      return;
    }

    setIsProcessing(true);
    try {
      const currentScale = scale.value;
      const currentTranslateX = translateX.value;
      const currentTranslateY = translateY.value;
      const currentBaseScale = baseScale.value;
      const renderedWidth = displayWidth.value * currentBaseScale * currentScale;
      const renderedHeight = displayHeight.value * currentBaseScale * currentScale;
      const size = frameSize.value;
      if (size <= 0) {
        return;
      }

      const offsetX = (size - renderedWidth) / 2 + currentTranslateX;
      const offsetY = (size - renderedHeight) / 2 + currentTranslateY;

      const originX = clamp(-offsetX / (currentBaseScale * currentScale), 0, displayWidth.value);
      const originY = clamp(-offsetY / (currentBaseScale * currentScale), 0, displayHeight.value);
      const cropWidth = clamp(size / (currentBaseScale * currentScale), 0, displayWidth.value - originX);
      const cropHeight = clamp(size / (currentBaseScale * currentScale), 0, displayHeight.value - originY);

      const actions: ImageManipulator.Action[] = [];
      if (rotation !== 0) {
        actions.push({ rotate: rotation });
      }
      if (isFlipped) {
        actions.push({ flip: ImageManipulator.FlipType.Horizontal });
      }
      actions.push({
        crop: {
          originX: Math.round(originX),
          originY: Math.round(originY),
          width: Math.round(cropWidth),
          height: Math.round(cropHeight),
        },
      });

      const result = await ImageManipulator.manipulateAsync(uri, actions, {
        compress: 1,
        format: ImageManipulator.SaveFormat.JPEG,
      });

      resolveCropResult(requestId, result.uri);
      resolvedRef.current = true;
      router.back();
    } finally {
      setIsProcessing(false);
    }
  }, [
    baseScale,
    displayHeight,
    displayWidth,
    frameSize,
    imageSize,
    isFlipped,
    isProcessing,
    requestId,
    rotation,
    scale,
    translateX,
    translateY,
    uri,
  ]);

  if (!uri || !requestId) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <View style={styles.toolbar}>
        <Pressable
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.toolbarButton}
          hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={styles.icon.color} />
        </Pressable>
        <View style={styles.toolbarActions}>
          <Pressable
            onPress={handleRotate}
            accessibilityRole="button"
            accessibilityLabel="Rotate"
            style={styles.toolbarButton}
            hitSlop={8}>
            <MaterialCommunityIcons name="rotate-right" size={24} color={styles.icon.color} />
          </Pressable>
          <Pressable
            onPress={handleFlip}
            accessibilityRole="button"
            accessibilityLabel="Flip"
            style={styles.toolbarButton}
            hitSlop={8}>
            <MaterialCommunityIcons name="flip-horizontal" size={24} color={styles.icon.color} />
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            accessibilityRole="button"
            accessibilityLabel="Crop"
            style={styles.toolbarButton}
            disabled={isProcessing}
            hitSlop={8}>
            <MaterialCommunityIcons name="crop" size={24} color={styles.icon.color} />
          </Pressable>
        </View>
      </View>
      <View style={[styles.cropArea, { width: screenWidth }]} onLayout={handleLayout}>
        <View style={styles.cropFrame}>
          <GestureDetector gesture={composedGesture}>
              <Animated.Image
                source={{ uri }}
                style={[
                  styles.image,
                  {
                    width: displaySize.width,
                    height: displaySize.height,
                  },
                  imageStyle,
                ]}
                resizeMode="cover"
              />
          </GestureDetector>
          <View pointerEvents="none" style={styles.frameOverlay} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0b',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  toolbarButton: {
    padding: 8,
  },
  icon: {
    color: '#f4f4f4',
  },
  cropArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropFrame: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
    backgroundColor: '#0b0b0b',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  frameOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
