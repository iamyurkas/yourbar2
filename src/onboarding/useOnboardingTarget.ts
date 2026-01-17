import { useCallback, useEffect, useRef } from 'react';
import type { LayoutRectangle } from 'react-native';
import type { View } from 'react-native';

import { registerTarget, unregisterTarget, updateTargetRect } from './target-registry';

export function useOnboardingTarget(targetId: string | null) {
  const viewRef = useRef<View | null>(null);

  const measure = useCallback(() => {
    return new Promise<{ x: number; y: number; width: number; height: number } | null>((resolve) => {
      const node = viewRef.current;
      if (!node?.measureInWindow) {
        resolve(null);
        return;
      }

      node.measureInWindow((x, y, width, height) => {
        resolve({ x, y, width, height });
      });
    });
  }, []);

  const handleLayout = useCallback(
    (_layout: LayoutRectangle) => {
      if (!targetId) {
        return;
      }

      registerTarget(targetId, measure);
      measure()
        .then((rect) => {
          if (rect) {
            updateTargetRect(targetId, rect);
          }
        })
        .catch((error) => {
          console.warn('Unable to measure onboarding target', error);
        });
    },
    [measure, targetId],
  );

  useEffect(() => {
    if (!targetId) {
      return;
    }

    registerTarget(targetId, measure);
    return () => {
      unregisterTarget(targetId);
    };
  }, [measure, targetId]);

  return { ref: viewRef, onLayout: handleLayout, testID: targetId ?? undefined };
}
