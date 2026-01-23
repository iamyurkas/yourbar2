import { MaterialIcons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cancelCropRequest, resolveCropRequest } from '@/libs/image-cropper';

const TOP_BAR_HEIGHT = 56;
const CONTROL_SIZE = 36;
const MAX_SCALE = 5;

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

export default function CropScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const params = useLocalSearchParams<{
    requestId?: string;
    uri?: string;
    aspect?: string;
  }>();
  const requestId = useMemo(() => {
    const value = Array.isArray(params.requestId) ? params.requestId[0] : params.requestId;
    return typeof value === 'string' ? value : '';
  }, [params.requestId]);
  const initialUri = useMemo(() => {
    const value = Array.isArray(params.uri) ? params.uri[0] : params.uri;
    return typeof value === 'string' ? value : '';
  }, [params.uri]);
  const aspect = useMemo(() => {
    const value = Array.isArray(params.aspect) ? params.aspect[0] : params.aspect;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }, [params.aspect]);

  const [imageUri, setImageUri] = useState(initialUri);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const resolvedRef = useRef(false);

  const scale = useSharedValue(1);
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const baseWidth = useSharedValue(0);
  const baseHeight = useSharedValue(0);
  const cropWidth = useSharedValue(0);
  const cropHeight = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const cropFrame = useMemo(() => {
    const availableHeight = Math.max(
      0,
      windowHeight - insets.top - insets.bottom - TOP_BAR_HEIGHT - 32,
    );
    let frameWidth = Math.min(windowWidth, availableHeight * aspect);
    let frameHeight = frameWidth / aspect;

    if (frameHeight > availableHeight) {
      frameHeight = availableHeight;
      frameWidth = frameHeight * aspect;
    }

    return { width: frameWidth, height: frameHeight };
  }, [aspect, insets.bottom, insets.top, windowHeight, windowWidth]);

  const baseScale = useMemo(() => {
    if (!imageSize.width || !imageSize.height || !cropFrame.width || !cropFrame.height) {
      return 1;
    }
    return Math.max(cropFrame.width / imageSize.width, cropFrame.height / imageSize.height);
  }, [cropFrame.height, cropFrame.width, imageSize.height, imageSize.width]);

  const baseDisplay = useMemo(() => {
    return {
      width: imageSize.width * baseScale,
      height: imageSize.height * baseScale,
    };
  }, [baseScale, imageSize.height, imageSize.width]);

  useEffect(() => {
    if (!imageUri) {
      return;
    }

    Image.getSize(
      imageUri,
      (width, height) => {
        setImageSize({ width, height });
      },
      () => {
        Alert.alert('Unable to load image', 'Please try another photo.');
      },
    );
  }, [imageUri]);

  useEffect(() => {
    baseWidth.value = baseDisplay.width;
    baseHeight.value = baseDisplay.height;
    cropWidth.value = cropFrame.width;
    cropHeight.value = cropFrame.height;
    scale.value = 1;
    translationX.value = 0;
    translationY.value = 0;
  }, [
    baseDisplay.height,
    baseDisplay.width,
    baseHeight,
    baseWidth,
    cropFrame.height,
    cropFrame.width,
    cropHeight,
    cropWidth,
    scale,
    translationX,
    translationY,
  ]);

  const maxOffsetX = useDerivedValue(() => {
    return Math.max(0, (baseWidth.value * scale.value - cropWidth.value) / 2);
  });
  const maxOffsetY = useDerivedValue(() => {
    return Math.max(0, (baseHeight.value * scale.value - cropHeight.value) / 2);
  });

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          startX.value = translationX.value;
          startY.value = translationY.value;
        })
        .onUpdate((event) => {
          translationX.value = clamp(
            startX.value + event.translationX,
            -maxOffsetX.value,
            maxOffsetX.value,
          );
          translationY.value = clamp(
            startY.value + event.translationY,
            -maxOffsetY.value,
            maxOffsetY.value,
          );
        }),
    [maxOffsetX, maxOffsetY, startX, startY, translationX, translationY],
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          startScale.value = scale.value;
        })
        .onUpdate((event) => {
          const nextScale = clamp(startScale.value * event.scale, 1, MAX_SCALE);
          scale.value = nextScale;

          const nextMaxX = Math.max(0, (baseWidth.value * nextScale - cropWidth.value) / 2);
          const nextMaxY = Math.max(0, (baseHeight.value * nextScale - cropHeight.value) / 2);
          translationX.value = clamp(translationX.value, -nextMaxX, nextMaxX);
          translationY.value = clamp(translationY.value, -nextMaxY, nextMaxY);
        }),
    [
      baseHeight,
      baseWidth,
      cropHeight,
      cropWidth,
      scale,
      startScale,
      translationX,
      translationY,
    ],
  );

  const gesture = useMemo(
    () => Gesture.Simultaneous(panGesture, pinchGesture),
    [panGesture, pinchGesture],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translationX.value },
      { translateY: translationY.value },
      { scale: scale.value },
    ],
  }));

  const handleCancel = useCallback(() => {
    if (!requestId) {
      router.back();
      return;
    }

    resolvedRef.current = true;
    cancelCropRequest(requestId);
    router.back();
  }, [requestId, router]);

  const handleRotate = useCallback(async () => {
    if (!imageUri || isProcessing) {
      return;
    }

    setIsProcessing(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ rotate: 90 }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
      );
      setImageUri(result.uri);
      setImageSize({ width: result.width, height: result.height });
    } catch (error) {
      Alert.alert('Unable to rotate', 'Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [imageUri, isProcessing]);

  const handleFlip = useCallback(async () => {
    if (!imageUri || isProcessing) {
      return;
    }

    setIsProcessing(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ flip: ImageManipulator.FlipType.Horizontal }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
      );
      setImageUri(result.uri);
      setImageSize({ width: result.width, height: result.height });
    } catch (error) {
      Alert.alert('Unable to flip', 'Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [imageUri, isProcessing]);

  const handleConfirm = useCallback(async () => {
    if (!imageUri || !requestId || !imageSize.width || !imageSize.height || isProcessing) {
      return;
    }

    setIsProcessing(true);
    try {
      const totalScale = baseScale * scale.value;
      const cropWidthValue = cropFrame.width / totalScale;
      const cropHeightValue = cropFrame.height / totalScale;
      const originX =
        imageSize.width / 2 -
        cropWidthValue / 2 -
        translationX.value / totalScale;
      const originY =
        imageSize.height / 2 -
        cropHeightValue / 2 -
        translationY.value / totalScale;

      const clampedOriginX = Math.max(0, Math.min(originX, imageSize.width - cropWidthValue));
      const clampedOriginY = Math.max(0, Math.min(originY, imageSize.height - cropHeightValue));

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: clampedOriginX,
              originY: clampedOriginY,
              width: cropWidthValue,
              height: cropHeightValue,
            },
          },
        ],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
      );

      resolvedRef.current = true;
      resolveCropRequest(requestId, result.uri);
      router.back();
    } catch (error) {
      Alert.alert('Unable to crop', 'Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [
    baseScale,
    cropFrame.height,
    cropFrame.width,
    imageSize.height,
    imageSize.width,
    imageUri,
    isProcessing,
    requestId,
    router,
    scale,
    translationX,
    translationY,
  ]);

  useEffect(() => {
    return () => {
      if (!resolvedRef.current && requestId) {
        cancelCropRequest(requestId);
      }
    };
  }, [requestId]);

  const isReady = Boolean(imageUri && imageSize.width && imageSize.height);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          onPress={handleCancel}
          style={styles.iconButton}
        >
          <MaterialIcons name="arrow-back" size={CONTROL_SIZE} color="#fff" />
        </TouchableOpacity>
        <View style={styles.topActions}>
          <TouchableOpacity
            accessibilityLabel="Rotate"
            onPress={handleRotate}
            style={styles.iconButton}
          >
            <MaterialIcons name="rotate-right" size={CONTROL_SIZE} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Flip"
            onPress={handleFlip}
            style={styles.iconButton}
          >
            <MaterialIcons name="flip" size={CONTROL_SIZE} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Crop"
            onPress={handleConfirm}
            style={styles.iconButton}
          >
            <MaterialIcons name="crop" size={CONTROL_SIZE} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.content}>
        <View
          style={[
            styles.cropFrame,
            { width: cropFrame.width, height: cropFrame.height },
          ]}
        >
          {isReady ? (
            <GestureDetector gesture={gesture}>
              <Animated.Image
                source={{ uri: imageUri }}
                style={[
                  styles.image,
                  { width: baseDisplay.width, height: baseDisplay.height },
                  animatedStyle,
                ]}
                resizeMode="cover"
              />
            </GestureDetector>
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.loadingText}>Loading image…</Text>
            </View>
          )}
          {isProcessing ? (
            <View style={styles.processingOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : null}
        </View>
        <Text style={styles.helperText}>Pinch to zoom and drag to reposition.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0b',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: TOP_BAR_HEIGHT,
    backgroundColor: '#0b0b0b',
  },
  topActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: CONTROL_SIZE + 8,
    height: CONTROL_SIZE + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  cropFrame: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    position: 'absolute',
  },
  helperText: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
});
