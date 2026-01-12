import { MaterialCommunityIcons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image, type ImageSource } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { Animated, Dimensions, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import CocktailIcon from '@/assets/images/cocktails.svg';
import IngredientsIcon from '@/assets/images/ingredients.svg';
import ShakerIcon from '@/assets/images/shaker.svg';
import { AppDialog, type DialogOptions } from '@/components/AppDialog';
import { TagEditorModal } from '@/components/TagEditorModal';
import { TagPill } from '@/components/TagPill';
import { Colors } from '@/constants/theme';
import { useInventory, type StartScreen } from '@/providers/inventory-provider';

const MENU_WIDTH = Math.round(Dimensions.get('window').width * 0.75);
const ANIMATION_DURATION = 200;

type StartScreenIcon =
  | { type: 'icon'; name: ComponentProps<typeof MaterialCommunityIcons>['name'] }
  | { type: 'materialIcon'; name: ComponentProps<typeof MaterialIcons>['name'] }
  | { type: 'asset'; source: ImageSource };

type StartScreenOption = {
  key: StartScreen;
  label: string;
  description: string;
  icon: StartScreenIcon;
};

const START_SCREEN_OPTIONS: StartScreenOption[] = [
  {
    key: 'cocktails_all',
    label: 'All cocktails',
    description: 'Browse every recipe',
    icon: { type: 'asset', source: CocktailIcon },
  },
  {
    key: 'cocktails_my',
    label: 'My cocktails',
    description: 'See your creations first',
    icon: { type: 'icon', name: 'cup-water' },
  },
  {
    key: 'cocktails_favorites',
    label: 'Favorite cocktails',
    description: 'Jump into saved cocktails',
    icon: { type: 'icon', name: 'star' },
  },
  {
    key: 'shaker',
    label: 'Shaker',
    description: 'Mix based on your inventory',
    icon: { type: 'asset', source: ShakerIcon },
  },
  {
    key: 'ingredients_all',
    label: 'All ingredients',
    description: 'Manage every ingredient',
    icon: { type: 'asset', source: IngredientsIcon },
  },
  {
    key: 'ingredients_my',
    label: 'My ingredients',
    description: 'Start with what you own',
    icon: { type: 'icon', name: 'check-circle' },
  },
  {
    key: 'ingredients_shopping',
    label: 'Shopping list',
    description: 'Head to your shopping items',
    icon: { type: 'materialIcon', name: 'shopping-cart' },
  },
];

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
    startScreen,
    setStartScreen,
    resetInventoryFromBundle,
    customCocktailTags,
    customIngredientTags,
    createCustomCocktailTag,
    updateCustomCocktailTag,
    deleteCustomCocktailTag,
    createCustomIngredientTag,
    updateCustomIngredientTag,
    deleteCustomIngredientTag,
    getExportData,
  } = useInventory();
  const [isMounted, setIsMounted] = useState(visible);
  const [isRatingModalVisible, setRatingModalVisible] = useState(false);
  const ratingModalCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isStartScreenModalVisible, setStartScreenModalVisible] = useState(false);
  const startScreenModalCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTagManagerVisible, setTagManagerVisible] = useState(false);
  const [isTagEditorVisible, setTagEditorVisible] = useState(false);
  const [tagEditorMode, setTagEditorMode] = useState<'create' | 'edit'>('create');
  const [tagEditorType, setTagEditorType] = useState<'cocktail' | 'ingredient'>('cocktail');
  const [tagEditorTarget, setTagEditorTarget] = useState<{ id: number; name: string; color: string } | null>(null);
  const [dialogOptions, setDialogOptions] = useState<DialogOptions | null>(null);
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

  const selectedStartScreenOption = useMemo(
    () => START_SCREEN_OPTIONS.find((option) => option.key === startScreen),
    [startScreen],
  );

  const renderStartScreenIcon = (option: StartScreenOption, isSelected: boolean) => {
    const iconColor = isSelected ? palette.tint : palette.onSurfaceVariant;

    if (option.icon.type === 'asset') {
      return (
        <Image
          source={option.icon.source}
          style={{ width: 20, height: 20, tintColor: iconColor }}
          contentFit="contain"
        />
      );
    }

    if (option.icon.type === 'materialIcon') {
      return <MaterialIcons name={option.icon.name} size={20} color={iconColor} />;
    }

    return <MaterialCommunityIcons name={option.icon.name} size={20} color={iconColor} />;
  };

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

  const handleExportInventory = async () => {
    const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!directory) {
      setDialogOptions({
        title: 'Export unavailable',
        message: 'Storage access is unavailable on this device.',
        actions: [{ label: 'OK', variant: 'primary' }],
      });
      return;
    }

    const exportData = getExportData();
    const exportPayload = JSON.stringify(exportData, null, 2);
    const fileUri = `${directory.replace(/\/?$/, '/')}yourbar-data.json`;

    try {
      await FileSystem.writeAsStringAsync(fileUri, exportPayload);
      await Share.share({
        title: 'Export cocktails & ingredients',
        message: 'Cocktail export',
        url: fileUri,
      });
      onClose();
    } catch (error) {
      console.error('Failed to export inventory', error);
      setDialogOptions({
        title: 'Export failed',
        message: 'We could not export your cocktail data. Please try again.',
        actions: [{ label: 'OK', variant: 'primary' }],
      });
    }
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

  const handleStartScreenPress = () => {
    setStartScreenModalVisible(true);
  };

  const handleCloseStartScreenModal = () => {
    if (startScreenModalCloseTimeout.current) {
      clearTimeout(startScreenModalCloseTimeout.current);
      startScreenModalCloseTimeout.current = null;
    }

    setStartScreenModalVisible(false);
  };

  const handleSelectStartScreen = (value: StartScreen) => {
    if (startScreenModalCloseTimeout.current) {
      clearTimeout(startScreenModalCloseTimeout.current);
    }

    setStartScreen(value);
    startScreenModalCloseTimeout.current = setTimeout(() => {
      setStartScreenModalVisible(false);
      startScreenModalCloseTimeout.current = null;
    }, 250);
  };

  const handleOpenTagManager = () => {
    setTagManagerVisible(true);
  };

  const handleCloseTagManager = () => {
    setTagManagerVisible(false);
  };

  const handleOpenTagEditor = (
    type: 'cocktail' | 'ingredient',
    tag?: { id: number; name: string; color: string },
  ) => {
    setTagEditorType(type);
    setTagEditorMode(tag ? 'edit' : 'create');
    setTagEditorTarget(tag ?? null);
    setTagEditorVisible(true);
  };

  const handleCloseTagEditor = () => {
    setTagEditorVisible(false);
  };

  const handleCloseDialog = () => {
    setDialogOptions(null);
  };

  const handleSaveTagEditor = (data: { name: string; color: string }) => {
    if (tagEditorMode === 'create') {
      if (tagEditorType === 'cocktail') {
        createCustomCocktailTag(data);
      } else {
        createCustomIngredientTag(data);
      }
    } else if (tagEditorTarget) {
      if (tagEditorType === 'cocktail') {
        updateCustomCocktailTag(tagEditorTarget.id, data);
      } else {
        updateCustomIngredientTag(tagEditorTarget.id, data);
      }
    }

    setTagEditorVisible(false);
  };

  const handleDeleteTag = (type: 'cocktail' | 'ingredient', tag: { id: number; name: string }) => {
    setDialogOptions({
      title: 'Delete tag',
      message: `Remove "${tag.name}"?`,
      actions: [
        { label: 'Cancel', variant: 'secondary' },
        {
          label: 'Delete',
          variant: 'destructive',
          onPress: () => {
            if (type === 'cocktail') {
              deleteCustomCocktailTag(tag.id);
            } else {
              deleteCustomIngredientTag(tag.id);
            }
          },
        },
      ],
    });
  };

  useEffect(() => {
    return () => {
      if (ratingModalCloseTimeout.current) {
        clearTimeout(ratingModalCloseTimeout.current);
      }

      if (startScreenModalCloseTimeout.current) {
        clearTimeout(startScreenModalCloseTimeout.current);
      }
    };
  }, []);

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
              accessibilityLabel="Set starting screen"
              onPress={handleStartScreenPress}
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
                <MaterialCommunityIcons name="home-variant" size={16} color={palette.tint} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: palette.onSurface }]}>Starting screen</Text>
                <Text style={[styles.settingCaption, { color: palette.onSurfaceVariant }]}>Open {selectedStartScreenOption?.label ?? 'All cocktails'}</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Manage custom tags"
              onPress={handleOpenTagManager}
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
                <MaterialCommunityIcons name="tag-multiple" size={16} color={palette.tint} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: palette.onSurface }]}>Manage tags</Text>
                <Text style={[styles.settingCaption, { color: palette.onSurfaceVariant }]}>Create or update your tags</Text>
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Export cocktails and ingredients"
              onPress={handleExportInventory}
              style={[
                styles.actionRow,
                {
                  borderColor: palette.outline,
                  backgroundColor: palette.surface,
                },
              ]}>
              <View style={[styles.actionIcon, { backgroundColor: palette.surfaceVariant }]}>
                <MaterialCommunityIcons name="share-variant" size={16} color={palette.onSurfaceVariant} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: palette.onSurface }]}>Export data</Text>
                <Text style={[styles.settingCaption, { color: palette.onSurfaceVariant }]}>
                  Share cocktails and ingredients as data.json
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
              styles.modalCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.outline,
                shadowColor: palette.shadow,
              },
            ]}
            accessibilityLabel="Favorites rating"
            onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.onSurface, flex: 1 }]}>Favorites rating</Text>
              <Pressable onPress={handleCloseRatingModal} accessibilityRole="button" accessibilityLabel="Close">
                <MaterialCommunityIcons name="close" size={22} color={palette.onSurfaceVariant} />
              </Pressable>
            </View>
            <Text style={[styles.settingCaption, { color: palette.onSurfaceVariant }]}>
              Choose the minimum rating to show on Favorites
            </Text>
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
                        backgroundColor: isSelected ? palette.tint : palette.surfaceBright,
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
      <Modal transparent visible={isTagManagerVisible} animationType="fade" onRequestClose={handleCloseTagManager}>
        <Pressable style={styles.modalOverlay} onPress={handleCloseTagManager} accessibilityRole="button">
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.outline,
                shadowColor: palette.shadow,
              },
            ]}
            accessibilityLabel="Manage tags"
            onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.onSurface, flex: 1 }]}>Manage tags</Text>
              <Pressable onPress={handleCloseTagManager} accessibilityRole="button" accessibilityLabel="Close">
                <MaterialCommunityIcons name="close" size={22} color={palette.onSurfaceVariant} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tagManagerContent}>
              <View style={styles.tagSection}>
                <View style={styles.tagSectionHeader}>
                  <Text style={[styles.settingLabel, { color: palette.onSurface }]}>Cocktail tags</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleOpenTagEditor('cocktail')}
                    style={[styles.tagAddButton, { borderColor: palette.outlineVariant }]}
                  >
                    <MaterialCommunityIcons name="plus" size={16} color={palette.tint} />
                    <Text style={[styles.tagAddLabel, { color: palette.tint }]}>Add</Text>
                  </Pressable>
                </View>
                {customCocktailTags.length === 0 ? (
                  <Text style={[styles.tagEmpty, { color: palette.onSurfaceVariant }]}>
                    No custom cocktail tags yet.
                  </Text>
                ) : (
                  <View style={styles.tagRows}>
                    {customCocktailTags.map((tag) => (
                      <View key={`cocktail-tag-${tag.id}`} style={styles.tagRow}>
                        <TagPill label={tag.name ?? ''} color={tag.color ?? palette.tint} />
                        <View style={styles.tagActions}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Edit ${tag.name ?? 'tag'}`}
                            onPress={() =>
                              handleOpenTagEditor('cocktail', {
                                id: Number(tag.id),
                                name: tag.name ?? '',
                                color: tag.color ?? palette.tint,
                              })
                            }
                          >
                            <MaterialCommunityIcons name="pencil" size={18} color={palette.onSurfaceVariant} />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Delete ${tag.name ?? 'tag'}`}
                            onPress={() => handleDeleteTag('cocktail', { id: Number(tag.id), name: tag.name ?? 'Tag' })}
                          >
                            <MaterialCommunityIcons name="trash-can-outline" size={18} color={palette.error} />
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.tagSection}>
                <View style={styles.tagSectionHeader}>
                  <Text style={[styles.settingLabel, { color: palette.onSurface }]}>Ingredient tags</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleOpenTagEditor('ingredient')}
                    style={[styles.tagAddButton, { borderColor: palette.outlineVariant }]}
                  >
                    <MaterialCommunityIcons name="plus" size={16} color={palette.tint} />
                    <Text style={[styles.tagAddLabel, { color: palette.tint }]}>Add</Text>
                  </Pressable>
                </View>
                {customIngredientTags.length === 0 ? (
                  <Text style={[styles.tagEmpty, { color: palette.onSurfaceVariant }]}>
                    No custom ingredient tags yet.
                  </Text>
                ) : (
                  <View style={styles.tagRows}>
                    {customIngredientTags.map((tag) => (
                      <View key={`ingredient-tag-${tag.id}`} style={styles.tagRow}>
                        <TagPill label={tag.name ?? ''} color={tag.color ?? palette.tint} />
                        <View style={styles.tagActions}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Edit ${tag.name ?? 'tag'}`}
                            onPress={() =>
                              handleOpenTagEditor('ingredient', {
                                id: Number(tag.id),
                                name: tag.name ?? '',
                                color: tag.color ?? palette.tint,
                              })
                            }
                          >
                            <MaterialCommunityIcons name="pencil" size={18} color={palette.onSurfaceVariant} />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Delete ${tag.name ?? 'tag'}`}
                            onPress={() => handleDeleteTag('ingredient', { id: Number(tag.id), name: tag.name ?? 'Tag' })}
                          >
                            <MaterialCommunityIcons name="trash-can-outline" size={18} color={palette.error} />
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      <TagEditorModal
        visible={isTagEditorVisible}
        title={tagEditorMode === 'create' ? 'New tag' : 'Edit tag'}
        confirmLabel={tagEditorMode === 'create' ? 'Create' : 'Save'}
        initialName={tagEditorTarget?.name}
        initialColor={tagEditorTarget?.color}
        onClose={handleCloseTagEditor}
        onSave={handleSaveTagEditor}
      />
      <AppDialog
        visible={dialogOptions != null}
        title={dialogOptions?.title ?? ''}
        message={dialogOptions?.message}
        actions={dialogOptions?.actions ?? []}
        onRequestClose={handleCloseDialog}
      />
      <Modal
        transparent
        visible={isStartScreenModalVisible}
        animationType="fade"
        onRequestClose={handleCloseStartScreenModal}>
        <Pressable style={styles.modalOverlay} onPress={handleCloseStartScreenModal} accessibilityRole="button">
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.outline,
                shadowColor: palette.shadow,
              },
            ]}
            accessibilityLabel="Starting screen"
            onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.onSurface, flex: 1 }]}>Starting screen</Text>
              <Pressable onPress={handleCloseStartScreenModal} accessibilityRole="button" accessibilityLabel="Close">
                <MaterialCommunityIcons name="close" size={22} color={palette.onSurfaceVariant} />
              </Pressable>
            </View>
            <Text style={[styles.settingCaption, { color: palette.onSurfaceVariant }]}>Select where the app opens</Text>
            <ScrollView
              style={styles.startScreenModalScroll}
              contentContainerStyle={styles.startScreenOptionList}
              showsVerticalScrollIndicator={false}>
              {START_SCREEN_OPTIONS.map((option) => {
                const isSelected = startScreen === option.key;
                return (
                  <Pressable
                    key={`start-screen-${option.key}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Open ${option.label} first`}
                    onPress={() => handleSelectStartScreen(option.key)}
                    style={({ pressed }) => [
                      styles.startScreenOption,
                      {
                        borderColor: isSelected ? palette.tint : palette.outlineVariant,
                        backgroundColor: isSelected ? palette.highlightFaint : palette.surfaceBright,
                      },
                      pressed ? { opacity: 0.85 } : null,
                    ]}>
                    <View style={[styles.startScreenIcon, { backgroundColor: palette.surfaceBright }]}>
                      {renderStartScreenIcon(option, isSelected)}
                    </View>
                    <View style={styles.startScreenTextContainer}>
                      <Text style={[styles.settingLabel, { color: palette.onSurface }]}>{option.label}</Text>
                      <Text style={[styles.settingCaption, { color: palette.onSurfaceVariant }]}>{option.description}</Text>
                    </View>
                    <MaterialCommunityIcons
                      name={isSelected ? 'check-circle' : 'checkbox-blank-circle-outline'}
                      size={20}
                      color={isSelected ? palette.tint : palette.onSurfaceVariant}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
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
    paddingVertical: 8,
    paddingRight: 10,
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
  modalCard: {
    width: '100%',
    maxHeight: '92%',
    flexShrink: 1,
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
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  startScreenModalScroll: {
    maxHeight: '100%',
    width: '100%',
  },
  startScreenOptionList: {
    gap: 4,
  },
  startScreenOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    paddingTop: 12, 
    paddingRight: 16,
    paddingBottom: 20,
    paddingLeft: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  startScreenIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startScreenTextContainer: {
    flex: 1,
    gap: 4,
  },
  tagManagerContent: {
    gap: 16,
  },
  tagSection: {
    gap: 10,
  },
  tagSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tagAddLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  tagRows: {
    gap: 12,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  tagActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tagEmpty: {
    fontSize: 12,
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
