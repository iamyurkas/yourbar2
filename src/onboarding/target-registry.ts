import { useEffect, useRef, type RefObject } from 'react';
import type { LayoutRectangle, View } from 'react-native';

import type { SpotlightTargetId } from '@/src/onboarding/onboarding-types';

type TargetEntry = {
  ref: RefObject<View>;
  testID: string;
};

const registry = new Map<SpotlightTargetId, TargetEntry>();
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const registerTarget = (id: SpotlightTargetId, entry: TargetEntry) => {
  registry.set(id, entry);
  notify();
};

export const unregisterTarget = (id: SpotlightTargetId, entry?: TargetEntry) => {
  const existing = registry.get(id);
  if (!existing) {
    return;
  }

  if (entry && existing.ref !== entry.ref) {
    return;
  }

  registry.delete(id);
  notify();
};

export const subscribeToTargetRegistry = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getTargetRect = async (id: SpotlightTargetId): Promise<LayoutRectangle | null> => {
  const entry = registry.get(id);
  if (!entry?.ref.current) {
    return null;
  }

  return new Promise((resolve) => {
    entry.ref.current?.measureInWindow((x, y, width, height) => {
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
        resolve(null);
        return;
      }

      resolve({
        x,
        y,
        width,
        height,
      });
    });
  });
};

export const useOnboardingTarget = (id: SpotlightTargetId) => {
  const ref = useRef<View>(null);
  const testID = `onboarding-target-${id}`;

  useEffect(() => {
    const entry = { ref, testID };
    registerTarget(id, entry);
    return () => {
      unregisterTarget(id, entry);
    };
  }, [id, testID]);

  return {
    ref,
    testID,
  };
};
