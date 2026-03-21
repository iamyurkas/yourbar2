import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image as RNImage,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';

import { cropImageUri } from '@/libs/crop-image';

type Rect = { x: number; y: number; width: number; height: number };
type DragMode = 'move' | 'tl' | 'tr' | 'bl' | 'br';

const MIN_SIZE = 42;

export type FreeformImageCropModalProps = {
  visible: boolean;
  imageUri: string | null;
  accentColor: string;
  onSurfaceColor: string;
  overlayColor?: string;
  cancelLabel: string;
  applyLabel: string;
  title: string;
  onCancel: () => void;
  onApply: (uri: string) => void;
  onError: () => void;
};

export function FreeformImageCropModal({
  visible,
  imageUri,
  accentColor,
  onSurfaceColor,
  overlayColor = 'rgba(0, 0, 0, 0.55)',
  cancelLabel,
  applyLabel,
  title,
  onCancel,
  onApply,
  onError,
}: FreeformImageCropModalProps) {
  const [container, setContainer] = useState({ width: 0, height: 0 });
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
  const [rect, setRect] = useState<Rect | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  useEffect(() => {
    if (!imageUri || !visible) {
      return;
    }

    RNImage.getSize(
      imageUri,
      (width, height) => {
        setSourceSize({ width, height });
      },
      () => {
        onError();
      },
    );
  }, [imageUri, onError, visible]);

  const imageLayout = useMemo(() => {
    const { width: cw, height: ch } = container;
    const { width: iw, height: ih } = sourceSize;
    if (cw <= 0 || ch <= 0 || iw <= 0 || ih <= 0) {
      return null;
    }

    const scale = Math.min(cw / iw, ch / ih);
    const width = iw * scale;
    const height = ih * scale;
    return {
      x: (cw - width) / 2,
      y: (ch - height) / 2,
      width,
      height,
      scale,
    };
  }, [container, sourceSize]);

  useEffect(() => {
    if (!visible || !imageLayout) {
      return;
    }

    setRect({
      x: imageLayout.width * 0.1,
      y: imageLayout.height * 0.1,
      width: imageLayout.width * 0.8,
      height: imageLayout.height * 0.8,
    });
  }, [imageLayout, visible, imageUri]);

  const applyDrag = useCallback((mode: DragMode, dx: number, dy: number) => {
    if (!imageLayout) {
      return;
    }

    setRect((current) => {
      if (!current) {
        return current;
      }

      let next = { ...current };

      if (mode === 'move') {
        next.x = Math.max(0, Math.min(current.x + dx, imageLayout.width - current.width));
        next.y = Math.max(0, Math.min(current.y + dy, imageLayout.height - current.height));
        return next;
      }

      if (mode.includes('l')) {
        const right = current.x + current.width;
        next.x = Math.max(0, Math.min(current.x + dx, right - MIN_SIZE));
        next.width = right - next.x;
      }

      if (mode.includes('r')) {
        next.width = Math.max(MIN_SIZE, Math.min(current.width + dx, imageLayout.width - current.x));
      }

      if (mode.includes('t')) {
        const bottom = current.y + current.height;
        next.y = Math.max(0, Math.min(current.y + dy, bottom - MIN_SIZE));
        next.height = bottom - next.y;
      }

      if (mode.includes('b')) {
        next.height = Math.max(MIN_SIZE, Math.min(current.height + dy, imageLayout.height - current.y));
      }

      return next;
    });
  }, [imageLayout]);

  const makeResponder = useCallback((mode: DragMode) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, state) => applyDrag(mode, state.dx, state.dy),
  }), [applyDrag]);

  const moveResponder = useMemo(() => makeResponder('move'), [makeResponder]);
  const tlResponder = useMemo(() => makeResponder('tl'), [makeResponder]);
  const trResponder = useMemo(() => makeResponder('tr'), [makeResponder]);
  const blResponder = useMemo(() => makeResponder('bl'), [makeResponder]);
  const brResponder = useMemo(() => makeResponder('br'), [makeResponder]);

  const handleApply = useCallback(async () => {
    if (!rect || !imageLayout || !imageUri || isCropping) {
      return;
    }

    setIsCropping(true);
    try {
      const cropped = await cropImageUri(imageUri, {
        x: rect.x / imageLayout.scale,
        y: rect.y / imageLayout.scale,
        width: rect.width / imageLayout.scale,
        height: rect.height / imageLayout.scale,
      });
      onApply(cropped);
    } catch {
      onError();
    } finally {
      setIsCropping(false);
    }
  }, [imageLayout, imageUri, isCropping, onApply, onError, rect]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainer({ width, height });
  }, []);

  if (!imageUri) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: onSurfaceColor }]}>{title}</Text>
            <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button" accessibilityLabel={cancelLabel}>
              <MaterialCommunityIcons name="close" size={22} color={onSurfaceColor} />
            </Pressable>
          </View>

          <View style={styles.preview} onLayout={onLayout}>
            <ExpoImage source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="contain" />
            {imageLayout && rect ? (
              <>
                <View style={[styles.overlay, { backgroundColor: overlayColor, left: imageLayout.x, top: imageLayout.y, width: imageLayout.width, height: rect.y }]} />
                <View style={[styles.overlay, { backgroundColor: overlayColor, left: imageLayout.x, top: imageLayout.y + rect.y, width: rect.x, height: rect.height }]} />
                <View style={[styles.overlay, { backgroundColor: overlayColor, left: imageLayout.x + rect.x + rect.width, top: imageLayout.y + rect.y, width: imageLayout.width - rect.x - rect.width, height: rect.height }]} />
                <View style={[styles.overlay, { backgroundColor: overlayColor, left: imageLayout.x, top: imageLayout.y + rect.y + rect.height, width: imageLayout.width, height: imageLayout.height - rect.y - rect.height }]} />

                <View
                  {...moveResponder.panHandlers}
                  style={[
                    styles.selection,
                    {
                      borderColor: accentColor,
                      left: imageLayout.x + rect.x,
                      top: imageLayout.y + rect.y,
                      width: rect.width,
                      height: rect.height,
                    },
                  ]}
                >
                  <View {...tlResponder.panHandlers} style={[styles.handle, { left: -8, top: -8, borderColor: accentColor }]} />
                  <View {...trResponder.panHandlers} style={[styles.handle, { right: -8, top: -8, borderColor: accentColor }]} />
                  <View {...blResponder.panHandlers} style={[styles.handle, { left: -8, bottom: -8, borderColor: accentColor }]} />
                  <View {...brResponder.panHandlers} style={[styles.handle, { right: -8, bottom: -8, borderColor: accentColor }]} />
                </View>
              </>
            ) : null}
          </View>

          <View style={styles.footer}>
            <Pressable style={styles.secondary} onPress={onCancel}>
              <Text style={[styles.secondaryLabel, { color: onSurfaceColor }]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable style={[styles.primary, { backgroundColor: accentColor }]} onPress={() => void handleApply()}>
              {isCropping ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryLabel}>{applyLabel}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: '#121212', borderRadius: 16, overflow: 'hidden', maxHeight: '92%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  title: { fontSize: 16, fontWeight: '700' },
  preview: { height: 420, marginHorizontal: 12, marginBottom: 12, borderRadius: 12, overflow: 'hidden' },
  overlay: { position: 'absolute' },
  selection: { position: 'absolute', borderWidth: 2 },
  handle: { position: 'absolute', width: 16, height: 16, borderRadius: 8, borderWidth: 2, backgroundColor: '#fff' },
  footer: { flexDirection: 'row', gap: 10, padding: 12 },
  secondary: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: { fontSize: 15, fontWeight: '600' },
  primary: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
