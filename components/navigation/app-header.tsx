import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, PressableStateCallbackType, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  showSettings?: boolean;
};

export function AppHeader({ title, subtitle, trailing, showSettings = true }: AppHeaderProps) {
  const tint = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');

  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <ThemedText type="title" style={[styles.title, { color: textColor }]}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="subtitle" style={[styles.subtitle, { color: textColor }]}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.actions}>
        {trailing}
        {showSettings ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/settings')}
            style={({ pressed }: PressableStateCallbackType) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
            ]}
          >
            <MaterialCommunityIcons name="cog-outline" size={24} color={tint} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: {
    opacity: 0.6,
  },
});
