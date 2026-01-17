import React, { useMemo } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useOnboarding } from '@/src/onboarding/OnboardingProvider';

const TOOLTIP_WIDTH = 280;

export function OnboardingOverlay() {
  const { isActive, currentStepIndex, steps, next, targetLayouts } = useOnboarding();
  const step = steps[currentStepIndex];

  const screen = Dimensions.get('window');
  const totalSteps = steps.length;
  const stepNumber = currentStepIndex + 1;

  const target = step?.targetId ? targetLayouts[step.targetId] : undefined;

  const tooltipStyle = useMemo(() => {
    if (!target) {
      return {
        left: (screen.width - TOOLTIP_WIDTH) / 2,
        top: screen.height * 0.35,
      };
    }

    const preferredLeft = target.layout.x + target.layout.width / 2 - TOOLTIP_WIDTH / 2;
    const clampedLeft = Math.max(16, Math.min(preferredLeft, screen.width - TOOLTIP_WIDTH - 16));
    const top = Math.min(
      target.layout.y + target.layout.height + 16,
      screen.height - 200,
    );

    return {
      left: clampedLeft,
      top,
    };
  }, [screen.height, screen.width, target]);

  if (!isActive || !step) {
    return null;
  }

  const isLastStep = stepNumber >= totalSteps;

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View style={styles.backdrop} />
      {target ? (
        <View
          pointerEvents="none"
          style={[
            styles.spotlight,
            {
              left: target.layout.x - 8,
              top: target.layout.y - 8,
              width: target.layout.width + 16,
              height: target.layout.height + 16,
            },
          ]}
        />
      ) : null}
      <View style={[styles.tooltip, { backgroundColor: Colors.surface }, tooltipStyle]}>
        <Text style={[styles.title, { color: Colors.onSurface }]}>{step.title}</Text>
        <Text style={[styles.body, { color: Colors.onSurfaceVariant }]}>{step.body}</Text>
        <Text style={[styles.stepIndicator, { color: Colors.onSurfaceVariant }]}>
          Step {stepNumber} of {totalSteps}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isLastStep ? 'Finish onboarding' : 'Next onboarding step'}
          onPress={next}
          style={({ pressed }) => [
            styles.nextButton,
            { backgroundColor: Colors.primary },
            pressed ? { opacity: 0.8 } : null,
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

