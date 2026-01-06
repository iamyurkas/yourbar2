import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

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
    useImperialUnits,
    setUseImperialUnits,
    keepScreenAwake,
    setKeepScreenAwake,
    ratingFilterThreshold,
    setRatingFilterThreshold,
    resetInventoryFromBundle,
  } = useInventory();
  const [isMounted, setIsMounted] = useState(visible);
  const [isRatingModalVisible, setRatingModalVisible] = useState(false);
  const ratingModalCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const toggleUseImperialUnits = () => {
    setUseImperialUnits(!useImperialUnits);
  };

  const toggleKeepScreenAwake = () => {
    setKeepScreenAwake(!keepScreenAwake);
  };

  const handleResetInventory = async () => {
    await resetInventoryFromBundle();
    onClose();
  };

  const handleRatingThresholdPress = () => {
    setRatingModalVisible(true);
  };

  const handleCloseRatingModal = () => {
    if (ratingModalCloseTimeout.current) {
      clearTimeout(ratingModalCloseTimeout.current);
      ratingModalCloseTimeout.current = null;
    }

    setRatingModalVisible(false);
  };

  const handleSelectRatingThreshold = (value: number) => {
    if (ratingModalCloseTimeout.current) {
      clearTimeout(ratingModalCloseTimeout.current);
    }

    setRatingFilterThreshold(value);
    ratingModalCloseTimeout.current = setTimeout(() => {
      setRatingModalVisible(false);
      ratingModalCloseTimeout.current = null;
    }, 250);
  };

  useEffect(() => {
    return () => {
      if (ratingModalCloseTimeout.current) {
        clearTimeout(ratingModalCloseTimeout.current);
      }
    };
  }, []);

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
              accessibilityRole="checkbox"
              accessibilityState={{ checked: useImperialUnits }}
              onPress={toggleUseImperialUnits}
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
                    borderColor: useImperialUnits ? palette.tint : palette.outlineVariant,
                    backgroundColor: useImperialUnits ? palette.tint : 'transparent',
                  },
                ]}>
                <MaterialCommunityIcons
                  name="check"
                  size={16}
                  color={useImperialUnits ? palette.background : palette.outlineVariant}
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: palette.onSurface }]}>Show in imperial</Text>
                <Text style={[styles.settingCaption, { color: palette.onSurfaceVariant }]}>Use oz instead of ml/g</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: keepScreenAwake }}
              onPress={toggleKeepScreenAwake}
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
                    borderColor: keepScreenAwake ? palette.tint : palette.outlineVariant,
                    backgroundColor: keepScreenAwake ? palette.tint : 'transparent',
                  },
                ]}>
                <MaterialCommunityIcons
                  name="check"
                  size={16}
                  color={keepScreenAwake ? palette.background : palette.outlineVariant}
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: palette.onSurface }]}>Keep screen awake</Text>
                <Text style={[styles.settingCaption, { color: palette.onSurfaceVariant }]}>Prevent sleep on cocktail view</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Set favorites rating filter"
              onPress={handleRatingThresholdPress}
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
                    borderColor: palette.tint,
                    backgroundColor: palette.surfaceVariant,
                  },
                ]}>
                <MaterialCommunityIcons name="star" size={16} color={palette.tint} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: palette.onSurface }]}>Favorites rating filter</Text>
                <Text style={[styles.settingCaption, { color: palette.onSurfaceVariant }]}>Showing {ratingFilterThreshold}+ stars</Text>
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
      </View>
      <Modal
        transparent
        visible={isRatingModalVisible}
        animationType="fade"
        onRequestClose={handleCloseRatingModal}>
        <Pressable style={styles.modalOverlay} onPress={handleCloseRatingModal} accessibilityRole="button">
          <Pressable
            style={[
              styles.ratingModalContent,
              {
                backgroundColor: palette.surface,
                borderColor: palette.outline,
                shadowColor: palette.shadow,
              },
            ]}
            accessibilityLabel="Favorites rating"
            onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: palette.onSurface }]}>Favorites rating</Text>
                <Text style={[styles.settingCaption, { color: palette.onSurfaceVariant }]}>
                  Choose the minimum rating to show on Favorites
                </Text>
              </View>
              <Pressable
                onPress={handleCloseRatingModal}
                accessibilityRole="button"
                accessibilityLabel="Close">
                <MaterialCommunityIcons name="close" size={22} color={palette.onSurfaceVariant} />
              </Pressable>
            </View>
            <View style={styles.ratingOptionRow}>
              {[1, 2, 3, 4, 5].map((value) => {
                const isSelected = value === ratingFilterThreshold;
                return (
                  <Pressable
                    key={`rating-threshold-${value}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Show ${value} star${value === 1 ? '' : 's'} and up`}
                    onPress={() => handleSelectRatingThreshold(value)}
                    style={({ pressed }) => [
                      styles.ratingOption,
                      {
                        borderColor: isSelected ? palette.tint : palette.outlineVariant,
                        backgroundColor: isSelected ? palette.tint : 'transparent',
                      },
                      pressed ? { opacity: 0.8 } : null,
                    ]}>
                    <MaterialCommunityIcons
                      name="star"
                      size={20}
                      color={isSelected ? palette.background : palette.onSurfaceVariant}
                    />
                    <Text
                      style={[
                        styles.ratingOptionLabel,
                        { color: isSelected ? palette.background : palette.onSurface },
                      ]}>
                      {value}+
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  ratingModalContent: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  ratingOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  ratingOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  ratingOptionLabel: {
    fontWeight: '700',
  },
});
