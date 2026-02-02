import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppColors } from '@/constants/theme';

export type DialogAction = {
  label: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  variant?: 'primary' | 'secondary' | 'destructive';
};

export type DialogOptions = {
  title: string;
  message?: string;
  actions: DialogAction[];
};

type AppDialogProps = DialogOptions & {
  visible: boolean;
  onRequestClose?: () => void;
};

export function AppDialog({ visible, title, message, actions, onRequestClose }: AppDialogProps) {
  const colors = useAppColors();

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <Pressable
        style={[styles.overlay, { backgroundColor: colors.backdrop }]}
        onPress={onRequestClose}
        accessibilityRole="button"
        accessibilityLabel="Close dialog">
        <Pressable
          style={[styles.card, { backgroundColor: colors.surface }]}
          onPress={(event) => event.stopPropagation()}>
          <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
          {message ? <Text style={[styles.message, { color: colors.onSurfaceVariant }]}>{message}</Text> : null}
          <View style={styles.actions}>
            {actions.map((action, index) => {
              const { backgroundColor, borderColor, textColor } = getActionColors(action.variant, colors);

              return (
                <Pressable
                  key={`${action.label}-${index}`}
                  onPress={() => {
                    onRequestClose?.();
                    action.onPress?.();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={action.accessibilityLabel ?? action.label}
                  style={[styles.actionButton, { backgroundColor, borderColor }]}
                  hitSlop={4}>
                  <Text style={[styles.actionLabel, { color: textColor }]}>{action.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function getActionColors(variant: DialogAction['variant'], colors: ReturnType<typeof useAppColors>) {
  switch (variant) {
    case 'secondary':
      return {
        backgroundColor: colors.surfaceVariant,
        borderColor: colors.outlineVariant,
        textColor: colors.onSurface,
      } as const;
    case 'destructive':
      return {
        backgroundColor: colors.error,
        borderColor: colors.error,
        textColor: colors.onError,
      } as const;
    default:
      return {
        backgroundColor: colors.tint,
        borderColor: colors.tint,
        textColor: colors.onPrimary,
      } as const;
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    paddingVertical: 22,
    paddingHorizontal: 20,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  actions: {
    marginTop: 4,
    flexDirection: 'column',
    gap: 12,
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
});
