import { useRouter } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, useWindowDimensions, View, type View as RNView } from 'react-native';

import { useAppColors } from '@/constants/theme';
import { useI18n } from '@/libs/i18n/use-i18n';
import { useInventory } from '@/providers/inventory-provider';

type OnboardingTargetId =
  | 'tab-ingredients'
  | 'ingredients-tab-all'
  | 'ingredients-tab-my'
  | 'tab-cocktails'
  | 'cocktails-tab-my'
  | 'tab-shaker'
  | 'shaker-availability-toggle';

type Rect = { x: number; y: number; width: number; height: number };

type Step = {
  stepId: number;
  messageId: string;
  targetId?: OnboardingTargetId;
  buttonKey: 'onboarding.start' | 'onboarding.next' | 'onboarding.finish';
  route?: '/ingredients' | '/cocktails' | '/shaker';
  ingredientsTab?: 'all' | 'my';
  cocktailsTab?: 'my';
};

const STARTER_INGREDIENT_IDS = [196, 161, 352, 114, 316, 339, 219, 227] as const;

const STEPS: Step[] = [
  { stepId: 1, messageId: 'onboarding.step1.message', buttonKey: 'onboarding.start' },
  { stepId: 2, messageId: 'onboarding.step2.message', buttonKey: 'onboarding.next', targetId: 'tab-ingredients', route: '/ingredients' },
  { stepId: 3, messageId: 'onboarding.step3.message', buttonKey: 'onboarding.next', targetId: 'ingredients-tab-all', route: '/ingredients', ingredientsTab: 'all' },
  { stepId: 4, messageId: 'onboarding.step4.message', buttonKey: 'onboarding.next', targetId: 'ingredients-tab-my', route: '/ingredients', ingredientsTab: 'my' },
  { stepId: 5, messageId: 'onboarding.step5.message', buttonKey: 'onboarding.next', targetId: 'tab-cocktails', route: '/cocktails' },
  { stepId: 6, messageId: 'onboarding.step6.message', buttonKey: 'onboarding.next', targetId: 'cocktails-tab-my', route: '/cocktails', cocktailsTab: 'my' },
  { stepId: 7, messageId: 'onboarding.step7.message', buttonKey: 'onboarding.next', targetId: 'tab-shaker', route: '/shaker' },
  { stepId: 8, messageId: 'onboarding.step8.message', buttonKey: 'onboarding.next', route: '/shaker' },
  { stepId: 9, messageId: 'onboarding.step9.message', buttonKey: 'onboarding.next', targetId: 'shaker-availability-toggle', route: '/shaker' },
  { stepId: 10, messageId: 'onboarding.step10.message', buttonKey: 'onboarding.next', route: '/shaker' },
  { stepId: 11, messageId: 'onboarding.step11.message', buttonKey: 'onboarding.finish', targetId: 'ingredients-tab-all', route: '/ingredients', ingredientsTab: 'all' },
];

