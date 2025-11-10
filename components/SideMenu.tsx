import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { tagColors } from '@/theme/theme';

export type SideMenuItem = {
  key: string;
  label: string;
  icon: string;
  badgeColorKey?: keyof typeof tagColors;
  onPress?: () => void;
};

type SideMenuProps = {
  visible: boolean;
  onClose: () => void;
  items: SideMenuItem[];
  title?: string;
};

const SLIDE_DURATION = 220;

export function SideMenu({ visible, onClose, items, title = 'Menu' }: SideMenuProps) {
  const palette = Colors;
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [rendered, setRendered] = useState(visible);

  useEffect(() => {
    if (visible) {
      setRendered(true);
    }

    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: SLIDE_DURATION,
      useNativeDriver: true,
    }).start(() => {
      if (!visible) {
        setRendered(false);
      }
    });
  }, [progress, visible]);

  const menuWidth = useMemo(() => Dimensions.get('window').width * 0.75, []);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-menuWidth, 0],
  });

  if (!rendered) {
    return null;
  }

  return (
    <View pointerEvents={visible ? 'auto' : 'none'} style={StyleSheet.absoluteFillObject}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close menu"
        onPress={onClose}
        style={[styles.backdrop, { backgroundColor: `${palette.shadow}55` }]}>
        <View />
      </Pressable>
      <Animated.View
        style={[
          styles.sheet,
          { width: menuWidth },
          {
            paddingTop: insets.top + 24,
            paddingBottom: Math.max(insets.bottom, 24),
            backgroundColor: palette.surface,
            transform: [{ translateX }],
            shadowColor: palette.shadow,
          },
        ]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            onPress={onClose}
            android_ripple={{ color: `${palette.tertiary}59`, foreground: true }}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="close" size={22} color={palette.onSurfaceVariant} />
          </Pressable>
        </View>
        <View style={[styles.divider, { backgroundColor: `${palette.outline}66` }]} />
        {items.map((item) => {
          const badgeColor = item.badgeColorKey ? tagColors[item.badgeColorKey] : undefined;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => {
                item.onPress?.();
                onClose();
              }}
              android_ripple={{ color: `${palette.tertiary}59` }}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
              <View style={styles.itemLeading}>
                <MaterialCommunityIcons name={item.icon} size={22} color={palette.icon} />
              </View>
              <Text style={[styles.itemLabel, { color: palette.text }]}>{item.label}</Text>
              {badgeColor ? <View style={[styles.badgeDot, { backgroundColor: badgeColor }]} /> : null}
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    paddingHorizontal: 20,
    gap: 12,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 16,
  },
  itemLeading: {
    width: 28,
    alignItems: 'center',
  },
  itemLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  badgeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
