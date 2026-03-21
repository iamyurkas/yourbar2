import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { useAppColors } from '@/constants/theme';
import { useI18n } from '@/libs/i18n/use-i18n';

type ImageCropperModalProps = {
  visible: boolean;
  uri: string | null;
  onCancel: () => void;
  onApply: (uri: string) => void;
};

const MIN_CROP_SIZE = 140;

export function ImageCropperModal({ visible, uri, onCancel, onApply }: ImageCropperModalProps) {
  const Colors = useAppColors();
  const { t } = useI18n();
  const cropRef = useRef<any>(null);
  const { width, height } = useWindowDimensions();
  const [cropRatio, setCropRatio] = useState({ width: 0.82, height: 0.62 });
  const [isApplying, setIsApplying] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const zoomToolkit = require('react-native-zoom-toolkit') as any;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ImageManipulator = require('expo-image-manipulator') as any;
  const { CropZoom, useImageResolution } = zoomToolkit;
  const { resolution, isFetching } = useImageResolution(uri ? { uri } : undefined);

  const cropSize = useMemo(() => {
    const maxWidth = Math.max(MIN_CROP_SIZE, width - 36);
    const maxHeight = Math.max(MIN_CROP_SIZE, height * 0.58);
    return {
      width: Math.max(MIN_CROP_SIZE, maxWidth * cropRatio.width),
      height: Math.max(MIN_CROP_SIZE, maxHeight * cropRatio.height),
    };
  }, [cropRatio.height, cropRatio.width, height, width]);

  const adjustCrop = useCallback((axis: 'width' | 'height', delta: number) => {
    setCropRatio((prev) => {
      const next = { ...prev };
      next[axis] = Math.max(0.35, Math.min(0.95, next[axis] + delta));
      return next;
    });
  }, []);

  const handleApply = useCallback(async () => {
    if (!uri || isApplying) {
      return;
    }

    try {
      setIsApplying(true);
      const cropResult = cropRef.current?.crop();
      if (!cropResult || !(cropResult as { crop?: unknown }).crop) {
        onApply(uri);
        return;
      }

      const context = ImageManipulator.manipulate(uri);
      const typedResult = cropResult as {
        rotate?: number;
        resize?: { width: number; height: number };
        crop: { originX: number; originY: number; width: number; height: number };
      };

      if (typeof typedResult.rotate === 'number' && Number.isFinite(typedResult.rotate)) {
        context.rotate(typedResult.rotate);
      }
      context.crop(typedResult.crop);
      if (typedResult.resize) {
        context.resize(typedResult.resize);
      }

      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({
        compress: 1,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      onApply(saved.uri);
    } catch (error) {
      console.warn('Failed to crop image', error);
      onApply(uri);
    } finally {
      setIsApplying(false);
    }
  }, [isApplying, onApply, uri]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onCancel}>
      <View style={[styles.root, { backgroundColor: Colors.surface }]}>
        <View style={[styles.header, { borderBottomColor: Colors.outlineVariant }]}> 
          <Pressable onPress={onCancel} style={styles.headerButton} accessibilityRole="button">
            <MaterialCommunityIcons name="close" size={24} color={Colors.onSurface} />
            <Text style={[styles.headerLabel, { color: Colors.onSurface }]}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable onPress={handleApply} style={styles.headerButton} accessibilityRole="button" disabled={isApplying}>
            {isApplying ? (
              <ActivityIndicator size="small" color={Colors.tint} />
            ) : (
              <MaterialCommunityIcons name="content-save-outline" size={22} color={Colors.tint} />
            )}
            <Text style={[styles.headerLabel, { color: Colors.tint }]}>{t('common.save')}</Text>
          </Pressable>
        </View>

        <View style={styles.cropArea}>
          {uri && resolution && !isFetching ? (
            <CropZoom ref={cropRef} cropSize={cropSize} resolution={resolution}>
              <Image source={{ uri }} style={styles.image} contentFit="contain" />
            </CropZoom>
          ) : (
            <ActivityIndicator size="large" color={Colors.tint} />
          )}
        </View>

        <View style={[styles.controls, { borderTopColor: Colors.outlineVariant }]}>
          <View style={styles.controlRow}>
            <Text style={[styles.controlTitle, { color: Colors.onSurfaceVariant }]}>W</Text>
            <Pressable style={[styles.controlButton, { borderColor: Colors.outline }]} onPress={() => adjustCrop('width', -0.05)}>
              <MaterialCommunityIcons name="minus" size={18} color={Colors.onSurface} />
            </Pressable>
            <Pressable style={[styles.controlButton, { borderColor: Colors.outline }]} onPress={() => adjustCrop('width', 0.05)}>
              <MaterialCommunityIcons name="plus" size={18} color={Colors.onSurface} />
            </Pressable>
          </View>
          <View style={styles.controlRow}>
            <Text style={[styles.controlTitle, { color: Colors.onSurfaceVariant }]}>H</Text>
            <Pressable style={[styles.controlButton, { borderColor: Colors.outline }]} onPress={() => adjustCrop('height', -0.05)}>
              <MaterialCommunityIcons name="minus" size={18} color={Colors.onSurface} />
            </Pressable>
            <Pressable style={[styles.controlButton, { borderColor: Colors.outline }]} onPress={() => adjustCrop('height', 0.05)}>
              <MaterialCommunityIcons name="plus" size={18} color={Colors.onSurface} />
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
  },
  header: {
    paddingTop: 54,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  cropArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  controls: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  controlRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  controlTitle: {
    fontSize: 12,
    fontWeight: '700',
    width: 16,
  },
  controlButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
