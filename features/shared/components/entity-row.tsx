import { ReactNode } from 'react';
import { Pressable, PressableStateCallbackType, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

type EntityRowProps = {
  title: string;
  subtitle?: string;
  detail?: string;
  thumbnailColor?: string;
  statusColor?: string;
  rightAccessory?: ReactNode;
  children?: ReactNode;
};

export function EntityRow({
  title,
  subtitle,
  detail,
  thumbnailColor,
  statusColor,
  rightAccessory,
  children,
}: EntityRowProps) {
  const cardBackground = useThemeColor({ light: '#fff', dark: '#111827' }, 'background');
  const borderColor = useThemeColor({ light: '#E5E7EB', dark: '#1F2933' }, 'background');
  const textColor = useThemeColor({}, 'text');

  return (
    <Pressable
      style={({ pressed }: PressableStateCallbackType) => [
        styles.container,
        { backgroundColor: cardBackground, borderColor },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
    >
      <View style={[styles.thumbnail, { backgroundColor: thumbnailColor ?? '#F1F5F9' }]}> 
        <ThemedText type="defaultSemiBold" style={styles.thumbnailText}>
          {title.slice(0, 2).toUpperCase()}
        </ThemedText>
      </View>

      <View style={styles.content}>
        <ThemedText type="defaultSemiBold" style={[styles.title, { color: textColor }]}>
          {title}
        </ThemedText>
        {subtitle ? <ThemedText style={styles.subtitle}>{subtitle}</ThemedText> : null}
        {detail ? <ThemedText style={styles.detail}>{detail}</ThemedText> : null}
        {children ? <View style={styles.tags}>{children}</View> : null}
      </View>

      <View style={styles.trailing}>
        {statusColor ? <View style={[styles.statusDot, { backgroundColor: statusColor }]} /> : null}
        {rightAccessory}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  pressed: {
    opacity: 0.9,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailText: {
    fontSize: 16,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 17,
  },
  subtitle: {
    color: '#6B7280',
  },
  detail: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 12,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
