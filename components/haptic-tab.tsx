import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

const pressedStyle: ViewStyle = {
  transform: [{ scale: 0.96 }],
  opacity: 0.92,
};

export function HapticTab(props: BottomTabBarButtonProps) {
  const { style, onPressIn, onPressOut, ...restProps } = props;
  const [isPressed, setIsPressed] = useState(false);

  const resolvedStyle = useMemo<StyleProp<ViewStyle>>(
    () => [style as StyleProp<ViewStyle>, isPressed && pressedStyle],
    [isPressed, style],
  );

  return (
    <PlatformPressable
      {...restProps}
      style={resolvedStyle}
      pressOpacity={0.7}
      android_ripple={{ color: 'rgba(255,255,255,0.12)', borderless: false }}
      onPressIn={(ev) => {
        setIsPressed(true);

        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        onPressIn?.(ev);
      }}
      onPressOut={(ev) => {
        setIsPressed(false);
        onPressOut?.(ev);
      }}
    />
  );
}