type OnboardingContextValue = {
  registerTarget: (id: OnboardingTargetId, node: RNView | null) => void;
  requestedIngredientsTab: 'all' | 'my' | null;
  requestedCocktailsTab: 'my' | null;
  shakerInStockOnly: boolean;
  consumeShakerInStockOnlyRequest: () => void;
  restartOnboarding: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const Colors = useAppColors();
  const { t } = useI18n();
  const {
    availableIngredientIds,
    setIngredientAvailability,
    onboardingCompleted,
    onboardingStep,
    onboardingStarterApplied,
    setOnboardingCompleted,
    setOnboardingStep,
    setOnboardingStarterApplied,
  } = useInventory();

  const [isActive, setIsActive] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [requestedIngredientsTab, setRequestedIngredientsTab] = useState<'all' | 'my' | null>(null);
  const [requestedCocktailsTab, setRequestedCocktailsTab] = useState<'my' | null>(null);
  const [shakerInStockOnly, setShakerInStockOnly] = useState(false);
  const targetsRef = useRef(new Map<OnboardingTargetId, RNView | null>());
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const step = STEPS.find((candidate) => candidate.stepId === onboardingStep) ?? STEPS[0];

  const registerTarget = useCallback((id: OnboardingTargetId, node: RNView | null) => {
    targetsRef.current.set(id, node);
  }, []);

  const measureTarget = useCallback((targetId: OnboardingTargetId, retries = 8) => {
    const node = targetsRef.current.get(targetId);
    if (!node || typeof node.measureInWindow !== 'function') {
      if (retries <= 0) {
        setRect(null);
        return;
      }
      setTimeout(() => measureTarget(targetId, retries - 1), 120);
      return;
    }

    node.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        setRect({ x, y, width, height });
        return;
      }
      if (retries <= 0) {
        setRect(null);
        return;
      }
      setTimeout(() => measureTarget(targetId, retries - 1), 120);
    });
  }, []);

  useEffect(() => {
    if (!onboardingCompleted) {
      setIsActive(true);
    }
  }, [onboardingCompleted]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    Keyboard.dismiss();
    if (step.route) {
      router.navigate(step.route);
    }
    if (step.ingredientsTab) {
      setRequestedIngredientsTab(step.ingredientsTab);
    }
    if (step.cocktailsTab) {
      setRequestedCocktailsTab(step.cocktailsTab);
    }

    if (step.targetId) {
      const timer = setTimeout(() => measureTarget(step.targetId!), 120);
      return () => clearTimeout(timer);
    }

    setRect(null);
    return undefined;
  }, [isActive, measureTarget, router, step]);

  const completeOnboarding = useCallback(() => {
    setOnboardingCompleted(true);
    setOnboardingStep(11);
    setIsActive(false);
  }, [setOnboardingCompleted, setOnboardingStep]);

  const restartOnboarding = useCallback(() => {
    setOnboardingCompleted(false);
    setOnboardingStep(1);
    setIsActive(true);
  }, [setOnboardingCompleted, setOnboardingStep]);

  const handleNext = useCallback(() => {
    if (step.stepId === 9) {
      setShakerInStockOnly(true);
    }

    if (step.stepId >= STEPS.length) {
      completeOnboarding();
      return;
    }

    setOnboardingStep(step.stepId + 1);
  }, [completeOnboarding, setOnboardingStep, step.stepId]);

  useEffect(() => {
    if (onboardingStarterApplied) {
      return;
    }

    let changed = false;
    STARTER_INGREDIENT_IDS.forEach((id) => {
      if (!availableIngredientIds.has(id)) {
        setIngredientAvailability(id, true);
        changed = true;
      }
    });

    if (changed || !onboardingStarterApplied) {
      setOnboardingStarterApplied(true);
    }
  }, [availableIngredientIds, onboardingStarterApplied, setIngredientAvailability, setOnboardingStarterApplied]);

  const contextValue = useMemo(
    () => ({
      registerTarget,
      requestedIngredientsTab,
      requestedCocktailsTab,
      shakerInStockOnly,
      consumeShakerInStockOnlyRequest: () => setShakerInStockOnly(false),
      restartOnboarding,
    }),
    [registerTarget, requestedIngredientsTab, requestedCocktailsTab, shakerInStockOnly, restartOnboarding],
  );

  const renderRichText = useCallback((message: string) => {
    const lines = message.split('\n');
    return lines.map((line, lineIndex) => {
      const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
      return (
        <Text key={`${line}-${lineIndex}`} style={[styles.message, { color: Colors.onSurface }]}> 
          {parts.map((part, idx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <Text key={`${idx}-b`} style={styles.bold}>
                  {part.slice(2, -2)}
                </Text>
              );
            }
            if (part.startsWith('*') && part.endsWith('*')) {
              return (
                <Text key={`${idx}-i`} style={styles.italic}>
                  {part.slice(1, -1)}
                </Text>
              );
            }
            return <Text key={`${idx}-t`}>{part}</Text>;
          })}
          {'\n'}
        </Text>
      );
    });
  }, [Colors.onSurface]);

  const tooltipAbove = rect ? rect.y + rect.height > screenHeight * 0.62 : false;
  const tooltipStyle = tooltipAbove
    ? { bottom: Math.max(screenHeight - (rect ? rect.y : 0) + 16, 32) }
    : { top: rect ? rect.y + rect.height + 16 : 120 };

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
      {isActive ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {rect ? (
            <>
              <View style={[styles.mask, { left: 0, top: 0, width: screenWidth, height: rect.y }]} />
              <View style={[styles.mask, { left: 0, top: rect.y, width: Math.max(rect.x, 0), height: rect.height }]} />
              <View style={[styles.mask, { left: rect.x + rect.width, top: rect.y, width: Math.max(screenWidth - rect.x - rect.width, 0), height: rect.height }]} />
              <View style={[styles.mask, { left: 0, top: rect.y + rect.height, width: screenWidth, height: Math.max(screenHeight - rect.y - rect.height, 0) }]} />
              <View style={[styles.spotlight, { left: rect.x - 4, top: rect.y - 4, width: rect.width + 8, height: rect.height + 8, borderColor: Colors.primary }]} pointerEvents="none" />
            </>
          ) : (
            <View style={[styles.mask, StyleSheet.absoluteFill]} />
          )}

          <View style={[styles.tooltip, { backgroundColor: Colors.surface }, tooltipStyle]}>
            <Text style={[styles.counter, { color: Colors.onSurfaceVariant }]}>
              {t('onboarding.stepCounter', { current: step.stepId, total: STEPS.length })}
            </Text>
            <View>{renderRichText(t(step.messageId))}</View>
            <View style={styles.actions}>
              {step.stepId < STEPS.length ? (
                <Pressable onPress={completeOnboarding} style={[styles.secondaryButton, { borderColor: Colors.outline }]}>
                  <Text style={{ color: Colors.onSurface }}>{t('onboarding.skip')}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={handleNext} style={[styles.primaryButton, { backgroundColor: Colors.primary }]}>
                <Text style={{ color: Colors.onPrimary, fontWeight: '600' }}>{t(step.buttonKey)}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </OnboardingContext.Provider>
  );
}

export function OnboardingTarget({ id, children }: { id: OnboardingTargetId; children: React.ReactNode }) {
  const { registerTarget } = useOnboarding();
  return (
    <View ref={(node) => registerTarget(id, node)} collapsable={false}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  mask: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  spotlight: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 14,
  },
  tooltip: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  counter: {
    fontSize: 12,
    fontWeight: '600',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  primaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
});
