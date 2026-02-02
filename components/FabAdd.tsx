import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppColors } from '@/constants/theme';

type FabAddProps = {
  label?: string;
  onPress?: () => void;
};

export function FabAdd({ label = 'Add', onPress }: FabAddProps) {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();

  return (
    <View style={[styles.container, { bottom: insets.bottom + 16 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={[styles.fab, { backgroundColor: colors.highlightFaint, shadowColor: colors.shadow }]}
        android_ripple={{ color: `${colors.surface}33`, borderless: true }}>
        <MaterialCommunityIcons name="plus" size={26} color={colors.secondary} />
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
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
});
