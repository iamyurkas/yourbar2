import React, { useRef, useEffect, useCallback } from 'react';
import { View, type LayoutChangeEvent, type ViewProps } from 'react-native';
import { useOnboardingAnchors } from './OnboardingContext';

type OnboardingAnchorProps = ViewProps & {
  name: string;
  children: React.ReactNode;
  active?: boolean;
};

export function OnboardingAnchor({ name, children, active = true, ...props }: OnboardingAnchorProps) {
  const { registerAnchor, unregisterAnchor } = useOnboardingAnchors();
  const viewRef = useRef<View>(null);

  const measure = useCallback(() => {
    if (!active) return;
    const trigger = () => {
      viewRef.current?.measureInWindow((x, y, width, height) => {
        // Sometimes measurement fails (returns 0 or NaN if view is not yet visible)
        if (width > 0 && height > 0) {
          registerAnchor(name, { x, y, width, height });
        }
      });
    };

    // Initial measure can be stale on iOS right after screen/tab switches.
    // Retry a few times to capture the final settled position.
    const timeouts = [0, 100, 350].map((delay) => setTimeout(trigger, delay));

    return () => {
      timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, [active, name, registerAnchor]);

  useEffect(() => {
    if (!active) {
      unregisterAnchor(name);
    } else {
      return measure();
    }
  }, [active, name, unregisterAnchor, measure]);

  const handleLayout = (event: LayoutChangeEvent) => {
    measure();
    props.onLayout?.(event);
  };

  return (
    <View ref={viewRef} {...props} onLayout={handleLayout} collapsable={false}>
      {children}
    </View>
  );
}
