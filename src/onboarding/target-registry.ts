import { useEffect, useRef, type RefObject } from 'react';
import type { View } from 'react-native';

export type TargetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const registry = new Map<string, RefObject<View>>();

export function registerTarget(targetId: string, ref: RefObject<View>) {
  registry.set(targetId, ref);
}

export function unregisterTarget(targetId: string) {
  registry.delete(targetId);
}

export async function getTargetRect(targetId: string): Promise<TargetRect | null> {
  const ref = registry.get(targetId);

  if (!ref?.current) {
    return null;
  }

  return new Promise((resolve) => {
    ref.current?.measureInWindow((x, y, width, height) => {
      resolve({ x, y, width, height });
    });
  });
}

export function useOnboardingTarget(targetId: string) {
  const ref = useRef<View>(null);

  useEffect(() => {
    registerTarget(targetId, ref);

    return () => {
      unregisterTarget(targetId);
    };
  }, [targetId]);

  return ref;
}
