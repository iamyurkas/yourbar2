import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';

type SideMenuProps = {
  visible: boolean;
  onClose: () => void;
  children?: React.ReactNode;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const MENU_WIDTH = SCREEN_WIDTH * 0.75;
const ANIMATION_DURATION_MS = 200;

export function SideMenu({ visible, onClose, children }: SideMenuProps) {
  const translateX = useRef(new Animated.Value(visible ? 0 : -MENU_WIDTH)).current;
  const [isMounted, setIsMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
    }
  }, [visible]);

  useEffect(() => {
    const toValue = visible ? 0 : -MENU_WIDTH;
    Animated.timing(translateX, {
      toValue,
      duration: ANIMATION_DURATION_MS,
      useNativeDriver: true,
    }).start(() => {
      if (!visible) {
        setIsMounted(false);
      }
    });
  }, [visible, translateX]);

  if (!isMounted) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={[styles.overlay]}>
        <Animated.View
          style={[
            styles.menu,
            {
              width: MENU_WIDTH,
              transform: [{ translateX }],
            },
          ]}>
          {children}
        </Animated.View>
        <Pressable
          style={styles.scrim}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 100,
  },
  menu: {
    height: '100%',
    backgroundColor: Colors.surface,
    paddingTop: 16,
    paddingHorizontal: 16,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  scrim: {
    flex: 1,
    backgroundColor: Colors.backdrop,
  },
});

