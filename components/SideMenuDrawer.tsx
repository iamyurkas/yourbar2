import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useInventory } from '@/providers/inventory-provider';

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
    bars,
    activeBarId,
    setActiveBar,
    createBar,
    renameBar,
    deleteBar,
  } = useInventory();
  const [isMounted, setIsMounted] = useState(visible);
  const [barsModalVisible, setBarsModalVisible] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [editingBarId, setEditingBarId] = useState<string | null>(null);
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

  if (!isMounted) {
    return null;
  }

  const toggleIgnoreGarnish = () => {
    setIgnoreGarnish(!ignoreGarnish);
  };

  const toggleAllowAllSubstitutes = () => {
    setAllowAllSubstitutes(!allowAllSubstitutes);
  };

  const openBarsModal = () => {
    setBarsModalVisible(true);
    setDraftName('');
    setEditingBarId(null);
  };

  const closeBarsModal = () => {
    setBarsModalVisible(false);
    setDraftName('');
    setEditingBarId(null);
  };

  const submitDraft = () => {
    const trimmedName = draftName.trim();
    if (!trimmedName) {
      return;
    }

    if (editingBarId) {
      renameBar(editingBarId, trimmedName);
    } else {
      createBar(trimmedName);
    }

    setDraftName('');
    setEditingBarId(null);
  };

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
              accessibilityRole="button"
              onPress={openBarsModal}
              style={[
                styles.settingRow,
                {
                  borderColor: palette.outline,
                  backgroundColor: palette.surface,
                },
              ]}>
              <MaterialCommunityIcons name="storefront-outline" size={20} color={palette.onSurface} />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: palette.onSurface }]}>Bars</Text>
                <Text style={[styles.settingCaption, { color: palette.onSurfaceVariant }]}>Current: {bars.find((bar) => bar.id === activeBarId)?.name ?? 'Home'}</Text>
              </View>
            </Pressable>
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
                <Text style={[styles.settingCaption, { color: palette.onSurfaceVariant }]}>Use base or branded alternative regardless of a recipe</Text>
              </View>
            </Pressable>
          </View>
        </Animated.View>

        <Modal transparent visible={barsModalVisible} animationType="fade" onRequestClose={closeBarsModal}>
          <Pressable style={[styles.modalOverlay, { backgroundColor: palette.backdrop }]} onPress={closeBarsModal}>
            <Pressable style={[styles.modalCard, { backgroundColor: palette.surface }]} onPress={(event) => event.stopPropagation()}>
              <Text style={[styles.modalTitle, { color: palette.onSurface }]}>Bars</Text>
              {bars.map((bar) => {
                const isOnlyBar = bars.length === 1;
                return (
                  <View key={bar.id} style={[styles.barRow, { borderColor: palette.outlineVariant }]}>
                    <Pressable style={styles.barSelectButton} onPress={() => setActiveBar(bar.id)}>
                      <Text style={[styles.barName, { color: palette.onSurface }]}>{bar.name}</Text>
                      {bar.id === activeBarId ? <Text style={[styles.barActive, { color: palette.tint }]}>Active</Text> : null}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setEditingBarId(bar.id);
                        setDraftName(bar.name);
                      }}
                      style={styles.iconButton}>
                      <MaterialCommunityIcons name="pencil-outline" size={18} color={palette.onSurface} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isOnlyBar}
                      onPress={() => deleteBar(bar.id)}
                      style={[styles.iconButton, isOnlyBar && styles.disabledButton]}>
                      <MaterialCommunityIcons
                        name="trash-can-outline"
                        size={18}
                        color={isOnlyBar ? palette.outlineVariant : palette.error}
                      />
                    </Pressable>
                  </View>
                );
              })}

              <View style={styles.editorContainer}>
                <TextInput
                  value={draftName}
                  onChangeText={setDraftName}
                  placeholder={editingBarId ? 'Rename bar' : 'New bar name'}
                  placeholderTextColor={palette.outlineVariant}
                  style={[
                    styles.editorInput,
                    {
                      color: palette.onSurface,
                      borderColor: palette.outline,
                      backgroundColor: palette.background,
                    },
                  ]}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={submitDraft}
                  style={[styles.createButton, { backgroundColor: palette.tint }]}
                  disabled={!draftName.trim()}>
                  <Text style={[styles.createButtonLabel, { color: palette.onPrimary }]}>Create</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
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
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
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
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  barRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  barSelectButton: {
    flex: 1,
    gap: 2,
  },
  barName: {
    fontSize: 15,
    fontWeight: '600',
  },
  barActive: {
    fontSize: 12,
    fontWeight: '600',
  },
  iconButton: {
    padding: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  editorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  editorInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  createButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  createButtonLabel: {
    fontWeight: '700',
  },
});
