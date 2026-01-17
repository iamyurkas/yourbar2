import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Colors } from '@/constants/theme';

import { useOnboarding } from './OnboardingProvider';
import {
  getTargetRectSync,
  measureTargetRect,
  subscribeToTargetRegistry,
  type TargetRect,
} from './target-registry';

export function OnboardingOverlay() {
  const { isActive, currentStep, currentStepIndex, steps, next, prev, stop } = useOnboarding();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);

  useEffect(() => {
    if (!currentStep?.targetId) {
      setTargetRect(null);
      setIsMeasuring(false);
      return;
    }

    const targetId = currentStep.targetId;
    const update = () => {
      const rect = getTargetRectSync(targetId);
      setTargetRect(rect);
      if (!rect) {
        setIsMeasuring(true);
        void measureTargetRect(targetId).finally(() => setIsMeasuring(false));
      }
    };

    update();
    const unsubscribe = subscribeToTargetRegistry(update);

    return unsubscribe;
  }, [currentStep?.targetId, windowHeight, windowWidth]);

  if (!isActive || !currentStep) {
    return null;
  }

  const hasTarget = Boolean(currentStep.targetId);
  const isLoading = hasTarget && !targetRect;
  const isNextDisabled = isLoading || isMeasuring;
  const tooltipPosition = useMemo(() => {
    const padding = 24;
    if (!targetRect) {
      return {
        position: 'absolute' as const,
        top: windowHeight * 0.35,
        left: padding,
        right: padding,
        maxWidth: 360,
        alignSelf: 'center' as const,
      };
    }

    const tooltipHeightEstimate = 180;
    const belowTop = targetRect.y + targetRect.height + 16;
    const aboveTop = Math.max(padding, targetRect.y - tooltipHeightEstimate - 16);
    const top =
      belowTop + tooltipHeightEstimate < windowHeight - padding ? belowTop : aboveTop;

    return {
      position: 'absolute' as const,
      top,
      left: padding,
      right: padding,
      maxWidth: 360,
    };
  }, [targetRect, windowHeight]);

  const overlayPanes = useMemo(() => {
    if (!targetRect) {
      return (
        <View style={[styles.overlayFill, { backgroundColor: Colors.backdrop }]} pointerEvents="auto" />
      );
    }

    const inset = 8;
    const hole = {
      x: Math.max(0, targetRect.x - inset),
      y: Math.max(0, targetRect.y - inset),
      width: targetRect.width + inset * 2,
      height: targetRect.height + inset * 2,
    };

    return (
      <>
        <View
          style={[
            styles.overlayPane,
            {
              left: 0,
              top: 0,
              width: windowWidth,
              height: hole.y,
              backgroundColor: Colors.backdrop,
            },
          ]}
        />
        <View
          style={[
            styles.overlayPane,
            {
              left: 0,
              top: hole.y,
              width: hole.x,
              height: hole.height,
              backgroundColor: Colors.backdrop,
            },
          ]}
        />
        <View
          style={[
            styles.overlayPane,
            {
              left: hole.x + hole.width,
              top: hole.y,
              width: windowWidth - (hole.x + hole.width),
              height: hole.height,
              backgroundColor: Colors.backdrop,
            },
          ]}
        />
        <View
          style={[
            styles.overlayPane,
            {
              left: 0,
              top: hole.y + hole.height,
              width: windowWidth,
              height: windowHeight - (hole.y + hole.height),
              backgroundColor: Colors.backdrop,
            },
          ]}
        />
        <View
          style={[
            styles.spotlight,
            {
              left: hole.x,
              top: hole.y,
              width: hole.width,
              height: hole.height,
              borderColor: Colors.tint,
            },
          ]}
          pointerEvents="none"
          testID="onboarding-spotlight"
        />
      </>
    );
  }, [Colors.backdrop, Colors.tint, targetRect, windowHeight, windowWidth]);

  const accessibilityLabel = `${currentStep.title ? `${currentStep.title}. ` : ''}${currentStep.text}`;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="auto"
      accessibilityViewIsModal
      accessibilityLabel={accessibilityLabel}
      accessible
    >
      <Pressable onPress={() => {}} style={StyleSheet.absoluteFill} />
      {overlayPanes}
      <View style={styles.content} pointerEvents="box-none">
        <View
          style={[styles.tooltip, { backgroundColor: Colors.surface }, tooltipPosition]}
          testID="onboarding-tooltip"
          accessible
          accessibilityLabel={accessibilityLabel}
        >
          {currentStep.title ? (
            <Text accessibilityRole="header" style={[styles.title, { color: Colors.onSurface }]}>
              {currentStep.title}
            </Text>
          ) : null}
          <Text style={[styles.description, { color: Colors.onSurfaceVariant }]}>
            {isLoading ? 'Loading…' : currentStep.text}
          </Text>
          <Text style={[styles.stepCount, { color: Colors.onSurfaceVariant }]}>
            Step {currentStepIndex + 1} / {steps.length}
          </Text>
          <View style={styles.actions}>
            {currentStepIndex > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous step"
                onPress={prev}
                style={[styles.secondaryButton, { borderColor: Colors.outline }]}
                testID="onboarding-back"
              >
                <Text style={[styles.secondaryButtonText, { color: Colors.onSurfaceVariant }]}>Back</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding"
              onPress={() => stop(false)}
              style={[styles.secondaryButton, { borderColor: Colors.outline }]}
              testID="onboarding-skip"
            >
              <Text style={[styles.secondaryButtonText, { color: Colors.onSurfaceVariant }]}>Skip</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="End onboarding"
              onPress={() => stop(false)}
              style={[styles.secondaryButton, { borderColor: Colors.outline }]}
              testID="onboarding-exit"
            >
              <Text style={[styles.secondaryButtonText, { color: Colors.onSurfaceVariant }]}>Exit</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next step"
              onPress={next}
              disabled={isNextDisabled}
              style={[
                styles.primaryButton,
                { backgroundColor: Colors.tint },
                isNextDisabled ? styles.primaryButtonDisabled : null,
              ]}
              testID="onboarding-next"
            >
              <Text style={[styles.primaryButtonText, { color: Colors.onSurface }]}>Next</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayPane: {
    position: 'absolute',
    opacity: 0.7,
  },
  overlayFill: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.7,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 24,
  },
  spotlight: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 2,
  },
  tooltip: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  stepCount: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  primaryButton: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButton: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
