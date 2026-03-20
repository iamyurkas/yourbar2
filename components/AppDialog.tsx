import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppColors } from '@/constants/theme';
import { useI18n } from '@/libs/i18n/use-i18n';

import { FormattedText } from './FormattedText';

export type DialogAction = {
  label: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  variant?: 'primary' | 'secondary' | 'destructive';
  disableOnPress?: boolean;
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
  const Colors = useAppColors();
  const { t } = useI18n();
  const normalizedMessage = message?.replace(/\\n/g, '\n');
  const [disabledActionIndices, setDisabledActionIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!visible) {
      setDisabledActionIndices(new Set());
    }
  }, [visible]);

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
      case 'primary':
        return {
          backgroundColor: Colors.tint,
          borderColor: Colors.tint,
          textColor: Colors.onPrimary,
        } as const;
      default:
        return {
          backgroundColor: Colors.surfaceVariant,
          borderColor: Colors.outlineVariant,
          textColor: Colors.onSurface,
        } as const;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <Pressable
        style={[styles.overlay, { backgroundColor: Colors.backdrop }]}
        onPress={onRequestClose}
        accessibilityRole="button"
        accessibilityLabel={t("appDialog.closeDialog")}>
        <Pressable
          style={[styles.card, { backgroundColor: Colors.surface }]}
          onPress={(event) => event.stopPropagation()}>
          <Text style={[styles.title, { color: Colors.onSurface }]}>{title}</Text>
          {normalizedMessage ? (
            <FormattedText style={[styles.message, { color: Colors.onSurfaceVariant }]}>
              {normalizedMessage}
            </FormattedText>
          ) : null}
          <View style={styles.actions}>
            {actions.map((action, index) => {
              const { backgroundColor, borderColor, textColor } = getActionColors(action.variant);

              return (
                <Pressable
                  key={`${action.label}-${index}`}
                  onPress={() => {
                    if (disabledActionIndices.has(index)) {
                      return;
                    }

                    if (action.disableOnPress) {
                      setDisabledActionIndices((prev) => {
                        const next = new Set(prev);
                        next.add(index);
                        return next;
                      });
                    }

                    onRequestClose?.();
                    action.onPress?.();
                  }}
                  disabled={disabledActionIndices.has(index)}
                  accessibilityState={{ disabled: disabledActionIndices.has(index) }}
                  accessibilityRole="button"
                  accessibilityLabel={action.accessibilityLabel ?? action.label}
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor,
                      borderColor,
                      opacity: disabledActionIndices.has(index) ? 0.6 : 1,
                    },
                  ]}
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
    maxWidth: 520,
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
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  actions: {
    marginTop: 4,
    flexDirection: 'column',
    gap: 12,
  },
  actionButton: {
    height: 56,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
});
