export type TargetRect = { x: number; y: number; width: number; height: number };

type TargetEntry = {
  measure: () => Promise<TargetRect | null>;
  rect: TargetRect | null;
};

type Listener = () => void;

const registry = new Map<string, TargetEntry>();
const listeners = new Set<Listener>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const registerTarget = (targetId: string, measure: () => Promise<TargetRect | null>) => {
  const existing = registry.get(targetId);
  registry.set(targetId, { measure, rect: existing?.rect ?? null });
  notify();
};

export const updateTargetRect = (targetId: string, rect: TargetRect) => {
  const existing = registry.get(targetId);
  registry.set(targetId, { measure: existing?.measure ?? (async () => rect), rect });
  notify();
};

export const unregisterTarget = (targetId: string) => {
  if (!registry.has(targetId)) {
    return;
  }

  registry.delete(targetId);
  notify();
};

export const getTargetRectSync = (targetId: string) => {
  return registry.get(targetId)?.rect ?? null;
};

export const measureTargetRect = async (targetId: string) => {
  const entry = registry.get(targetId);
  if (!entry) {
    return null;
  }

  const rect = await entry.measure();
  if (rect) {
    registry.set(targetId, { ...entry, rect });
    notify();
  }

  return rect;
};

export const subscribeToTargetRegistry = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
