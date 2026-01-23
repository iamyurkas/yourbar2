import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { manipulateAsync, FlipType, SaveFormat } from 'expo-image-manipulator';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { cancelCropRequest, resolveCropRequest } from '@/libs/image-cropper';

type ImageSize = {
  width: number;
  height: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const clampWorklet = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

const parseParam = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

export default function CropScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const id = parseParam(params.id) ?? '';
  const uri = parseParam(params.uri);
  const aspectParam = parseParam(params.aspect);
  const aspect = Number.isFinite(Number(aspectParam)) ? Number(aspectParam) : 1;

  const [workingUri, setWorkingUri] = useState<string | null>(uri ?? null);
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const didResolveRef = useRef(false);

  const frameWidth = useSharedValue(0);
  const frameHeight = useSharedValue(0);
  const imageWidth = useSharedValue(0);
  const imageHeight = useSharedValue(0);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  useEffect(() => {
    if (uri) {
      setWorkingUri(uri);
    }
  }, [uri]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      if (!didResolveRef.current && id) {
        cancelCropRequest(id);
      }
    });
    return unsubscribe;
  }, [id, navigation]);

  useEffect(() => {
    if (!workingUri) {
      return;
    }

    Image.getSize(
      workingUri,
      (width, height) => setImageSize({ width, height }),
      () => setImageSize(null),
    );
  }, [workingUri]);

  const cropFrame = useMemo(() => {
    const padding = 24;
    const headerSpace = 140;
    const availableWidth = screenWidth - padding * 2;
    const availableHeight = screenHeight - headerSpace;
    let width = availableWidth;
    let height = width / aspect;

    if (height > availableHeight) {
      height = availableHeight;
      width = height * aspect;
    }

    return {
      width,
      height,
    };
  }, [aspect, screenHeight, screenWidth]);

  const displaySize = useMemo(() => {
    if (!imageSize) {
      return null;
    }

    const imageAspect = imageSize.width / imageSize.height;
    const frameAspect = cropFrame.width / cropFrame.height;
    let width = cropFrame.width;
    let height = cropFrame.height;

    if (imageAspect >= frameAspect) {
      height = cropFrame.height;
      width = height * imageAspect;
    } else {
      width = cropFrame.width;
      height = width / imageAspect;
    }

    return { width, height };
  }, [cropFrame.height, cropFrame.width, imageSize]);

  useEffect(() => {
    frameWidth.value = cropFrame.width;
    frameHeight.value = cropFrame.height;
  }, [cropFrame.height, cropFrame.width, frameHeight, frameWidth]);

  useEffect(() => {
    if (!displaySize) {
      return;
    }

    imageWidth.value = displaySize.width;
    imageHeight.value = displaySize.height;
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
  }, [displaySize, imageHeight, imageWidth, scale, translateX, translateY]);

  const clampTranslation = useCallback(() => {
    'worklet';
    const scaledWidth = imageWidth.value * scale.value;
    const scaledHeight = imageHeight.value * scale.value;
    const boundX = Math.max(0, (scaledWidth - frameWidth.value) / 2);
    const boundY = Math.max(0, (scaledHeight - frameHeight.value) / 2);
    translateX.value = clampWorklet(translateX.value, -boundX, boundX);
    translateY.value = clampWorklet(translateY.value, -boundY, boundY);
  }, [frameHeight, frameWidth, imageHeight, imageWidth, scale, translateX, translateY]);

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = clampWorklet(startScale.value * event.scale, 1, 4);
    })
    .onEnd(() => {
      clampTranslation();
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    })
    .onEnd(() => {
      clampTranslation();
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleBack = useCallback(() => {
    if (id) {
      cancelCropRequest(id);
    }
    router.back();
  }, [id, router]);

  const handleRotate = useCallback(async () => {
    if (!workingUri || isProcessing) {
      return;
    }

    try {
      setIsProcessing(true);
      const result = await manipulateAsync(workingUri, [{ rotate: 90 }], {
        compress: 1,
        format: SaveFormat.JPEG,
      });
      setWorkingUri(result.uri);
      setImageSize({ width: result.width, height: result.height });
    } catch (error) {
      console.warn('Failed to rotate image', error);
      Alert.alert('Could not rotate', 'Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, workingUri]);

  const handleFlip = useCallback(async () => {
    if (!workingUri || isProcessing) {
      return;
    }

    try {
      setIsProcessing(true);
      const result = await manipulateAsync(workingUri, [{ flip: FlipType.Horizontal }], {
        compress: 1,
        format: SaveFormat.JPEG,
      });
      setWorkingUri(result.uri);
      setImageSize({ width: result.width, height: result.height });
    } catch (error) {
      console.warn('Failed to flip image', error);
      Alert.alert('Could not flip', 'Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, workingUri]);

  const handleConfirm = useCallback(async () => {
    if (!workingUri || !imageSize || !displaySize || isProcessing) {
      return;
    }

    try {
      setIsProcessing(true);
      const scaleValue = scale.value;
      const translateXValue = translateX.value;
      const translateYValue = translateY.value;
      const scaledWidth = displaySize.width * scaleValue;
      const scaledHeight = displaySize.height * scaleValue;
      const offsetX = (cropFrame.width - scaledWidth) / 2 + translateXValue;
      const offsetY = (cropFrame.height - scaledHeight) / 2 + translateYValue;
      const ratioX = imageSize.width / scaledWidth;
      const ratioY = imageSize.height / scaledHeight;
      const rawCropX = -offsetX * ratioX;
      const rawCropY = -offsetY * ratioY;
      const rawCropWidth = cropFrame.width * ratioX;
      const rawCropHeight = cropFrame.height * ratioY;
      const cropWidth = clamp(rawCropWidth, 0, imageSize.width);
      const cropHeight = clamp(rawCropHeight, 0, imageSize.height);
      const cropX = clamp(rawCropX, 0, imageSize.width - cropWidth);
      const cropY = clamp(rawCropY, 0, imageSize.height - cropHeight);

      const result = await manipulateAsync(
        workingUri,
        [
          {
            crop: {
              originX: Math.round(cropX),
              originY: Math.round(cropY),
              width: Math.round(cropWidth),
              height: Math.round(cropHeight),
            },
          },
        ],
        { compress: 1, format: SaveFormat.JPEG },
      );

      if (id) {
        resolveCropRequest(id, { uri: result.uri, width: result.width, height: result.height });
      }
      didResolveRef.current = true;

      router.back();
    } catch (error) {
      console.warn('Failed to crop image', error);
      Alert.alert('Could not crop', 'Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [cropFrame.height, cropFrame.width, displaySize, id, imageSize, isProcessing, router, workingUri]);

  if (!workingUri || !displaySize) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <StatusBar style="light" />
        <ActivityIndicator color={Colors.tint} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={handleBack}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.onSurface} />
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rotate"
            onPress={handleRotate}
            disabled={isProcessing}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
            <MaterialCommunityIcons name="rotate-right" size={24} color={Colors.onSurface} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Flip"
            onPress={handleFlip}
            disabled={isProcessing}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
            <MaterialCommunityIcons name="flip-horizontal" size={24} color={Colors.onSurface} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirm crop"
            onPress={handleConfirm}
            disabled={isProcessing}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
            <MaterialCommunityIcons name="crop" size={24} color={Colors.onSurface} />
          </Pressable>
        </View>
      </View>
      <View style={styles.cropArea}>
        <View style={[styles.cropFrame, { width: cropFrame.width, height: cropFrame.height }]}>
          <GestureDetector gesture={composedGesture}>
            <Animated.View style={[styles.imageWrapper, imageStyle]}>
              <Image
                source={{ uri: workingUri }}
                style={{ width: displaySize.width, height: displaySize.height }}
                resizeMode="cover"
              />
            </Animated.View>
          </GestureDetector>
        </View>
        <View
          pointerEvents="none"
          style={[styles.cropOverlay, { width: cropFrame.width, height: cropFrame.height }]}
        />
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerHint}>Drag and zoom to adjust</Text>
        {isProcessing ? <ActivityIndicator color={Colors.tint} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconButtonPressed: {
    opacity: 0.7,
  },
  cropArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropFrame: {
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  imageWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropOverlay: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: Colors.tint,
    borderRadius: 12,
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  footerHint: {
    color: Colors.onSurface,
    fontSize: 14,
  },
});
