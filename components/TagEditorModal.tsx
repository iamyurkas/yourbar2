import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { TAG_COLORS } from '@/constants/tag-colors';
import { Colors } from '@/constants/theme';

type TagEditorModalProps = {
  visible: boolean;
  title: string;
  confirmLabel: string;
  initialName?: string | null;
  initialColor?: string | null;
  onClose: () => void;
  onSave: (data: { name: string; color: string }) => void;
};

export function TagEditorModal({
  visible,
  title,
  confirmLabel,
  initialName,
  initialColor,
  onClose,
  onSave,
}: TagEditorModalProps) {
  const [name, setName] = useState(initialName ?? '');
  const [hue, setHue] = useState(210);
  const [lightness, setLightness] = useState(0.5);

  const parseHexToHsl = useCallback((value?: string | null) => {
    if (!value) {
      return null;
    }

    const hex = value.replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
      return null;
    }

    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const l = (max + min) / 2;

    if (delta === 0) {
      return { h: 0, l };
    }

    let h = 0;
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }

    h = Math.round(h * 60);
    if (h < 0) {
      h += 360;
    }

    return { h, l: Math.max(0.1, Math.min(0.9, l)) };
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setName(initialName ?? '');
    const parsed = parseHexToHsl(initialColor ?? TAG_COLORS[0]);
    if (parsed) {
      setHue(parsed.h);
      setLightness(parsed.l);
    } else {
      setHue(210);
      setLightness(0.5);
    }
  }, [initialColor, initialName, parseHexToHsl, visible]);

  const trimmedName = useMemo(() => name.trim(), [name]);
  const canSave = trimmedName.length > 0;

  const selectedColor = useMemo(() => {
    const saturation = 0.8;
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const normalizedHue = hue / 60;
    const x = chroma * (1 - Math.abs((normalizedHue % 2) - 1));
    const [r1, g1, b1] =
      normalizedHue >= 0 && normalizedHue < 1
        ? [chroma, x, 0]
        : normalizedHue < 2
          ? [x, chroma, 0]
          : normalizedHue < 3
            ? [0, chroma, x]
            : normalizedHue < 4
              ? [0, x, chroma]
              : normalizedHue < 5
                ? [x, 0, chroma]
                : [chroma, 0, x];
    const m = lightness - chroma / 2;
    const r = Math.round((r1 + m) * 255);
    const g = Math.round((g1 + m) * 255);
    const b = Math.round((b1 + m) * 255);
    const toHex = (value: number) => value.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }, [hue, lightness]);

  const handleSave = () => {
    if (!canSave) {
      return;
    }

    onSave({ name: trimmedName, color: selectedColor });
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityRole="button">
        <Pressable
          style={[
            styles.card,
            { backgroundColor: Colors.surface, borderColor: Colors.outline, shadowColor: Colors.shadow },
          ]}
          onPress={(event) => event.stopPropagation?.()}
          accessibilityRole="menu"
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: Colors.onSurface }]}>{title}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <MaterialCommunityIcons name="close" size={22} color={Colors.onSurfaceVariant} />
            </Pressable>
          </View>
          <Text style={[styles.label, { color: Colors.onSurfaceVariant }]}>Tag name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="New tag"
            placeholderTextColor={`${Colors.onSurfaceVariant}99`}
            style={[
              styles.input,
              { borderColor: Colors.outlineVariant, color: Colors.text, backgroundColor: Colors.surface },
            ]}
          />
          <Text style={[styles.label, { color: Colors.onSurfaceVariant }]}>Color</Text>
          <View style={styles.colorPreviewRow}>
            <View style={[styles.colorPreview, { backgroundColor: selectedColor, borderColor: Colors.outlineVariant }]} />
            <Text style={[styles.colorValue, { color: Colors.onSurfaceVariant }]}>{selectedColor}</Text>
          </View>
          <ColorSlider
            label="Hue"
            value={hue / 360}
            onChange={(next) => setHue(Math.round(next * 360))}
            gradientStops={[
              { offset: '0%', color: '#ff3b30' },
              { offset: '17%', color: '#ff9f0a' },
              { offset: '33%', color: '#ffd60a' },
              { offset: '50%', color: '#34c759' },
              { offset: '67%', color: '#0a84ff' },
              { offset: '83%', color: '#5e5ce6' },
              { offset: '100%', color: '#ff3b30' },
            ]}
            palette={palette}
          />
          <ColorSlider
            label="Tone"
            value={lightness}
            onChange={setLightness}
            gradientStops={[
              { offset: '0%', color: `hsl(${hue}, 80%, 15%)` },
              { offset: '100%', color: `hsl(${hue}, 80%, 85%)` },
            ]}
            palette={palette}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave }}
            onPress={handleSave}
            style={[
              styles.saveButton,
              { backgroundColor: canSave ? Colors.tint : Colors.outlineVariant },
            ]}
          >
            <Text style={[styles.saveLabel, { color: Colors.onPrimary }]}>{confirmLabel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type ColorSliderProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  gradientStops: Array<{ offset: string; color: string }>;
  palette: typeof Colors;
};

function ColorSlider({ label, value, onChange, gradientStops, palette }: ColorSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);

  const updateValue = useCallback(
    (locationX: number) => {
      if (!trackWidth) {
        return;
      }
      const next = Math.max(0, Math.min(1, locationX / trackWidth));
      onChange(next);
    },
    [onChange, trackWidth],
  );

  const handleResponder = useCallback(
    (event: { nativeEvent: { locationX: number } }) => {
      updateValue(event.nativeEvent.locationX);
    },
    [updateValue],
  );

  return (
    <View style={styles.sliderBlock}>
      <Text style={[styles.sliderLabel, { color: Colors.onSurfaceVariant }]}>{label}</Text>
      <View
        style={styles.sliderTrack}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onResponderGrant={handleResponder}
        onResponderMove={handleResponder}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={`gradient-${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
              {gradientStops.map((stop) => (
                <Stop key={`${label}-${stop.offset}-${stop.color}`} offset={stop.offset} stopColor={stop.color} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" rx="8" fill={`url(#gradient-${label})`} />
        </Svg>
        <View
          pointerEvents="none"
          style={[
            styles.sliderThumb,
            {
              left: trackWidth ? value * trackWidth - 8 : 0,
              borderColor: Colors.surface,
              backgroundColor: Colors.onSurface,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  colorPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  colorValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  sliderBlock: {
    gap: 6,
  },
  sliderLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  sliderTrack: {
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  sliderThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveButton: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
});
