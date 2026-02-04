import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppColors } from '@/constants/theme';

type OnboardingCardProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  stepIndex?: number;
  stepCount?: number;
};

export function OnboardingCard({
  title,
  message,
  actionLabel,
  onAction,
  actionDisabled = false,
  stepIndex,
  stepCount,
}: OnboardingCardProps) {
  const Colors = useAppColors();
  const showStepIndicator = Number.isFinite(stepIndex) && Number.isFinite(stepCount);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: Colors.surface,
          borderColor: Colors.outline,
          shadowColor: Colors.shadow,
        },
      ]}
      accessibilityRole="summary"
    >
      <Text style={[styles.title, { color: Colors.onSurface }]}>{title}</Text>
      <Text style={[styles.message, { color: Colors.onSurfaceVariant }]}>{message}</Text>
      {actionLabel ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          disabled={actionDisabled}
          style={({ pressed }) => [
            styles.actionButton,
            {
              backgroundColor: actionDisabled ? Colors.surfaceVariant : Colors.tint,
            },
            pressed && !actionDisabled ? styles.actionButtonPressed : null,
          ]}
        >
          <Text
            style={[
              styles.actionLabel,
              { color: actionDisabled ? Colors.onSurfaceVariant : Colors.onPrimary },
            ]}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
      {showStepIndicator ? (
        <Text style={[styles.stepIndicator, { color: Colors.onSurfaceVariant }]}>
          {stepIndex} / {stepCount}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionButton: {
    marginTop: 12,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionButtonPressed: {
    opacity: 0.85,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepIndicator: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});
