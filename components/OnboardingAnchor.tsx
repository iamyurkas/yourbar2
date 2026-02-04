import React, { useCallback, useEffect, useRef } from 'react';
import { View, type ViewProps } from 'react-native';

import { useOnboarding } from '@/providers/onboarding-provider';

type OnboardingAnchorProps = ViewProps & {
  anchorId: string;
  children: React.ReactNode;
};

export function OnboardingAnchor({ anchorId, children, style, ...props }: OnboardingAnchorProps) {
  const { registerAnchor, unregisterAnchor } = useOnboarding();
  const viewRef = useRef<View>(null);

  const measure = useCallback(() => {
    if (viewRef.current) {
      viewRef.current.measureInWindow((x, y, width, height) => {
        // We use measureInWindow to get absolute coordinates relative to the screen.
        // This is important because the overlay is rendered at the root level.
        if (width > 0 && height > 0) {
          registerAnchor(anchorId, { x, y, width, height });
        }
      });
    }
  }, [anchorId, registerAnchor]);

  useEffect(() => {
    const timer = setTimeout(measure, 500); // Delay to ensure layout is finished
    return () => {
      clearTimeout(timer);
      unregisterAnchor(anchorId);
    };
  }, [anchorId, measure, unregisterAnchor]);

  return (
    <View
      ref={viewRef}
      onLayout={measure}
      style={style}
      {...props}
    >
      {children}
    </View>
  );
}
