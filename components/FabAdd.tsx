import { useAppColors } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FabAddProps = {
  label?: string;
  onPress?: () => void;
};

export function FabAdd({ label = 'Add', onPress }: FabAddProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.min(insets.bottom, 8);
  const Colors = useAppColors();

  return (
    <View style={[styles.container, { bottom: bottomInset + 16 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        android_ripple={{ color: `${Colors.surface}33`, borderless: false }}
        style={[styles.pressable, { shadowColor: Colors.shadow }]}
      >
        <View
          style={[styles.fab, { backgroundColor: Colors.primaryContainer },]}
        >
          {Platform.OS === 'ios' ? (
            <SymbolView
              name="plus"
              size={24}
              tintColor={Colors.primary}
              fallback={<MaterialCommunityIcons name="plus" size={26} color={Colors.primary} />}
            />
          ) : (
            <MaterialCommunityIcons name="plus" size={26} color={Colors.primary} />
          )}
        </View>
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

  pressable: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 6,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },

  fab: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
