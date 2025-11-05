import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleProp, StyleSheet, TextInput, TextStyle, View, ViewStyle } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

type SearchBarProps = {
  placeholder: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export function SearchBar({ placeholder, containerStyle, inputStyle }: SearchBarProps) {
  const background = useThemeColor({ light: '#F3F4F6', dark: '#1F2933' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');

  return (
    <View style={[styles.container, { backgroundColor: background }, containerStyle]}>
      <MaterialCommunityIcons name="magnify" size={20} color={iconColor} style={styles.icon} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={iconColor}
        style={[styles.input, { color: textColor }, inputStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
});
