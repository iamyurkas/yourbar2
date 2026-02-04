import React, { useMemo } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View, type LayoutRectangle } from 'react-native';

import { useAppColors } from '@/constants/theme';

type OnboardingOverlayProps = {
  visible: boolean;
  title: string;
  message: React.ReactNode;
  targets?: LayoutRectangle[];
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
};

export function OnboardingOverlay({
  visible,
  title,
  message,
  targets,
  actionLabel,
  onAction,
  actionDisabled = false,
  secondaryLabel,
  onSecondaryAction,
}: OnboardingOverlayProps) {
  const Colors = useAppColors();

  const highlightTargets = useMemo(
    () => (targets ?? []).filter((target) => target.width > 0 && target.height > 0),
    [targets],
  );
  const primaryTarget = highlightTargets[0];
  const windowHeight = Dimensions.get('window').height;

  const cardPosition = useMemo(() => {
    if (!primaryTarget) {
      return styles.cardBottom;
    }

    if (primaryTarget.y < windowHeight * 0.5) {
      return { top: primaryTarget.y + primaryTarget.height + 16, left: 16, right: 16 };
    }

    return { bottom: windowHeight - primaryTarget.y + 16, left: 16, right: 16 };
  }, [primaryTarget, windowHeight]);

  if (!visible) {
    return null;
  }

  const showPrimaryAction = Boolean(actionLabel && onAction);
  const showSecondaryAction = Boolean(secondaryLabel && onSecondaryAction);

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.backdrop, { backgroundColor: Colors.backdrop }]} pointerEvents="none" />
        {highlightTargets.map((target, index) => (
          <View
            key={`${target.x}-${target.y}-${index}`}
            pointerEvents="none"
            style={[
              styles.highlight,
              {
                left: target.x - 6,
                top: target.y - 6,
                width: target.width + 12,
                height: target.height + 12,
                borderColor: Colors.tint,
              },
            ]}
          />
        ))}
        <View
          style={[
            styles.card,
            {
              backgroundColor: Colors.surface,
              borderColor: Colors.outline,
              shadowColor: Colors.shadow,
            },
            cardPosition,
          ]}
        >
          <Text style={[styles.title, { color: Colors.onSurface }]}>{title}</Text>
          <View style={styles.messageWrapper}>
            <Text style={[styles.message, { color: Colors.onSurfaceVariant }]}>{message}</Text>
          </View>
          {showPrimaryAction || showSecondaryAction ? (
            <View style={styles.actions}>
              {showSecondaryAction ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={secondaryLabel}
                  onPress={onSecondaryAction}
                  style={[
                    styles.actionButton,
                    { backgroundColor: Colors.surfaceVariant, borderColor: Colors.outlineVariant },
                  ]}
                >
                  <Text style={[styles.actionLabel, { color: Colors.onSurface }]}>{secondaryLabel}</Text>
                </Pressable>
              ) : null}
              {showPrimaryAction ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={actionLabel}
                  onPress={onAction}
                  disabled={actionDisabled}
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor: actionDisabled ? Colors.surfaceVariant : Colors.tint,
                      borderColor: actionDisabled ? Colors.outlineVariant : Colors.tint,
                    },
                    actionDisabled ? styles.actionDisabled : null,
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
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.68,
  },
  highlight: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 16,
  },
  card: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  cardBottom: {
    left: 16,
    right: 16,
    bottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  messageWrapper: {
    gap: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'column',
    gap: 10,
  },
  actionButton: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: {
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 15,
  },
  actionDisabled: {
    opacity: 0.85,
  },
});
