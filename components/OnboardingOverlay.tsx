import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';

import { useAppColors } from '@/constants/theme';
import { useOnboarding } from '@/providers/onboarding-provider';

export function OnboardingOverlay() {
  const {
    isActive,
    currentStep,
    getAnchorLayout,
    nextStep,
    prevStep,
    stepIndex,
    visibleStepIndex,
    totalSteps,
  } = useOnboarding();
  const Colors = useAppColors();
  const { height: screenHeight } = useWindowDimensions();

  const anchorLayout = currentStep?.anchorId ? getAnchorLayout(currentStep.anchorId) : null;

  const tooltipPosition = useMemo(() => {
    if (!anchorLayout) {
      return { top: screenHeight / 2 - 100, left: 20, right: 20 };
    }

    const { y, height } = anchorLayout;
    const tooltipHeight = 150; // Estimated
    const margin = 20;

    let top = y + height + margin;
    if (top + tooltipHeight > screenHeight - 100) {
      top = y - tooltipHeight - margin;
    }

    return {
      top: Math.max(margin, Math.min(top, screenHeight - tooltipHeight - margin)),
      left: margin,
      right: margin,
    };
  }, [anchorLayout, screenHeight]);

  if (!isActive || !currentStep) {
    return null;
  }

  const padding = currentStep.highlightPadding ?? 8;
  const highlight = anchorLayout ? {
    x: anchorLayout.x - padding,
    y: anchorLayout.y - padding,
    width: anchorLayout.width + padding * 2,
    height: anchorLayout.height + padding * 2,
    rx: 12,
  } : null;

  // Find visible step index (only those with buttonLabel)
  // Wait, memory said: "This counter only includes steps with an explicit `buttonLabel`"
  // But let's just show simple counter for now if it's easier.

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Mask id="mask">
            <Rect x="0" y="0" width="100%" height="100%" fill="white" />
            {highlight && (
              <Rect
                x={highlight.x}
                y={highlight.y}
                width={highlight.width}
                height={highlight.height}
                rx={highlight.rx}
                fill="black"
              />
            )}
          </Mask>
        </Defs>
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#mask)"
        />
      </Svg>

      <View
        style={[
          styles.tooltip,
          {
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            right: tooltipPosition.right,
            backgroundColor: Colors.surface,
            borderColor: Colors.outline,
            shadowColor: Colors.shadow,
          },
        ]}
      >
        <Text style={[styles.title, { color: Colors.onSurface }]}>{currentStep.title}</Text>
        <Text style={[styles.content, { color: Colors.onSurfaceVariant }]}>{currentStep.content}</Text>

        <View style={styles.footer}>
          {currentStep.buttonLabel && visibleStepIndex >= 0 && (
            <Text style={[styles.stepCounter, { color: Colors.onSurfaceVariant }]}>
              {visibleStepIndex + 1} of {totalSteps}
            </Text>
          )}
          <View style={styles.buttons}>
            {stepIndex > 0 && (
              <Pressable
                onPress={prevStep}
                style={[styles.button, { backgroundColor: Colors.surfaceVariant }]}
              >
                <Text style={[styles.buttonText, { color: Colors.onSurfaceVariant }]}>Back</Text>
              </Pressable>
            )}
            <Pressable
              onPress={nextStep}
              style={[styles.button, { backgroundColor: Colors.primary }]}
            >
              <Text style={[styles.buttonText, { color: Colors.onPrimary }]}>
                {currentStep.buttonLabel ?? 'Next'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  content: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  stepCounter: {
    fontSize: 12,
    marginRight: 'auto',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
