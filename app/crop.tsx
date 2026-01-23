import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FlipType, manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildCropReturnParams, getParamValue } from '@/libs/crop-image';

const MAX_SCALE_MULTIPLIER = 4;
const TOOLBAR_HEIGHT = 56;

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

export default function CropScreen() {
  const params = useLocalSearchParams();
  const sourceUri = getParamValue(params.sourceUri);
  const aspectParam = getParamValue(params.aspect);
  const returnToPath = getParamValue(params.returnToPath);
  const returnToParams = getParamValue(params.returnToParams);

  const parsedAspect = Number(aspectParam);
  const aspect = Number.isFinite(parsedAspect) && parsedAspect > 0 ? parsedAspect : 1;

  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [currentUri, setCurrentUri] = useState(sourceUri);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [frameSize, setFrameSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const baseScale = useSharedValue(1);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStart = useSharedValue(1);
  const imageWidth = useSharedValue(0);
  const imageHeight = useSharedValue(0);
  const frameWidth = useSharedValue(0);
  const frameHeight = useSharedValue(0);

  useEffect(() => {
    if (!currentUri) {
      return;
    }

    Image.getSize(
      currentUri,
      (width, height) => {
        setImageSize({ width, height });
      },
      () => {
        setImageSize(null);
      },
    );
  }, [currentUri]);

  useEffect(() => {
    if (!imageSize) {
      return;
    }

    imageWidth.value = imageSize.width;
    imageHeight.value = imageSize.height;
  }, [imageHeight, imageSize, imageWidth]);

  useEffect(() => {
    frameWidth.value = frameSize.width;
    frameHeight.value = frameSize.height;
  }, [frameHeight, frameSize, frameWidth]);

  useEffect(() => {
    if (!imageSize || frameSize.width === 0 || frameSize.height === 0) {
      return;
    }

    const nextBase = Math.max(
      frameSize.width / imageSize.width,
      frameSize.height / imageSize.height,
    );
    baseScale.value = nextBase;
    scale.value = nextBase;
    translateX.value = 0;
    translateY.value = 0;
  }, [baseScale, frameSize, imageSize, scale, translateX, translateY]);

  const cropFrame = useMemo(() => {
    const availableHeight =
      windowHeight - insets.top - insets.bottom - TOOLBAR_HEIGHT * 2;
    let frameWidthValue = Math.min(windowWidth, availableHeight);
    let frameHeightValue = frameWidthValue / aspect;

    if (frameHeightValue > availableHeight) {
      frameHeightValue = availableHeight;
      frameWidthValue = frameHeightValue * aspect;
    }

    return {
      width: Math.max(0, frameWidthValue),
      height: Math.max(0, frameHeightValue),
    };
  }, [aspect, insets.bottom, insets.top, windowHeight, windowWidth]);

  const handleLayoutFrame = useCallback((event: LayoutChangeEvent) => {
    setFrameSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height });
  }, []);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          panStartX.value = translateX.value;
          panStartY.value = translateY.value;
        })
        .onUpdate((event) => {
          const scaledWidth = imageWidth.value * scale.value;
          const scaledHeight = imageHeight.value * scale.value;
          const maxX = Math.max(0, (scaledWidth - frameWidth.value) / 2);
          const maxY = Math.max(0, (scaledHeight - frameHeight.value) / 2);

          translateX.value = clamp(
            panStartX.value + event.translationX,
            -maxX,
            maxX,
          );
          translateY.value = clamp(
            panStartY.value + event.translationY,
            -maxY,
            maxY,
          );
        }),
    [
      frameHeight,
      frameWidth,
      imageHeight,
      imageWidth,
      panStartX,
      panStartY,
      scale,
      translateX,
      translateY,
    ],
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          pinchStart.value = scale.value;
        })
        .onUpdate((event) => {
          const nextScale = clamp(
            pinchStart.value * event.scale,
            baseScale.value,
            baseScale.value * MAX_SCALE_MULTIPLIER,
          );
          scale.value = nextScale;

          const scaledWidth = imageWidth.value * nextScale;
          const scaledHeight = imageHeight.value * nextScale;
          const maxX = Math.max(0, (scaledWidth - frameWidth.value) / 2);
          const maxY = Math.max(0, (scaledHeight - frameHeight.value) / 2);

          translateX.value = clamp(translateX.value, -maxX, maxX);
          translateY.value = clamp(translateY.value, -maxY, maxY);
        }),
    [
      baseScale,
      frameHeight,
      frameWidth,
      imageHeight,
      imageWidth,
      pinchStart,
      scale,
      translateX,
      translateY,
    ],
  );

  const composedGesture = useMemo(
    () => Gesture.Simultaneous(panGesture, pinchGesture),
    [panGesture, pinchGesture],
  );

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  const handleTransform = useCallback(
    async (action: 'rotate' | 'flip') => {
      if (!currentUri || isProcessing) {
        return;
      }

      setIsProcessing(true);
      try {
        const result = await manipulateAsync(
          currentUri,
          [
            action === 'rotate'
              ? { rotate: 90 }
              : { flip: FlipType.Horizontal },
          ],
          { compress: 1, format: SaveFormat.JPEG },
        );
        setCurrentUri(result.uri);
        setImageSize({ width: result.width, height: result.height });
      } finally {
        setIsProcessing(false);
      }
    },
    [currentUri, isProcessing],
  );

  const handleConfirm = useCallback(async () => {
    if (!currentUri || !imageSize || frameSize.width === 0 || frameSize.height === 0) {
      return;
    }

    setIsProcessing(true);
    try {
      const scaleValue = scale.value;
      const scaledWidth = imageSize.width * scaleValue;
      const scaledHeight = imageSize.height * scaleValue;
      const imageLeft = (frameSize.width - scaledWidth) / 2 + translateX.value;
      const imageTop = (frameSize.height - scaledHeight) / 2 + translateY.value;

      const cropWidth = frameSize.width / scaleValue;
      const cropHeight = frameSize.height / scaleValue;
      const originX = Math.round(
        clamp(-imageLeft / scaleValue, 0, imageSize.width - cropWidth),
      );
      const originY = Math.round(
        clamp(-imageTop / scaleValue, 0, imageSize.height - cropHeight),
      );

      const result = await manipulateAsync(
        currentUri,
        [
          {
            crop: {
              originX,
              originY,
              width: Math.round(cropWidth),
              height: Math.round(cropHeight),
            },
          },
        ],
        { compress: 1, format: SaveFormat.JPEG },
      );

      if (returnToPath) {
        router.navigate({
          pathname: returnToPath,
          params: buildCropReturnParams(returnToParams, {
            uri: result.uri,
            width: result.width,
            height: result.height,
          }),
        });
      } else {
        router.back();
      }
    } finally {
      setIsProcessing(false);
    }
  }, [currentUri, frameSize, imageSize, returnToParams, returnToPath, scale, translateX, translateY]);

  const showMissingImage = !currentUri;
  const showLoading = !imageSize;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      <View style={[styles.toolbar, { paddingTop: insets.top }]}>
        <Pressable
          accessibilityRole="button"
          onPress={handleBack}
          style={styles.toolbarButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <View style={styles.toolbarActions}>
          <Pressable
            accessibilityRole="button"
            disabled={isProcessing}
            onPress={() => handleTransform('rotate')}
            style={styles.toolbarButton}
          >
            <MaterialCommunityIcons name="rotate-right" size={24} color="#fff" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isProcessing}
            onPress={() => handleTransform('flip')}
            style={styles.toolbarButton}
          >
            <MaterialCommunityIcons name="flip-horizontal" size={24} color="#fff" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isProcessing}
            onPress={handleConfirm}
            style={styles.toolbarButton}
          >
            <MaterialCommunityIcons name="check" size={26} color="#fff" />
          </Pressable>
        </View>
      </View>
      <View style={styles.content}>
        <View
          style={[styles.cropFrame, { width: cropFrame.width, height: cropFrame.height }]}
          onLayout={handleLayoutFrame}
        >
          {showMissingImage ? (
            <Text style={styles.errorText}>Image not found.</Text>
          ) : showLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <GestureDetector gesture={composedGesture}>
              <Animated.Image
                source={{ uri: currentUri }}
                style={[styles.image, imageStyle]}
                resizeMode="cover"
              />
            </GestureDetector>
          )}
        </View>
        <View style={[styles.overlay, { width: cropFrame.width, height: cropFrame.height }]} />
      </View>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Text style={styles.footerText}>Drag to reposition · Pinch to zoom</Text>
      </View>
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#111',
  },
  toolbar: {
    height: TOOLBAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolbarButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropFrame: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  footer: {
    height: TOOLBAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    color: '#fff',
    fontSize: 14,
  },
  errorText: {
    color: '#fff',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
