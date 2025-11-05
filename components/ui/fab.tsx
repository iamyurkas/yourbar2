import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ReactNode } from 'react';
import { Pressable, PressableStateCallbackType, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

type FabProps = {
  icon?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function FloatingActionButton({ icon, onPress, style }: FabProps) {
  const tint = useThemeColor({}, 'tint');
  const background = useThemeColor({ light: tint, dark: tint }, 'tint');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }: PressableStateCallbackType) => [
        styles.button,
        { backgroundColor: background },
        style,
        pressed && styles.pressed,
      ]}
    >
      {icon ?? <MaterialCommunityIcons name="plus" size={24} color="#fff" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
  },
  pressed: {
    opacity: 0.85,
  },
});
