import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useOnboarding } from '@/src/onboarding/OnboardingProvider';
import { getTargetRect, type TargetRect } from '@/src/onboarding/target-registry';

const HOLE_PADDING = 8;
const TOOLTIP_MARGIN = 16;
const TOOLTIP_GAP = 12;
const DEFAULT_TOOLTIP_HEIGHT = 180;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function OnboardingOverlay() {
  const { isActive, currentStepIndex, steps, next, prev } = useOnboarding();
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isTargetReady, setIsTargetReady] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const currentStep = steps[currentStepIndex];

  useEffect(() => {
    if (!isActive || !currentStep) {
      setTargetRect(null);
      setIsTargetReady(false);
      return;
    }

    let isMounted = true;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const resolveTarget = async () => {
      const rect = await getTargetRect(currentStep.targetId);

      if (!isMounted) {
        return;
      }

      if (rect) {
        setTargetRect(rect);
        setIsTargetReady(true);
      } else {
        setTargetRect(null);
        setIsTargetReady(false);
        timeout = setTimeout(resolveTarget, 150);
      }
    };

    resolveTarget();

    return () => {
      isMounted = false;
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [currentStep, isActive]);

  const spotlightRect = useMemo(() => {
    if (!targetRect) {
      return null;
    }

    const paddedX = Math.max(0, targetRect.x - HOLE_PADDING);
    const paddedY = Math.max(0, targetRect.y - HOLE_PADDING);
    const paddedWidth = Math.min(width - paddedX, targetRect.width + HOLE_PADDING * 2);
    const paddedHeight = Math.min(height - paddedY, targetRect.height + HOLE_PADDING * 2);

    return {
      x: paddedX,
      y: paddedY,
      width: paddedWidth,
      height: paddedHeight,
    };
  }, [height, targetRect, width]);

  const tooltipLayout = useMemo(() => {
    if (!currentStep || !spotlightRect) {
      return {
        width: Math.min(320, width - TOOLTIP_MARGIN * 2),
        left: TOOLTIP_MARGIN,
        top: height / 2 - DEFAULT_TOOLTIP_HEIGHT / 2,
      };
    }

    const tooltipWidth = Math.min(320, width - TOOLTIP_MARGIN * 2);
    const centerX = spotlightRect.x + spotlightRect.width / 2;
    const left = clamp(centerX - tooltipWidth / 2, TOOLTIP_MARGIN, width - tooltipWidth - TOOLTIP_MARGIN);
    const belowTop = spotlightRect.y + spotlightRect.height + TOOLTIP_GAP;
    const top = Math.max(belowTop, insets.top + TOOLTIP_MARGIN);

    return {
      width: tooltipWidth,
      left,
      top,
    };
  }, [currentStep, insets.top, spotlightRect, width]);

  if (!isActive || !currentStep) {
    return null;
  }

  const stepNumber = currentStepIndex + 1;
  const totalSteps = steps.length;
  const canGoBack = currentStepIndex > 0;
  const titleText = isTargetReady ? currentStep.title ?? 'Onboarding' : 'Loading…';
  const descriptionText = isTargetReady ? currentStep.description : 'Preparing this step.';

  return (
    <View style={styles.overlay} pointerEvents="auto">
      {spotlightRect ? (
        <>
          <View
            style={[
              styles.dim,
              {
                left: 0,
                right: 0,
                top: 0,
                height: spotlightRect.y,
              },
            ]}
          />
          <View
            style={[
              styles.dim,
              {
                left: 0,
                right: 0,
                top: spotlightRect.y + spotlightRect.height,
                height: height - (spotlightRect.y + spotlightRect.height),
              },
            ]}
          />
          <View
            style={[
              styles.dim,
              {
                left: 0,
                top: spotlightRect.y,
                height: spotlightRect.height,
                width: spotlightRect.x,
              },
            ]}
          />
          <View
            style={[
              styles.dim,
              {
                right: 0,
                top: spotlightRect.y,
                left: spotlightRect.x + spotlightRect.width,
                height: spotlightRect.height,
              },
            ]}
          />
          <View
            style={[
              styles.spotlightBorder,
              {
                left: spotlightRect.x,
                top: spotlightRect.y,
                width: spotlightRect.width,
                height: spotlightRect.height,
              },
            ]}
          />
        </>
      ) : (
        <View style={styles.dimFull} />
      )}
      <View
        style={[
          styles.tooltip,
          {
            width: tooltipLayout.width,
            left: tooltipLayout.left,
            top: tooltipLayout.top,
            backgroundColor: Colors.surface,
            borderColor: Colors.outline,
            shadowColor: Colors.shadow,
          },
        ]}>
        <Text style={[styles.tooltipTitle, { color: Colors.onSurface }]}>{titleText}</Text>
        <Text style={[styles.tooltipBody, { color: Colors.onSurfaceVariant }]}>
          {descriptionText}
        </Text>
        <Text style={[styles.stepIndicator, { color: Colors.onSurfaceVariant }]}>
          Step {stepNumber} / {totalSteps}
        </Text>
        <View style={styles.buttonRow}>
          {canGoBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go to previous step"
              onPress={prev}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: Colors.outline },
                pressed ? styles.buttonPressed : null,
              ]}>
              <Text style={[styles.secondaryButtonText, { color: Colors.onSurface }]}>Back</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next step"
            disabled={!isTargetReady}
            onPress={next}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: isTargetReady ? Colors.tint : Colors.outline },
              pressed ? styles.buttonPressed : null,
            ]}>
            <Text style={[styles.primaryButtonText, { color: '#FFFFFF' }]}>
              {currentStep.nextLabel ?? 'Next'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
  dim: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  dimFull: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  spotlightBorder: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.tint,
  },
  tooltip: {
    position: 'absolute',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  tooltipBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  stepIndicator: {
    fontSize: 12,
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  primaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
