import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

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
  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <Pressable
        style={styles.overlay}
        onPress={onRequestClose}
        accessibilityRole="button"
        accessibilityLabel="Close dialog">
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: Colors.surface,
              borderColor: Colors.outline,
              shadowColor: Colors.shadow,
            },
          ]}
          onPress={(event) => event.stopPropagation()}>
          <Text style={[styles.title, { color: Colors.onSurface }]}>{title}</Text>
          {message ? <Text style={[styles.message, { color: Colors.onSurfaceVariant }]}>{message}</Text> : null}
          <View style={styles.actions}>
            {actions.map((action, index) => {
              const { backgroundColor, borderColor, textColor } = getActionColors(action.variant);

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

function getActionColors(variant: DialogAction['variant']) {
  switch (variant) {
    case 'secondary':
      return {
        backgroundColor: Colors.surfaceVariant,
        borderColor: Colors.outlineVariant,
        textColor: Colors.onSurface,
      } as const;
    case 'destructive':
      return {
        backgroundColor: Colors.error,
        borderColor: Colors.error,
        textColor: Colors.onError,
      } as const;
    default:
      return {
        backgroundColor: Colors.tint,
        borderColor: Colors.tint,
        textColor: Colors.onPrimary,
      } as const;
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    paddingTop: 12,
    paddingRight: 16,
    paddingBottom: 20,
    paddingLeft: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
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
