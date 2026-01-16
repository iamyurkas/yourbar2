import React, { useEffect, useMemo, useRef } from 'react';
import type { View } from 'react-native';

import type { OnboardingTargetAnchor } from './onboarding-types';

type TargetEntry = {
  id: string;
  ref: React.RefObject<View>;
};

const registry = new Map<string, TargetEntry>();

export function registerTarget(id: string, ref: React.RefObject<View>) {
  registry.set(id, { id, ref });
}

export function unregisterTarget(id: string, ref: React.RefObject<View>) {
  const existing = registry.get(id);
  if (existing && existing.ref === ref) {
    registry.delete(id);
  }
}

export async function getTargetRect(id: string): Promise<OnboardingTargetAnchor | null> {
  const entry = registry.get(id);
  const node = entry?.ref.current;
  if (!node || !node.measureInWindow) {
    return null;
  }

  return new Promise((resolve) => {
    node.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) {
        resolve(null);
        return;
      }

      resolve({ x, y, width, height });
    });
  });
}

export function useOnboardingTarget(targetId: string) {
  const ref = useRef<View>(null);

  useEffect(() => {
    registerTarget(targetId, ref);
    return () => {
      unregisterTarget(targetId, ref);
    };
  }, [targetId]);

  return useMemo(() => ({ ref, testID: targetId }), [targetId]);
}

export function useOptionalOnboardingTarget(targetId?: string | null) {
  const ref = useRef<View>(null);

  useEffect(() => {
    if (!targetId) {
      return undefined;
    }

    registerTarget(targetId, ref);
    return () => {
      unregisterTarget(targetId, ref);
    };
  }, [targetId]);

  return useMemo(
    () => ({ ref, testID: targetId ?? undefined }),
    [targetId],
  );
}
