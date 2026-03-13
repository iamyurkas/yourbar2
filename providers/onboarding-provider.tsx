import { useRouter } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';

import { useAppColors } from '@/constants/theme';
import { ONBOARDING_STARTER_INGREDIENT_IDS, ONBOARDING_STEPS, type OnboardingTargetId } from '@/libs/onboarding-config';
import { useI18n } from '@/libs/i18n/use-i18n';
import { useInventory } from '@/providers/inventory-provider';

type Rect = { x: number; y: number; width: number; height: number };
type TargetRef = React.RefObject<View | null>;
type ControlId = 'ingredients-all' | 'ingredients-my' | 'cocktails-my' | 'shaker-in-stock' | 'shaker-in-stock-on';
type ControlHandler = () => void;

type OnboardingContextValue = {
  registerTarget: (targetId: OnboardingTargetId, ref: TargetRef) => void;
  unregisterTarget: (targetId: OnboardingTargetId) => void;
  notifyTargetLayoutChange: () => void;
  registerControl: (id: ControlId, handler: ControlHandler) => () => void;
  startOnboarding: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

async function measure(ref: TargetRef): Promise<Rect | null> {
  return new Promise((resolve) => {
    ref.current?.measure((x, y, width, height, pageX, pageY) => {
      if (width <= 0 || height <= 0) {
        resolve(null);
        return;
      }
      resolve({
        x: Number.isFinite(pageX) ? pageX : x,
        y: Number.isFinite(pageY) ? pageY : y,
        width,
        height,
      });
    });
  });
}

function RichMessage({ text }: { text: string }) {
  const Colors = useAppColors();
  const renderLine = (line: string, keyPrefix: string) => {
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
    return (
      <Text key={keyPrefix} style={[styles.messageText, { color: Colors.onSurface }]}>
        {parts.map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <Text key={`${keyPrefix}-${index}`} style={styles.bold}>{part.slice(2, -2)}</Text>;
          }
          if (part.startsWith('*') && part.endsWith('*')) {
            return <Text key={`${keyPrefix}-${index}`} style={styles.italic}>{part.slice(1, -1)}</Text>;
          }
          return <Text key={`${keyPrefix}-${index}`}>{part}</Text>;
        })}
      </Text>
    );
  };

  return <View style={styles.messageWrap}>{text.split('\n').map((line, index) => renderLine(line, String(index)))}</View>;
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const Colors = useAppColors();
  const { width, height } = useWindowDimensions();
  const { t } = useI18n();
  const router = useRouter();
  const {
    loading,
    onboardingCompleted,
    onboardingStep,
    onboardingStarterApplied,
    setOnboardingStep,
    setOnboardingCompleted,
    setOnboardingStarterApplied,
    setIngredientAvailability,
  } = useInventory();

  const targetsRef = useRef<Map<OnboardingTargetId, TargetRef>>(new Map());
  const controlsRef = useRef<Map<ControlId, ControlHandler>>(new Map());
  const [isActive, setIsActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [layoutRevision, setLayoutRevision] = useState(0);

  const step = ONBOARDING_STEPS[currentIndex];

  const registerTarget = useCallback((targetId: OnboardingTargetId, ref: TargetRef) => {
    targetsRef.current.set(targetId, ref);
  }, []);
  const unregisterTarget = useCallback((targetId: OnboardingTargetId) => {
    targetsRef.current.delete(targetId);
  }, []);
  const notifyTargetLayoutChange = useCallback(() => {
    setLayoutRevision((value) => value + 1);
  }, []);

  const registerControl = useCallback((id: ControlId, handler: ControlHandler) => {
    controlsRef.current.set(id, handler);
    return () => {
      controlsRef.current.delete(id);
    };
  }, []);

  const startOnboarding = useCallback(() => {
    setOnboardingCompleted(false);
    setOnboardingStep(1);
    setIsActive(true);
    setCurrentIndex(0);
  }, [setOnboardingCompleted, setOnboardingStep]);

  const finishOnboarding = useCallback(() => {
    setIsActive(false);
    setTargetRect(null);
    setOnboardingStep(ONBOARDING_STEPS.length);
    setOnboardingCompleted(true);
  }, [setOnboardingCompleted, setOnboardingStep]);

  useEffect(() => {
    if (loading || onboardingCompleted || isActive) {
      return;
    }

    const normalizedStep = Math.max(1, Math.min(ONBOARDING_STEPS.length, onboardingStep || 1));
    setCurrentIndex(normalizedStep - 1);
    setIsActive(true);
  }, [isActive, loading, onboardingCompleted, onboardingStep]);

  useEffect(() => {
    if (!step || !isActive) {
      return;
    }

    Keyboard.dismiss();

    if (!onboardingStarterApplied && step.stepId >= 2) {
      ONBOARDING_STARTER_INGREDIENT_IDS.forEach((id) => setIngredientAvailability(id, true));
      setOnboardingStarterApplied(true);
    }

    if (step.navigateTo) {
      router.navigate(step.navigateTo);
    }

    if (step.activateControl) {
      setTimeout(() => controlsRef.current.get(step.activateControl as ControlId)?.(), 50);
    }

    setOnboardingStep(step.stepId);
  }, [isActive, onboardingStarterApplied, router, setIngredientAvailability, setOnboardingStarterApplied, setOnboardingStep, step]);

  useEffect(() => {
    let cancelled = false;

    if (!isActive || !step?.targetId) {
      setTargetRect(null);
      return;
    }

    const tryMeasure = async () => {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        if (cancelled) {
          return;
        }
        const targetRef = targetsRef.current.get(step.targetId!);
        if (targetRef) {
          const rect = await measure(targetRef);
          if (rect) {
            if (!cancelled) {
              setTargetRect(rect);
            }
            return;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      if (!cancelled) {
        setTargetRect(null);
      }
    };

    void tryMeasure();
    return () => {
      cancelled = true;
    };
  }, [isActive, layoutRevision, step]);

  const handleNext = useCallback(() => {
    if (!step) {
      return;
    }

    if (step.stepId === 9) {
      controlsRef.current.get('shaker-in-stock-on')?.();
    }

    if (currentIndex >= ONBOARDING_STEPS.length - 1) {
      finishOnboarding();
      router.navigate('/ingredients');
      return;
    }

    setCurrentIndex((value) => value + 1);
  }, [currentIndex, finishOnboarding, router, step]);

  const shouldShowSkip = step && step.stepId < ONBOARDING_STEPS.length;

  const tooltipTop = useMemo(() => {
    if (!targetRect) {
      return height * 0.55;
    }
    const nearBottom = targetRect.y + targetRect.height > height * 0.65;
    if (nearBottom) {
      return Math.max(16, targetRect.y - 220);
    }
    return Math.min(height - 220, targetRect.y + targetRect.height + 12);
  }, [height, targetRect]);

  const contextValue = useMemo(() => ({
    registerTarget,
    unregisterTarget,
    notifyTargetLayoutChange,
    registerControl,
    startOnboarding,
  }), [notifyTargetLayoutChange, registerControl, registerTarget, startOnboarding, unregisterTarget]);

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
      {isActive && step ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {targetRect ? (
            <>
              <View style={[styles.dim, { backgroundColor: 'rgba(0,0,0,0.65)', left: 0, right: 0, top: 0, height: targetRect.y }]} />
              <View style={[styles.dim, { backgroundColor: 'rgba(0,0,0,0.65)', left: 0, width: targetRect.x, top: targetRect.y, height: targetRect.height }]} />
              <View style={[styles.dim, { backgroundColor: 'rgba(0,0,0,0.65)', left: targetRect.x + targetRect.width, right: 0, top: targetRect.y, height: targetRect.height }]} />
              <View style={[styles.dim, { backgroundColor: 'rgba(0,0,0,0.65)', left: 0, right: 0, top: targetRect.y + targetRect.height, bottom: 0 }]} />
              <View pointerEvents="none" style={[styles.spotlight, { borderColor: Colors.primary, top: targetRect.y - 4, left: targetRect.x - 4, width: targetRect.width + 8, height: targetRect.height + 8 }]} />
            </>
          ) : (
            <View style={[styles.dim, { backgroundColor: 'rgba(0,0,0,0.65)', left: 0, top: 0, right: 0, bottom: 0 }]} />
          )}
          <View style={[styles.tooltip, { top: tooltipTop, left: 16, width: width - 32, backgroundColor: Colors.surface, borderColor: Colors.outline }]}> 
            <RichMessage text={t(step.messageId)} />
            <View style={styles.footer}>
              <Text style={[styles.counter, { color: Colors.onSurfaceVariant }]}>{t('onboarding.stepCounter', { current: step.stepId, total: ONBOARDING_STEPS.length })}</Text>
              <View style={styles.buttons}>
                {shouldShowSkip ? (
                  <Pressable onPress={finishOnboarding} style={styles.ghostButton}>
                    <Text style={{ color: Colors.onSurfaceVariant }}>{t('onboarding.skip')}</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={handleNext} style={[styles.primaryButton, { backgroundColor: Colors.primary }]}> 
                  <Text style={{ color: Colors.onPrimary, fontWeight: '700' }}>{t(step.ctaLabelKey)}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used inside OnboardingProvider');
  }
  return context;
}

export function useOnboardingTarget(targetId?: OnboardingTargetId) {
  const { registerTarget, unregisterTarget, notifyTargetLayoutChange } = useOnboarding();
  const ref = useRef<View>(null);

  useEffect(() => {
    if (!targetId) {
      return;
    }

    registerTarget(targetId, ref);
    return () => unregisterTarget(targetId);
  }, [registerTarget, targetId, unregisterTarget]);

  const onLayout = useCallback((_event: LayoutChangeEvent) => {
    notifyTargetLayoutChange();
  }, [notifyTargetLayoutChange]);

  if (!targetId) {
    return {};
  }

  return { ref, onLayout, collapsable: false as const };
}

const styles = StyleSheet.create({
  dim: {
    position: 'absolute',
  },
  spotlight: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 10,
  },
  tooltip: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  counter: { fontSize: 12 },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ghostButton: { paddingVertical: 8, paddingHorizontal: 10 },
  primaryButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  messageWrap: { gap: 2 },
  messageText: { fontSize: 15, lineHeight: 21 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
});
