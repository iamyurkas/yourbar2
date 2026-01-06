import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useInventory } from '@/providers/inventory-provider';
import { START_SCREEN_OPTIONS, type StartScreenKey } from '@/libs/start-screen';
import { useStartScreenPreference } from '@/providers/start-screen-provider';

const MENU_WIDTH = Math.round(Dimensions.get('window').width * 0.75);
const ANIMATION_DURATION = 200;

type SideMenuDrawerProps = {
  visible: boolean;
  onClose: () => void;
};

export function SideMenuDrawer({ visible, onClose }: SideMenuDrawerProps) {
  const palette = Colors;
  const {
    ignoreGarnish,
    setIgnoreGarnish,
    allowAllSubstitutes,
    setAllowAllSubstitutes,
    resetInventoryFromBundle,
  } = useInventory();
  const { startScreen, setStartScreen } = useStartScreenPreference();
  const [isMounted, setIsMounted] = useState(visible);
  const [isStartScreenModalVisible, setStartScreenModalVisible] = useState(false);
  const translateX = useRef(new Animated.Value(-MENU_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const drawerStyle = useMemo(
    () => [
      styles.drawer,
      {
        width: MENU_WIDTH,
        backgroundColor: palette.surface,
        shadowColor: palette.shadow,
        borderColor: palette.outline,
      },
    ],
    [palette.outline, palette.shadow, palette.surface],
  );

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -MENU_WIDTH,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setIsMounted(false);
        }
      });
    }
  }, [backdropOpacity, translateX, visible]);

  const toggleIgnoreGarnish = () => {
    setIgnoreGarnish(!ignoreGarnish);
  };

  const toggleAllowAllSubstitutes = () => {
    setAllowAllSubstitutes(!allowAllSubstitutes);
  };

  const handleResetInventory = async () => {
    await resetInventoryFromBundle();
    onClose();
  };

  const handleSelectStartScreen = (key: StartScreenKey) => {
    setStartScreen(key);
    setStartScreenModalVisible(false);
  };

  const selectedStartScreenLabel = useMemo(
    () => START_SCREEN_OPTIONS.find((option) => option.key === startScreen)?.label ?? 'All cocktails',
    [startScreen],
  );

  if (!isMounted) {
    return null;
  }

  return (
    <Modal transparent visible={isMounted} statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={onClose} style={styles.backdropArea}>
          <Animated.View
            pointerEvents="none"
            style={[styles.backdrop, { backgroundColor: palette.backdrop, opacity: backdropOpacity }]}
          />
        </Pressable>
        <Animated.View style={[drawerStyle, { transform: [{ translateX }] }]}>
          <View style={styles.menuContent}>
            <Text style={[styles.title, { color: palette.onSurface }]}>Settings</Text>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ignoreGarnish }}
              onPress={toggleIgnoreGarnish}
              style={[
                styles.settingRow,
                {
                  borderColor: palette.outline,
                  backgroundColor: palette.surface,
                },
              ]}>
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: ignoreGarnish ? palette.tint : palette.outlineVariant,
                    backgroundColor: ignoreGarnish ? palette.tint : 'transparent',
                  },
                ]}>
                <MaterialCommunityIcons
                  name="check"
                  size={16}
                  color={ignoreGarnish ? palette.background : palette.outlineVariant}
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: palette.onSurface }]}>Ignore garnish</Text>
                <Text style={[styles.settingCaption, { color: palette.onSurfaceVariant }]}>All garnishes are optional</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allowAllSubstitutes }}
              onPress={toggleAllowAllSubstitutes}
              style={[
                styles.settingRow,
                {
                  borderColor: palette.outline,
                  backgroundColor: palette.surface,
                },
              ]}>
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: allowAllSubstitutes ? palette.tint : palette.outlineVariant,
                    backgroundColor: allowAllSubstitutes ? palette.tint : 'transparent',
                  },
                ]}>
                <MaterialCommunityIcons
                  name="check"
                  size={16}
                  color={allowAllSubstitutes ? palette.background : palette.outlineVariant}
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: palette.onSurface }]}>Allow all substitutes</Text>
                <Text style={[styles.settingCaption, { color: palette.onSurfaceVariant }]}>
                  Use base or branded alternative regardless of a recipe
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose starting screen"
              onPress={() => setStartScreenModalVisible(true)}
              style={[
                styles.actionRow,
                {
                  borderColor: palette.outline,
                  backgroundColor: palette.surface,
                },
              ]}>
              <View style={[styles.actionIcon, { backgroundColor: palette.surfaceVariant }]}>
                <MaterialCommunityIcons name="home-outline" size={16} color={palette.onSurfaceVariant} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: palette.onSurface }]}>Starting screen</Text>
                <Text style={[styles.settingCaption, { color: palette.onSurfaceVariant }]}>
                  {selectedStartScreenLabel}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reload bundled inventory"
              onPress={handleResetInventory}
              style={[
                styles.actionRow,
                {
                  borderColor: palette.outline,
                  backgroundColor: palette.surface,
                },
              ]}>
              <View style={[styles.actionIcon, { backgroundColor: palette.surfaceVariant }]}>
                <MaterialCommunityIcons name="refresh" size={16} color={palette.onSurfaceVariant} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: palette.onSurface }]}>Reload bundled data</Text>
                <Text style={[styles.settingCaption, { color: palette.onSurfaceVariant }]}>
                  Clear saved inventory and reload assets from data.json
                </Text>
              </View>
            </Pressable>
          </View>
        </Animated.View>
        <StartScreenModal
          visible={isStartScreenModalVisible}
          selectedKey={startScreen}
          onSelect={handleSelectStartScreen}
          onClose={() => setStartScreenModalVisible(false)}
        />
      </View>
    </Modal>
  );
}

type StartScreenModalProps = {
  visible: boolean;
  selectedKey: StartScreenKey;
  onSelect: (key: StartScreenKey) => void;
  onClose: () => void;
};

function StartScreenModal({ visible, selectedKey, onSelect, onClose }: StartScreenModalProps) {
  const palette = Colors;

  if (!visible) {
    return null;
  }

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.modalOverlay, { backgroundColor: palette.backdrop }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close starting screen modal">
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[styles.modalCard, { backgroundColor: palette.surface }]}
          accessibilityLabel="Starting screen options">
          <Text style={[styles.modalTitle, { color: palette.onSurface }]}>Starting screen</Text>
          <View style={styles.modalOptions}>
            {START_SCREEN_OPTIONS.map((option) => {
              const isSelected = option.key === selectedKey;

              return (
                <Pressable
                  key={option.key}
                  style={[styles.modalOption, { borderColor: palette.outlineVariant }]}
                  accessibilityRole="button"
                  accessibilityState={isSelected ? { selected: true } : undefined}
                  accessibilityLabel={option.label}
                  onPress={() => onSelect(option.key)}>
                  <View
                    style={[
                      styles.radioOuter,
                      {
                        borderColor: isSelected ? palette.tint : palette.outlineVariant,
                      },
                    ]}>
                    {isSelected ? (
                      <View style={[styles.radioInner, { backgroundColor: palette.tint }]} />
                    ) : null}
                  </View>
                  <Text style={[styles.modalOptionLabel, { color: palette.onSurface }]}>{option.label}</Text>
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
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdropArea: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    flex: 1,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  menuContent: {
    flex: 1,
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingRight: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTextContainer: {
    flex: 1,
    gap: 4,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingCaption: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalOptions: {
    gap: 10,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
