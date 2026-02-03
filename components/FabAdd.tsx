import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';

type FabAddProps = {
  label?: string;
  onPress?: () => void;
};

export function FabAdd({ label = 'Add', onPress }: FabAddProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.min(insets.bottom, 8);

  return (
    <View style={[styles.container, { bottom: bottomInset + 16 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={[styles.fab, { backgroundColor: Colors.highlightFaint }]}
        android_ripple={{ color: `${Colors.surface}33`, borderless: true }}>
        <MaterialCommunityIcons name="plus" size={26} color={Colors.secondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 24,
    zIndex: 10,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
});
