import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CocktailFiltersPanel } from '@/components/CocktailFiltersPanel';

type CocktailFilterMenuMode = 'popover' | 'modal';

type CocktailFilterMenuProps = {
  visible: boolean;
  mode: CocktailFilterMenuMode;
  onClose: () => void;
  closeAccessibilityLabel: string;
  panelProps: React.ComponentProps<typeof CocktailFiltersPanel>;
  surfaceColor: string;
  outlineColor: string;
  shadowColor: string;
  onSurfaceColor?: string;
  onSurfaceVariantColor?: string;
  title?: string;
  top?: number;
};

export function CocktailFilterMenu({
  visible,
  mode,
  onClose,
  closeAccessibilityLabel,
  panelProps,
  surfaceColor,
  outlineColor,
  shadowColor,
  onSurfaceColor,
  onSurfaceVariantColor,
  title,
  top,
}: CocktailFilterMenuProps) {
  if (!visible) {
    return null;
  }

  if (mode === 'modal') {
    return (
      <View style={styles.modalOverlay} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeAccessibilityLabel}
          onPress={onClose}
          style={styles.modalBackdrop}
        />
        <View
          style={[
            styles.modal,
            {
              backgroundColor: surfaceColor,
              borderColor: outlineColor,
              shadowColor,
            },
          ]}>
          {title ? (
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: onSurfaceColor ?? onSurfaceVariantColor ?? '#000' }]}>
                {title}
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={closeAccessibilityLabel}
                style={styles.modalCloseButton}>
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={onSurfaceVariantColor ?? onSurfaceColor ?? '#000'}
                />
              </Pressable>
            </View>
          ) : null}
          <CocktailFiltersPanel {...panelProps} />
        </View>
      </View>
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={closeAccessibilityLabel}
        onPress={onClose}
        style={styles.popoverBackdrop}
      />
      <View
        style={[
          styles.popover,
          {
            top,
            backgroundColor: surfaceColor,
            borderColor: outlineColor,
            shadowColor,
          },
        ]}>
        <CocktailFiltersPanel {...panelProps} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  popoverBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 3,
  },
  popover: {
    position: 'absolute',
    right: 16,
    minWidth: 280,
    maxWidth: '92%',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'stretch',
    zIndex: 4,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  modal: {
    minWidth: 280,
    maxWidth: '92%',
    maxHeight: '92%',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingRight: 16,
    paddingBottom: 20,
    paddingLeft: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
