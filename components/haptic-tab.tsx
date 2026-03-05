import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

export function HapticTab(props: BottomTabBarButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  
  return (
    <PlatformPressable
      {...props}
      pressOpacity={0.7}
      android_ripple={{ color: 'rgba(255,255,255,0.12)', borderless: false }}
      onPressIn={(ev) => {
        setIsPressed(true);
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
      onPressOut={(ev) => {
        setIsPressed(false);
        props.onPressOut?.(ev);
      }}
      style={[props.style, isPressed && styles.pressed]}
    >
      {isPressed && <View style={styles.debugIndicator} />}
    </PlatformPressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  debugIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,0,0,0.3)',
  },
});
