import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const Colors = useAppColors();

  if (!visible) {
    return null;
  }

  const getActionColors = (variant: DialogAction['variant']) => {
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
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <Pressable
        style={[styles.overlay, { backgroundColor: Colors.backdrop }]}
        onPress={onRequestClose}
        accessibilityRole="button"
        accessibilityLabel={t('ui.ok')}>
        <Pressable
          style={[styles.card, { backgroundColor: Colors.surface }]}
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
