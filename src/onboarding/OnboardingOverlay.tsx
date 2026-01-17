import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useOnboarding } from '@/src/onboarding/OnboardingProvider';
import { getTargetRect, subscribeToTargetRegistry } from '@/src/onboarding/target-registry';

const TOOLTIP_WIDTH = 280;
const TARGET_PADDING = 8;

export function OnboardingOverlay() {
  const { isActive, currentStepIndex, steps, next } = useOnboarding();
  const step = steps[currentStepIndex];
  const targetId = step?.targetId;
  const [targetRect, setTargetRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [isResolvingTarget, setIsResolvingTarget] = useState(false);

  const screen = Dimensions.get('window');
  const totalSteps = steps.length;
  const stepNumber = currentStepIndex + 1;

  const resolveTarget = useCallback(async () => {
    if (!targetId) {
      setTargetRect(null);
      setIsResolvingTarget(false);
      return;
    }

    setIsResolvingTarget(true);
    const rect = await getTargetRect(targetId);
    setTargetRect(rect);
    setIsResolvingTarget(false);
  }, [targetId]);

  useEffect(() => {
    void resolveTarget();
  }, [resolveTarget]);

  useEffect(() => {
    if (!targetId) {
      return;
    }

    const unsubscribe = subscribeToTargetRegistry(() => {
      void resolveTarget();
    });
    return unsubscribe;
  }, [resolveTarget, targetId]);

  const tooltipStyle = useMemo(() => {
    const offsetY = step?.tooltipOffsetY ?? 0;
    if (!targetRect) {
      return {
        left: (screen.width - TOOLTIP_WIDTH) / 2,
        top: screen.height * 0.35 + offsetY,
      };
    }

    const preferredLeft = targetRect.x + targetRect.width / 2 - TOOLTIP_WIDTH / 2;
    const clampedLeft = Math.max(16, Math.min(preferredLeft, screen.width - TOOLTIP_WIDTH - 16));
    const top = Math.min(
      targetRect.y + targetRect.height + 16 + offsetY,
      screen.height - 200,
    );

    return {
      left: clampedLeft,
      top,
    };
  }, [screen.height, screen.width, step?.tooltipOffsetY, targetRect]);

  if (!isActive || !step) {
    return null;
  }

  const isLastStep = stepNumber >= totalSteps;
  const isTargetReady = Boolean(targetRect);
  const showLoading = Boolean(targetId) && !isTargetReady;

  const paddedTarget = useMemo(() => {
    if (!targetRect) {
      return null;
    }

    const offsetY = step?.spotlightOffsetY ?? 0;
    const x = Math.max(0, targetRect.x - TARGET_PADDING);
    const y = Math.max(0, targetRect.y - TARGET_PADDING + offsetY);
    const width = Math.min(screen.width, targetRect.width + TARGET_PADDING * 2);
    const height = Math.min(screen.height, targetRect.height + TARGET_PADDING * 2);

    return {
      x,
      y,
      width,
      height,
    };
  }, [screen.height, screen.width, step?.spotlightOffsetY, targetRect]);

  return (
    <View pointerEvents="auto" style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFillObject} onPress={() => {}} />
      {paddedTarget ? (
        <>
          <View style={[styles.dimPane, { top: 0, left: 0, right: 0, height: paddedTarget.y }]} />
          <View
            style={[
              styles.dimPane,
              {
                top: paddedTarget.y,
                left: 0,
                width: paddedTarget.x,
                height: paddedTarget.height,
              },
            ]}
          />
          <View
            style={[
              styles.dimPane,
              {
                top: paddedTarget.y,
                left: paddedTarget.x + paddedTarget.width,
                right: 0,
                height: paddedTarget.height,
              },
            ]}
          />
          <View
            style={[
              styles.dimPane,
              {
                top: paddedTarget.y + paddedTarget.height,
                left: 0,
                right: 0,
                bottom: 0,
              },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.spotlight,
              {
                left: paddedTarget.x,
                top: paddedTarget.y,
                width: paddedTarget.width,
                height: paddedTarget.height,
              },
            ]}
          />
        </>
      ) : (
        <View style={styles.backdrop} />
      )}
      <View style={[styles.tooltip, { backgroundColor: Colors.surface }, tooltipStyle]}>
        {step.title ? (
          <Text style={[styles.title, { color: Colors.onSurface }]}>{step.title}</Text>
        ) : null}
        <Text style={[styles.body, { color: Colors.onSurfaceVariant }]}>
          {showLoading ? 'Loading…' : step.body}
        </Text>
        <Text style={[styles.stepIndicator, { color: Colors.onSurfaceVariant }]}>
          Step {stepNumber} / {totalSteps}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isLastStep ? 'Finish onboarding' : 'Next onboarding step'}
          onPress={next}
          disabled={showLoading || isResolvingTarget}
          style={({ pressed }) => [
            styles.nextButton,
            { backgroundColor: Colors.primary },
            pressed ? { opacity: 0.8 } : null,
            showLoading || isResolvingTarget ? { opacity: 0.5 } : null,
          ]}>
          <Text style={[styles.nextButtonLabel, { color: Colors.onPrimary }]}>
            {isLastStep ? 'Finish' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  dimPane: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  spotlight: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.tint,
  },
  tooltip: {
    position: 'absolute',
    width: TOOLTIP_WIDTH,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  stepIndicator: {
    marginTop: 8,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  nextButton: {
    marginTop: 16,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  nextButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
