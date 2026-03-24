import { StyleSheet, View } from 'react-native';

type CropOverlayProps = {
  frameWidth: number;
  frameHeight: number;
  borderRadius?: number;
  dimColor?: string;
};

export function CropOverlay({
  frameWidth,
  frameHeight,
  borderRadius = 16,
  dimColor = 'rgba(0, 0, 0, 0.56)',
}: CropOverlayProps) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.row, { backgroundColor: dimColor }]} />
      <View style={styles.middleRow}>
        <View style={[styles.side, { backgroundColor: dimColor }]} />
        <View
          style={[
            styles.frame,
            {
              width: frameWidth,
              height: frameHeight,
              borderRadius,
            },
          ]}
        />
        <View style={[styles.side, { backgroundColor: dimColor }]} />
      </View>
      <View style={[styles.row, { backgroundColor: dimColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
  },
  middleRow: {
    flexDirection: 'row',
  },
  side: {
    flex: 1,
  },
  frame: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
  },
});
