import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { ONBOARDING_STEPS } from './onboarding-steps';
import { useOnboarding } from './OnboardingProvider';
import { getTargetRect } from './target-registry';
import type { OnboardingTargetAnchor } from './onboarding-types';

export function OnboardingOverlay() {
  const { isActive, currentStepIndex, next, prev } = useOnboarding();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const step = ONBOARDING_STEPS[currentStepIndex];
  const [targetRect, setTargetRect] = useState<OnboardingTargetAnchor | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);

  const stepLabel = useMemo(() => {
    const stepNumber = Math.min(currentStepIndex + 1, ONBOARDING_STEPS.length);
    return `Step ${stepNumber} / ${ONBOARDING_STEPS.length}`;
  }, [currentStepIndex]);

  useEffect(() => {
    let isCancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const measure = async () => {
      if (!step?.targetId) {
        setTargetRect(null);
        setIsMeasuring(false);
        return;
      }

      setIsMeasuring(true);
      const rect = await getTargetRect(step.targetId);
      if (isCancelled) {
        return;
      }

      setTargetRect(rect);
      setIsMeasuring(rect == null);
      if (!rect && isActive) {
        timeoutId = setTimeout(measure, 250);
      }
    };

    if (isActive) {
      void measure();
    } else {
      setTargetRect(null);
      setIsMeasuring(false);
    }

    return () => {
      isCancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isActive, step?.targetId]);

  const isTargetRequired = Boolean(step?.targetId);
  const isTargetReady = !isTargetRequired || Boolean(targetRect);
  const isNextDisabled = !isTargetReady;
  const shouldShowBack = currentStepIndex > 0 && prev;

  const highlightPadding = 8;
  const hole = targetRect
    ? {
        x: Math.max(0, targetRect.x - highlightPadding),
        y: Math.max(0, targetRect.y - highlightPadding),
        width: Math.min(windowWidth, targetRect.x + targetRect.width + highlightPadding) -
          Math.max(0, targetRect.x - highlightPadding),
        height: Math.min(windowHeight, targetRect.y + targetRect.height + highlightPadding) -
          Math.max(0, targetRect.y - highlightPadding),
      }
    : null;

  const tooltipTitle = isTargetReady ? step?.title : 'Loading…';
  const tooltipDescription = isTargetReady ? step?.text : 'Waiting for this screen to load.';
  const tooltipStyle = useMemo(() => {
    if (!hole) {
      return styles.spotlightCardCentered;
    }

    const placeBelow = hole.y + hole.height < windowHeight * 0.6;
    const topOffset = placeBelow ? hole.y + hole.height + 16 : Math.max(24, hole.y - 220);

    return {
      position: 'absolute',
      top: topOffset,
      left: 24,
      right: 24,
    } as const;
  }, [hole, windowHeight]);

  if (!isActive || !step) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="auto">
      {hole ? (
        <>
          <Pressable
            accessibilityRole="none"
            onPress={() => {}}
            style={[styles.overlayPane, { top: 0, left: 0, right: 0, height: hole.y }]}
          />
          <Pressable
            accessibilityRole="none"
            onPress={() => {}}
            style={[
              styles.overlayPane,
              { top: hole.y + hole.height, left: 0, right: 0, bottom: 0 },
            ]}
          />
          <Pressable
            accessibilityRole="none"
            onPress={() => {}}
            style={[
              styles.overlayPane,
              { top: hole.y, left: 0, width: hole.x, height: hole.height },
            ]}
          />
          <Pressable
            accessibilityRole="none"
            onPress={() => {}}
            style={[
              styles.overlayPane,
              {
                top: hole.y,
                left: hole.x + hole.width,
                right: 0,
                height: hole.height,
              },
            ]}
          />
          <Pressable
            accessibilityRole="none"
            onPress={() => {}}
            style={[
              styles.holeOutline,
              {
                top: hole.y,
                left: hole.x,
                width: hole.width,
                height: hole.height,
              },
            ]}
          />
        </>
      ) : (
        <Pressable accessibilityRole="none" onPress={() => {}} style={styles.overlayPane} />
      )}
      <SafeAreaView style={styles.content} pointerEvents="box-none">
        <View style={[styles.spotlightCard, tooltipStyle]}>
          {tooltipTitle ? <Text style={styles.title}>{tooltipTitle}</Text> : null}
          <Text style={styles.description}>{tooltipDescription}</Text>
          <Text style={styles.stepLabel}>{stepLabel}</Text>
          <View style={styles.buttonRow}>
            {shouldShowBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous onboarding step"
                onPress={prev}
                style={({ pressed }) => [styles.backButton, pressed ? styles.backButtonPressed : null]}>
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isMeasuring ? 'Loading next onboarding step' : 'Next onboarding step'}
              disabled={isNextDisabled}
              onPress={next}
              style={({ pressed }) => [
                styles.nextButton,
                isNextDisabled ? styles.nextButtonDisabled : null,
                pressed && !isNextDisabled ? styles.nextButtonPressed : null,
              ]}>
              <Text style={styles.nextButtonText}>Next</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayPane: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  holeOutline: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  content: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  spotlightCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    width: '100%',
    maxWidth: 420,
  },
  spotlightCardCentered: {
    alignSelf: 'center',
    marginHorizontal: 24,
  },
  title: {
    color: Colors.onSurface,
    fontSize: 20,
    fontWeight: '600',
  },
  description: {
    color: Colors.onSurfaceVariant,
    fontSize: 15,
    lineHeight: 20,
  },
  stepLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  backButtonPressed: {
    opacity: 0.8,
  },
  backButtonText: {
    color: Colors.onSurface,
    fontWeight: '600',
    fontSize: 15,
  },
  nextButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  nextButtonPressed: {
    opacity: 0.8,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: Colors.onPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
});
