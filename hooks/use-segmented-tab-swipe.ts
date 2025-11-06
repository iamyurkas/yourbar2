import { useMemo } from 'react';
import {
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
  type PanResponderInstance,
} from 'react-native';

const SWIPE_DISTANCE_THRESHOLD = 48;
const SWIPE_VELOCITY_THRESHOLD = 0.2;
const HORIZONTAL_SLOPE_FACTOR = 1.5;
const MIN_ACTIVATION_DISTANCE = 12;

type TabOption<T extends string> = { key: T };

type SwipeResponder = PanResponderInstance;

type SwipeDirection = 'left' | 'right';

const shouldHandleGesture = (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
  const { dx, dy } = gestureState;
  if (Math.abs(dx) < MIN_ACTIVATION_DISTANCE) {
    return false;
  }
  return Math.abs(dx) > Math.abs(dy) * HORIZONTAL_SLOPE_FACTOR;
};

const handleGestureEnd = (
  gestureState: PanResponderGestureState,
  onSwipe: (direction: SwipeDirection) => void,
) => {
  const { dx, vx } = gestureState;
  if (Math.abs(dx) < SWIPE_DISTANCE_THRESHOLD && Math.abs(vx) < SWIPE_VELOCITY_THRESHOLD) {
    return;
  }

  onSwipe(dx < 0 ? 'left' : 'right');
};

export function useSegmentedTabSwipe<T extends string>(
  options: TabOption<T>[],
  activeKey: T,
  onChange: (key: T) => void,
): SwipeResponder {
  return useMemo(() => {
    const keys = options.map((option) => option.key);

    const handleSwipe = (direction: SwipeDirection) => {
      const currentIndex = keys.indexOf(activeKey);
      if (currentIndex === -1) {
        return;
      }

      if (direction === 'left' && currentIndex < keys.length - 1) {
        const nextKey = keys[currentIndex + 1];
        if (nextKey !== activeKey) {
          onChange(nextKey);
        }
        return;
      }

      if (direction === 'right' && currentIndex > 0) {
        const previousKey = keys[currentIndex - 1];
        if (previousKey !== activeKey) {
          onChange(previousKey);
        }
      }
    };

    return PanResponder.create({
      onMoveShouldSetPanResponder: shouldHandleGesture,
      onPanResponderRelease: (_event, gestureState) => handleGestureEnd(gestureState, handleSwipe),
      onPanResponderTerminate: (_event, gestureState) => handleGestureEnd(gestureState, handleSwipe),
    });
  }, [options, activeKey, onChange]);
}
