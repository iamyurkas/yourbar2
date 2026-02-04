import { MaterialCommunityIcons } from "@expo/vector-icons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Image, type ImageSource } from "expo-image";
import * as Sharing from "expo-sharing";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import CocktailIcon from "@/assets/images/cocktails.svg";
import IngredientsIcon from "@/assets/images/ingredients.svg";
import ShakerIcon from "@/assets/images/shaker.svg";
import { AppDialog, type DialogOptions } from "@/components/AppDialog";
import { TagEditorModal } from "@/components/TagEditorModal";
import { TagPill } from "@/components/TagPill";
import { useAppColors } from "@/constants/theme";
import { base64ToBytes, createTarArchive } from "@/libs/archive-utils";
import { buildPhotoBaseName } from "@/libs/photo-utils";
import { useInventory, type AppLanguage, type AppTheme, type StartScreen } from "@/providers/inventory-provider";
import { type InventoryExportData } from "@/providers/inventory-types";
import appConfig from "../app.json";
import { useTranslation } from "react-i18next";

const MENU_WIDTH = Math.round(Dimensions.get("window").width * 0.75);
const ANIMATION_DURATION = 200;
const APP_VERSION = appConfig.expo.version;
const APP_VERSION_CODE = appConfig.expo.android?.versionCode;

type StartScreenIcon =
  | {
    type: "icon";
    name: ComponentProps<typeof MaterialCommunityIcons>["name"];
  }
  | { type: "materialIcon"; name: ComponentProps<typeof MaterialIcons>["name"] }
  | { type: "asset"; source: ImageSource };

type StartScreenOption = {
  key: StartScreen;
  label: string;
  description: string;
  icon: StartScreenIcon;
};

function getStartScreenOptions(t: (key: string) => string): StartScreenOption[] {
  return [
    {
      key: "cocktails_all",
      label: t("ui.screens.cocktails_all"),
      description: t("ui.screens.cocktails_all_desc"),
      icon: { type: "asset", source: CocktailIcon },
    },
    {
      key: "cocktails_my",
      label: t("ui.screens.cocktails_my"),
      description: t("ui.screens.cocktails_my_desc"),
      icon: { type: "icon", name: "cup-water" },
    },
    {
      key: "cocktails_favorites",
      label: t("ui.screens.cocktails_favorites"),
      description: t("ui.screens.cocktails_favorites_desc"),
      icon: { type: "icon", name: "star" },
    },
    {
      key: "shaker",
      label: t("ui.screens.shaker"),
      description: t("ui.screens.shaker_desc"),
      icon: { type: "asset", source: ShakerIcon },
    },
    {
      key: "ingredients_all",
      label: t("ui.screens.ingredients_all"),
      description: t("ui.screens.ingredients_all_desc"),
      icon: { type: "asset", source: IngredientsIcon },
    },
    {
      key: "ingredients_my",
      label: t("ui.screens.ingredients_my"),
      description: t("ui.screens.ingredients_my_desc"),
      icon: { type: "icon", name: "check-circle" },
    },
    {
      key: "ingredients_shopping",
      label: t("ui.screens.ingredients_shopping"),
      description: t("ui.screens.ingredients_shopping_desc"),
      icon: { type: "materialIcon", name: "shopping-cart" },
    },
  ];
}

type ThemeOption = {
  key: AppTheme;
  label: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
};

function getThemeOptions(t: (key: string) => string): ThemeOption[] {
  return [
    { key: "light", label: t("ui.light"), icon: "white-balance-sunny" },
    { key: "dark", label: t("ui.dark"), icon: "moon-waning-crescent" },
    { key: "system", label: t("ui.system"), icon: "cellphone-settings" },
  ];
}

type LanguageOption = {
  key: AppLanguage;
  label: string;
  flag: string;
};

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { key: "en", label: "English", flag: "🇬🇧" },
  { key: "es", label: "Español", flag: "🇪🇸" },
  { key: "ua", label: "Українська", flag: "🇺🇦" },
];

type SideMenuDrawerProps = {
  visible: boolean;
  onClose: () => void;
};

export function SideMenuDrawer({ visible, onClose }: SideMenuDrawerProps) {
  const { t } = useTranslation();
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
    appTheme,
    setAppTheme,
    appLanguage,
    setAppLanguage,
    restartOnboarding,
    resetInventoryFromBundle,
    exportInventoryData,
    exportInventoryPhotoEntries,
    importInventoryData,
    customCocktailTags,
    customIngredientTags,
    createCustomCocktailTag,
    updateCustomCocktailTag,
    deleteCustomCocktailTag,
    createCustomIngredientTag,
    updateCustomIngredientTag,
    deleteCustomIngredientTag,
  } = useInventory();
  const Colors = useAppColors();
  const [isMounted, setIsMounted] = useState(visible);
  const [isRatingModalVisible, setRatingModalVisible] = useState(false);
  const ratingModalCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [isStartScreenModalVisible, setStartScreenModalVisible] =
    useState(false);
  const startScreenModalCloseTimeout = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [isThemeModalVisible, setThemeModalVisible] = useState(false);
  const themeModalCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [isLanguageModalVisible, setLanguageModalVisible] = useState(false);
  const languageModalCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [isTagManagerVisible, setTagManagerVisible] = useState(false);
  const [isTagEditorVisible, setTagEditorVisible] = useState(false);
  const [tagEditorMode, setTagEditorMode] = useState<"create" | "edit">(
    "create",
  );
  const [tagEditorType, setTagEditorType] = useState<"cocktail" | "ingredient">(
    "cocktail",
  );
  const [tagEditorTarget, setTagEditorTarget] = useState<{
    id: number;
    name: string;
    color: string;
  } | null>(null);
  const [dialogOptions, setDialogOptions] = useState<DialogOptions | null>(
    null,
  );
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isBackingUpPhotos, setIsBackingUpPhotos] = useState(false);
  const translateX = useRef(new Animated.Value(-MENU_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const SURFACE_ROW_STYLE = useMemo(() => ({
    borderColor: Colors.surface,
    backgroundColor: Colors.surface,
  }), [Colors]);

  const MODAL_CARD_STYLE = useMemo(() => ({
    backgroundColor: Colors.surface,
    borderColor: Colors.outline,
    shadowColor: Colors.shadow,
  }), [Colors]);

  const ACTION_ICON_STYLE = useMemo(() => ({
    backgroundColor: Colors.surfaceVariant,
  }), [Colors]);

  const SURFACE_ICON_STYLE = useMemo(() => ({
    borderColor: Colors.tint,
    backgroundColor: Colors.surfaceVariant,
  }), [Colors]);

  const clearTimeoutRef = (ref: {
    current: ReturnType<typeof setTimeout> | null;
  }) => {
    if (ref.current) {
      clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const scheduleModalClose = (
    ref: { current: ReturnType<typeof setTimeout> | null },
    setVisible: (visible: boolean) => void,
  ) => {
    clearTimeoutRef(ref);
    ref.current = setTimeout(() => {
      setVisible(false);
      ref.current = null;
    }, 250);
  };

  const drawerStyle = useMemo(
    () => [
      styles.drawer,
      {
        width: MENU_WIDTH,
        backgroundColor: Colors.surface,
        shadowColor: Colors.shadow,
        borderColor: Colors.outline,
      },
    ],
    [Colors.outline, Colors.shadow, Colors.surface],
  );

  const startScreenOptions = useMemo(() => getStartScreenOptions(t), [t]);
  const themeOptions = useMemo(() => getThemeOptions(t), [t]);

  const selectedStartScreenOption = useMemo(
    () => startScreenOptions.find((option) => option.key === startScreen),
    [startScreen, startScreenOptions],
  );

  const selectedThemeOption = useMemo(
    () => themeOptions.find((option) => option.key === appTheme),
    [appTheme, themeOptions],
  );

  const selectedLanguageOption = useMemo(
    () => LANGUAGE_OPTIONS.find((option) => option.key === appLanguage),
    [appLanguage],
  );

  const renderStartScreenIcon = (
    option: StartScreenOption,
    isSelected: boolean,
  ) => {
    const iconColor = isSelected ? Colors.tint : Colors.onSurfaceVariant;

    if (option.icon.type === "asset") {
      return (
        <Image
          source={option.icon.source}
          style={{ width: 20, height: 20, tintColor: iconColor }}
          contentFit="contain"
        />
      );
    }

    if (option.icon.type === "materialIcon") {
      return (
        <MaterialIcons name={option.icon.name} size={20} color={iconColor} />
      );
    }

    return (
      <MaterialCommunityIcons
        name={option.icon.name}
        size={20}
        color={iconColor}
      />
    );
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

  const handleResetInventory = () => {
    setDialogOptions({
      title: t("ui.restore_bundled_data"),
      message: t("ui.restore_bundled_data_description"),
      actions: [
        { label: t("ui.cancel"), variant: "secondary" },
        {
          label: t("actions.restore"),
          variant: "destructive",
          onPress: async () => {
            await resetInventoryFromBundle();
            onClose();
          },
        },
      ],
    });
  };

  const handleRatingThresholdPress = () => {
    setRatingModalVisible(true);
  };

  const handleCloseRatingModal = () => {
    clearTimeoutRef(ratingModalCloseTimeout);
    setRatingModalVisible(false);
  };

  const handleSelectRatingThreshold = (value: number) => {
    setRatingFilterThreshold(value);
    scheduleModalClose(ratingModalCloseTimeout, setRatingModalVisible);
  };

  const handleStartScreenPress = () => {
    setStartScreenModalVisible(true);
  };

  const handleCloseStartScreenModal = () => {
    clearTimeoutRef(startScreenModalCloseTimeout);
    setStartScreenModalVisible(false);
  };

  const handleSelectStartScreen = (value: StartScreen) => {
    setStartScreen(value);
    scheduleModalClose(startScreenModalCloseTimeout, setStartScreenModalVisible);
  };

  const handleThemePress = () => {
    setThemeModalVisible(true);
  };

  const handleCloseThemeModal = () => {
    clearTimeoutRef(themeModalCloseTimeout);
    setThemeModalVisible(false);
  };

  const handleSelectTheme = (value: AppTheme) => {
    setAppTheme(value);
    scheduleModalClose(themeModalCloseTimeout, setThemeModalVisible);
  };

  const handleLanguagePress = () => {
    setLanguageModalVisible(true);
  };

  const handleCloseLanguageModal = () => {
    clearTimeoutRef(languageModalCloseTimeout);
    setLanguageModalVisible(false);
  };

  const handleSelectLanguage = (value: AppLanguage) => {
    setAppLanguage(value);
    scheduleModalClose(languageModalCloseTimeout, setLanguageModalVisible);
  };

  const handleOpenTagManager = () => {
    setTagManagerVisible(true);
  };

  const handleCloseTagManager = () => {
    setTagManagerVisible(false);
  };

  const handleOpenTagEditor = (
    type: "cocktail" | "ingredient",
    tag?: { id: number; name: string; color: string },
  ) => {
    setTagEditorType(type);
    setTagEditorMode(tag ? "edit" : "create");
    setTagEditorTarget(tag ?? null);
    setTagEditorVisible(true);
  };

  const handleCloseTagEditor = () => {
    setTagEditorVisible(false);
  };

  const handleCloseDialog = () => {
    setDialogOptions(null);
  };

  const showDialogMessage = (title: string, message: string) => {
    setDialogOptions({
      title,
      message,
      actions: [{ label: t("ui.ok") }],
    });
  };

  const isValidInventoryData = (
    candidate: unknown,
  ): candidate is InventoryExportData => {
    if (!candidate || typeof candidate !== "object") {
      return false;
    }

    const record = candidate as { cocktails?: unknown; ingredients?: unknown };
    return Array.isArray(record.cocktails) && Array.isArray(record.ingredients);
  };

  const handleExportInventory = async () => {
    if (isExporting) {
      return;
    }

    const data = exportInventoryData();
    if (!data) {
      showDialogMessage(
        t("ui.export_unavailable"),
        t("ui.load_inventory_first"),
      );
      return;
    }

    setIsExporting(true);

    try {
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!sharingAvailable) {
        showDialogMessage(
          t("ui.sharing_unavailable"),
          t("ui.sharing_unavailable_desc"),
        );
        return;
      }

      const directory =
        FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!directory) {
        showDialogMessage(t("ui.export_failed"), t("ui.access_storage_failed"));
        return;
      }

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `yourbar-data-${timestamp}.json`;
      const fileUri = `${directory.replace(/\/?$/, "/")}${filename}`;
      const payload = JSON.stringify(data, null, 2);

      await FileSystem.writeAsStringAsync(fileUri, payload, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: "application/json",
        dialogTitle: t("ui.export_dialog_title"),
        UTI: "public.json",
      });
    } catch (error) {
      console.error("Failed to export inventory data", error);
      showDialogMessage(t("ui.export_failed"), t("ui.try_again"));
    } finally {
      setIsExporting(false);
    }
  };


  const handleBackupPhotos = async () => {
    if (isBackingUpPhotos) {
      return;
    }

    const photoEntries = exportInventoryPhotoEntries();
    if (!photoEntries) {
      showDialogMessage(
        t("ui.backup_unavailable"),
        t("ui.load_inventory_backup"),
      );
      return;
    }

    setIsBackingUpPhotos(true);

    try {
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!sharingAvailable) {
        showDialogMessage(
          t("ui.sharing_unavailable"),
          t("ui.sharing_unavailable_desc"),
        );
        return;
      }

      const directory =
        FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!directory) {
        showDialogMessage(t("ui.backup_failed"), t("ui.access_storage_failed"));
        return;
      }

      const entries = photoEntries.filter((entry) => entry.uri);

      if (entries.length === 0) {
        showDialogMessage(
          t("ui.no_photos_to_backup"),
          t("ui.add_photos_first"),
        );
        return;
      }

      const files: Array<{ path: string; contents: Uint8Array }> = [];
      const nameCounts = new Map<string, number>();
      let addedCount = 0;

      for (const entry of entries) {
        const uri = entry.uri;
        if (!uri) {
          continue;
        }

        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists || info.isDirectory) {
          continue;
        }

        const baseName = buildPhotoBaseName(entry.id || "photo", entry.name);
        const nameKey = `${entry.type}/${baseName}.jpg`;
        const duplicateCount = nameCounts.get(nameKey) ?? 0;
        nameCounts.set(nameKey, duplicateCount + 1);
        const fileName =
          duplicateCount > 0
            ? `${baseName}-${duplicateCount + 1}.jpg`
            : `${baseName}.jpg`;
        const contentsBase64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const contents = base64ToBytes(contentsBase64);

        const archivePath = `${entry.type}/${fileName}`;
        files.push({ path: archivePath, contents });
        addedCount += 1;
      }

      if (addedCount === 0) {
        showDialogMessage(
          t("ui.backup_failed"),
          t("ui.no_stored_photos"),
        );
        return;
      }

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `yourbar-photos-${timestamp}.tar`;
      const fileUri = `${directory.replace(/\/?$/, "/")}${filename}`;
      const archiveBase64 = createTarArchive(files);

      await FileSystem.writeAsStringAsync(fileUri, archiveBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: "application/x-tar",
        dialogTitle: t("ui.backup_dialog_title"),
        UTI: "public.tar-archive",
      });
    } catch (error) {
      console.error("Failed to backup photos", error);
      showDialogMessage(t("ui.backup_failed"), t("ui.try_again"));
    } finally {
      setIsBackingUpPhotos(false);
    }
  };

  const handleImportInventory = async () => {
    if (isImporting) {
      return;
    }

    setIsImporting(true);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        showDialogMessage(t("ui.import_failed"), t("ui.read_file_failed"));
        return;
      }

      const contents = await FileSystem.readAsStringAsync(asset.uri);
      const parsed = JSON.parse(contents) as unknown;

      if (!isValidInventoryData(parsed)) {
        showDialogMessage(
          t("ui.invalid_file"),
          t("ui.invalid_file_desc"),
        );
        return;
      }

      importInventoryData(parsed);
      onClose();
    } catch (error) {
      console.error("Failed to import inventory data", error);
      showDialogMessage(
        t("ui.import_failed"),
        t("ui.import_failed_json"),
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveTagEditor = (data: { name: string; color: string }) => {
    if (tagEditorMode === "create") {
      if (tagEditorType === "cocktail") {
        createCustomCocktailTag(data);
      } else {
        createCustomIngredientTag(data);
      }
    } else if (tagEditorTarget) {
      if (tagEditorType === "cocktail") {
        updateCustomCocktailTag(tagEditorTarget.id, data);
      } else {
        updateCustomIngredientTag(tagEditorTarget.id, data);
      }
    }

    setTagEditorVisible(false);
  };

  const handleDeleteTag = (
    type: "cocktail" | "ingredient",
    tag: { id: number; name: string },
  ) => {
    setDialogOptions({
      title: t("ui.delete_tag"),
      message: t("ui.delete_tag_confirmation", { name: tag.name }),
      actions: [
        { label: t("ui.cancel"), variant: "secondary" },
        {
          label: t("ui.delete"),
          variant: "destructive",
          onPress: () => {
            if (type === "cocktail") {
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
      clearTimeoutRef(ratingModalCloseTimeout);
      clearTimeoutRef(startScreenModalCloseTimeout);
      clearTimeoutRef(themeModalCloseTimeout);
      clearTimeoutRef(languageModalCloseTimeout);
    };
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <Modal
      transparent
      visible={isMounted}
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("ui.ok")}
          onPress={onClose}
          style={styles.backdropArea}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.backdrop,
              { backgroundColor: Colors.backdrop, opacity: backdropOpacity },
            ]}
          />
        </Pressable>
        <Animated.View style={[drawerStyle, { transform: [{ translateX }] }]}>
          <View
            style={[
              styles.headerContainer,
              { backgroundColor: Colors.surface },
            ]}
          >
            <Text style={[styles.title, { color: Colors.onSurface }]}>
                {t("ui.settings")}
            </Text>
          </View>
          {/* Preserve menu taps even if a text field elsewhere keeps the keyboard open. */}
          <ScrollView
            style={styles.menuScroll}
            contentContainerStyle={styles.menuContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ignoreGarnish }}
              onPress={toggleIgnoreGarnish}
              style={[styles.settingRow, SURFACE_ROW_STYLE]}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: ignoreGarnish
                      ? Colors.tint
                      : Colors.outlineVariant,
                    backgroundColor: ignoreGarnish
                      ? Colors.tint
                      : "transparent",
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="check"
                  size={16}
                  color={
                    ignoreGarnish ? Colors.background : Colors.outlineVariant
                  }
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[styles.settingLabel, { color: Colors.onSurface }]}
                >
                  {t("ui.ignore_garnish")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("ui.ignore_garnish_description")}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allowAllSubstitutes }}
              onPress={toggleAllowAllSubstitutes}
              style={[styles.settingRow, SURFACE_ROW_STYLE]}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: allowAllSubstitutes
                      ? Colors.tint
                      : Colors.outlineVariant,
                    backgroundColor: allowAllSubstitutes
                      ? Colors.tint
                      : "transparent",
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="check"
                  size={16}
                  color={
                    allowAllSubstitutes
                      ? Colors.background
                      : Colors.outlineVariant
                  }
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[styles.settingLabel, { color: Colors.onSurface }]}
                >
                  {t("ui.allow_all_substitutes")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("ui.allow_all_substitutes_description")}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: useImperialUnits }}
              onPress={toggleUseImperialUnits}
              style={[styles.settingRow, SURFACE_ROW_STYLE]}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: useImperialUnits
                      ? Colors.tint
                      : Colors.outlineVariant,
                    backgroundColor: useImperialUnits
                      ? Colors.tint
                      : "transparent",
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="check"
                  size={16}
                  color={
                    useImperialUnits ? Colors.background : Colors.outlineVariant
                  }
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[styles.settingLabel, { color: Colors.onSurface }]}
                >
                  {t("ui.show_in_imperial")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("ui.show_in_imperial_description")}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: keepScreenAwake }}
              onPress={toggleKeepScreenAwake}
              style={[styles.settingRow, SURFACE_ROW_STYLE]}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: keepScreenAwake
                      ? Colors.tint
                      : Colors.outlineVariant,
                    backgroundColor: keepScreenAwake
                      ? Colors.tint
                      : "transparent",
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="check"
                  size={16}
                  color={
                    keepScreenAwake ? Colors.background : Colors.outlineVariant
                  }
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[styles.settingLabel, { color: Colors.onSurface }]}
                >
                  {t("ui.keep_screen_awake")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("ui.keep_screen_awake_description")}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("ui.starting_screen")}
              onPress={handleStartScreenPress}
              style={[styles.settingRow, SURFACE_ROW_STYLE]}
            >
              <View style={[styles.checkbox, SURFACE_ICON_STYLE]}>
                <MaterialCommunityIcons
                  name="home-variant"
                  size={16}
                  color={Colors.tint}
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[styles.settingLabel, { color: Colors.onSurface }]}
                >
                  {t("ui.starting_screen")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("ui.starting_screen_description", { label: selectedStartScreenOption?.label ?? t("ui.screens.cocktails_all") })}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("ui.app_theme")}
              onPress={handleThemePress}
              style={[styles.settingRow, SURFACE_ROW_STYLE]}
            >
              <View style={[styles.checkbox, SURFACE_ICON_STYLE]}>
                <MaterialCommunityIcons
                  name={selectedThemeOption?.icon ?? "theme-light-dark"}
                  size={16}
                  color={Colors.tint}
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[styles.settingLabel, { color: Colors.onSurface }]}
                >
                  {t("ui.app_theme")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("ui.app_theme_description", { label: selectedThemeOption?.label ?? t("ui.system") })}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("ui.favorites_rating_filter")}
              onPress={handleRatingThresholdPress}
              style={[styles.settingRow, SURFACE_ROW_STYLE]}
            >
              <View style={[styles.checkbox, SURFACE_ICON_STYLE]}>
                <MaterialCommunityIcons
                  name="star"
                  size={16}
                  color={Colors.tint}
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[styles.settingLabel, { color: Colors.onSurface }]}
                >
                  {t("ui.favorites_rating_filter")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("ui.favorites_rating_filter_description", { threshold: ratingFilterThreshold })}
                </Text>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("ui.manage_tags")}
              onPress={handleOpenTagManager}
              style={[styles.settingRow, SURFACE_ROW_STYLE]}
            >
              <View style={[styles.checkbox, SURFACE_ICON_STYLE]}>
                <MaterialCommunityIcons
                  name="tag-multiple"
                  size={16}
                  color={Colors.tint}
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[styles.settingLabel, { color: Colors.onSurface }]}
                >
                  {t("ui.manage_tags")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("ui.manage_tags_description")}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("ui.language")}
              onPress={handleLanguagePress}
              style={[styles.settingRow, SURFACE_ROW_STYLE]}
            >
              <View style={styles.flagIconContainer}>
                <Text style={styles.flagIcon}>
                  {selectedLanguageOption?.flag ?? "🌐"}
                </Text>
              </View>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[styles.settingLabel, { color: Colors.onSurface }]}
                >
                  {t("ui.language")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("ui.language_description", { label: selectedLanguageOption?.label ?? "English" })}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("ui.export_data")}
              onPress={handleExportInventory}
              disabled={isExporting || isImporting}
              style={({ pressed }) => [
                styles.actionRow,
                SURFACE_ROW_STYLE,
                pressed || isExporting ? { opacity: 0.8 } : null,
              ]}
            >
              <View style={[styles.actionIcon, ACTION_ICON_STYLE]}>
                <MaterialCommunityIcons
                  name="file-export-outline"
                  size={16}
                  color={Colors.onSurfaceVariant}
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[styles.settingLabel, { color: Colors.onSurface }]}
                >
                  {isExporting ? t("ui.exporting_data") : t("ui.export_data")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("ui.export_data_description")}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("ui.import_data")}
              onPress={handleImportInventory}
              disabled={isExporting || isImporting}
              style={({ pressed }) => [
                styles.actionRow,
                SURFACE_ROW_STYLE,
                pressed || isImporting ? { opacity: 0.8 } : null,
              ]}
            >
              <View style={[styles.actionIcon, ACTION_ICON_STYLE]}>
                <MaterialCommunityIcons
                  name="file-import-outline"
                  size={16}
                  color={Colors.onSurfaceVariant}
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[styles.settingLabel, { color: Colors.onSurface }]}
                >
                  {isImporting ? t("ui.importing_data") : t("ui.import_data")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("ui.import_data_description")}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("ui.export_photos")}
              onPress={handleBackupPhotos}
              disabled={isExporting || isImporting || isBackingUpPhotos}
              style={({ pressed }) => [
                styles.actionRow,
                SURFACE_ROW_STYLE,
                pressed || isBackingUpPhotos ? { opacity: 0.8 } : null,
              ]}
            >
              <View style={[styles.actionIcon, ACTION_ICON_STYLE]}>
                <MaterialCommunityIcons
                  name="image-multiple"
                  size={16}
                  color={Colors.onSurfaceVariant}
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[styles.settingLabel, { color: Colors.onSurface }]}
                >
                  {isBackingUpPhotos ? t("ui.exporting_photos") : t("ui.export_photos")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("ui.export_photos_description")}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("ui.restart_onboarding")}
              onPress={() => {
                restartOnboarding();
                onClose();
              }}
              style={[
                styles.actionRow,
                SURFACE_ROW_STYLE,
              ]}>
              <View style={[styles.actionIcon, ACTION_ICON_STYLE]}>
                <MaterialCommunityIcons name="help-circle-outline" size={16} color={Colors.onSurfaceVariant} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: Colors.onSurface }]}>{t("ui.restart_onboarding")}</Text>
                <Text style={[styles.settingCaption, { color: Colors.onSurfaceVariant }]}>
                  {t("ui.restart_onboarding_description")}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("ui.restore_bundled_data")}
              onPress={handleResetInventory}
              style={[
                styles.actionRow,
                SURFACE_ROW_STYLE,
              ]}>
              <View style={[styles.actionIcon, ACTION_ICON_STYLE]}>
                <MaterialCommunityIcons name="refresh" size={16} color={Colors.onSurfaceVariant} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: Colors.onSurface }]}>{t("ui.restore_bundled_data")}</Text>
                <Text style={[styles.settingCaption, { color: Colors.onSurfaceVariant }]}>
                  {t("ui.restore_bundled_data_description")}
                </Text>
              </View>
            </Pressable>
            <View style={styles.versionRow}>
              <Text
                style={[styles.versionText, { color: Colors.onSurfaceVariant }]}
              >
                {t("ui.version", { version: APP_VERSION })}
                {APP_VERSION_CODE != null ? ` (${APP_VERSION_CODE})` : ""}
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
      <Modal
        transparent
        visible={isRatingModalVisible}
        animationType="fade"
        onRequestClose={handleCloseRatingModal}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={handleCloseRatingModal}
          accessibilityRole="button"
        >
          <Pressable
            style={[
              styles.modalCard,
              MODAL_CARD_STYLE,
            ]}
            accessibilityLabel={t("ui.favorites_rating_filter")}
            onPress={() => { }}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: Colors.onSurface, flex: 1 },
                ]}
              >
                {t("ui.favorites_rating_filter")}
              </Text>
              <Pressable
                onPress={handleCloseRatingModal}
                accessibilityRole="button"
                accessibilityLabel={t("ui.cancel")}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={Colors.onSurfaceVariant}
                />
              </Pressable>
            </View>
            <Text
              style={[
                styles.settingCaption,
                { color: Colors.onSurfaceVariant },
              ]}
            >
              {t("ui.select_rating")}
            </Text>
            <View style={styles.ratingOptionRow}>
              {[1, 2, 3, 4, 5].map((value) => {
                const isSelected = value === ratingFilterThreshold;
                return (
                  <Pressable
                    key={`rating-threshold-${value}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Show ${value} star${value === 1 ? "" : "s"} and up`}
                    onPress={() => handleSelectRatingThreshold(value)}
                    style={({ pressed }) => [
                      styles.ratingOption,
                      {
                        borderColor: isSelected
                          ? Colors.tint
                          : Colors.outlineVariant,
                        backgroundColor: isSelected
                          ? Colors.tint
                          : Colors.surfaceBright,
                      },
                      pressed ? { opacity: 0.8 } : null,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="star"
                      size={20}
                      color={
                        isSelected ? Colors.background : Colors.onSurfaceVariant
                      }
                    />
                    <Text
                      style={[
                        styles.ratingOptionLabel,
                        {
                          color: isSelected
                            ? Colors.background
                            : Colors.onSurface,
                        },
                      ]}
                    >
                      {value}+
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        transparent
        visible={isTagManagerVisible}
        animationType="fade"
        onRequestClose={handleCloseTagManager}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={handleCloseTagManager}
          accessibilityRole="button"
        >
          <Pressable
            style={[
              styles.modalCard,
              MODAL_CARD_STYLE,
            ]}
            accessibilityLabel={t("ui.manage_tags")}
            onPress={() => { }}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: Colors.onSurface, flex: 1 },
                ]}
              >
                {t("ui.manage_tags")}
              </Text>
              <Pressable
                onPress={handleCloseTagManager}
                accessibilityRole="button"
                accessibilityLabel={t("ui.ok")}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={Colors.onSurfaceVariant}
                />
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.tagManagerContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.tagSection}>
                <View style={styles.tagSectionHeader}>
                  <Text
                    style={[styles.settingLabel, { color: Colors.onSurface }]}
                  >
                    {t("ui.cocktail_tags")}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleOpenTagEditor("cocktail")}
                    style={[
                      styles.tagAddButton,
                      { borderColor: Colors.outlineVariant },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="plus"
                      size={16}
                      color={Colors.tint}
                    />
                    <Text style={[styles.tagAddLabel, { color: Colors.tint }]}>
                      {t("ui.add")}
                    </Text>
                  </Pressable>
                </View>
                {customCocktailTags.length === 0 ? (
                  <Text
                    style={[
                      styles.tagEmpty,
                      { color: Colors.onSurfaceVariant },
                    ]}
                  >
                    {t("ui.no_custom_tags", { type: t("ui.cocktail_tags").toLowerCase() })}
                  </Text>
                ) : (
                  <View style={styles.tagRows}>
                    {customCocktailTags.map((tag) => (
                      <View
                        key={`cocktail-tag-${tag.id}`}
                        style={styles.tagRow}
                      >
                        <TagPill
                          label={tag.name ?? ""}
                          color={tag.color ?? Colors.tint}
                        />
                        <View style={styles.tagActions}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Edit ${tag.name ?? "tag"}`}
                            onPress={() =>
                              handleOpenTagEditor("cocktail", {
                                id: Number(tag.id),
                                name: tag.name ?? "",
                                color: tag.color ?? Colors.tint,
                              })
                            }
                          >
                            <MaterialCommunityIcons
                              name="pencil"
                              size={18}
                              color={Colors.onSurfaceVariant}
                            />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Delete ${tag.name ?? "tag"}`}
                            onPress={() =>
                              handleDeleteTag("cocktail", {
                                id: Number(tag.id),
                                name: tag.name ?? t("ui.this_item"),
                              })
                            }
                          >
                            <MaterialCommunityIcons
                              name="trash-can-outline"
                              size={18}
                              color={Colors.error}
                            />
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.tagSection}>
                <View style={styles.tagSectionHeader}>
                  <Text
                    style={[styles.settingLabel, { color: Colors.onSurface }]}
                  >
                    {t("ui.ingredient_tags")}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleOpenTagEditor("ingredient")}
                    style={[
                      styles.tagAddButton,
                      { borderColor: Colors.outlineVariant },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="plus"
                      size={16}
                      color={Colors.tint}
                    />
                    <Text style={[styles.tagAddLabel, { color: Colors.tint }]}>
                      {t("ui.add")}
                    </Text>
                  </Pressable>
                </View>
                {customIngredientTags.length === 0 ? (
                  <Text
                    style={[
                      styles.tagEmpty,
                      { color: Colors.onSurfaceVariant },
                    ]}
                  >
                    {t("ui.no_custom_tags", { type: t("ui.ingredient_tags").toLowerCase() })}
                  </Text>
                ) : (
                  <View style={styles.tagRows}>
                    {customIngredientTags.map((tag) => (
                      <View
                        key={`ingredient-tag-${tag.id}`}
                        style={styles.tagRow}
                      >
                        <TagPill
                          label={tag.name ?? ""}
                          color={tag.color ?? Colors.tint}
                        />
                        <View style={styles.tagActions}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Edit ${tag.name ?? "tag"}`}
                            onPress={() =>
                              handleOpenTagEditor("ingredient", {
                                id: Number(tag.id),
                                name: tag.name ?? "",
                                color: tag.color ?? Colors.tint,
                              })
                            }
                          >
                            <MaterialCommunityIcons
                              name="pencil"
                              size={18}
                              color={Colors.onSurfaceVariant}
                            />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Delete ${tag.name ?? "tag"}`}
                            onPress={() =>
                              handleDeleteTag("ingredient", {
                                id: Number(tag.id),
                                name: tag.name ?? t("ui.this_item"),
                              })
                            }
                          >
                            <MaterialCommunityIcons
                              name="trash-can-outline"
                              size={18}
                              color={Colors.error}
                            />
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
        title={tagEditorMode === "create" ? t("ui.new_tag") : t("ui.edit_tag")}
        confirmLabel={tagEditorMode === "create" ? t("ui.create") : t("ui.save")}
        initialName={tagEditorTarget?.name}
        initialColor={tagEditorTarget?.color}
        onClose={handleCloseTagEditor}
        onSave={handleSaveTagEditor}
      />
      <AppDialog
        visible={dialogOptions != null}
        title={dialogOptions?.title ?? ""}
        message={dialogOptions?.message}
        actions={dialogOptions?.actions ?? []}
        onRequestClose={handleCloseDialog}
      />
      <Modal
        transparent
        visible={isStartScreenModalVisible}
        animationType="fade"
        onRequestClose={handleCloseStartScreenModal}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={handleCloseStartScreenModal}
          accessibilityRole="button"
        >
          <Pressable
            style={[
              styles.modalCard,
              MODAL_CARD_STYLE,
            ]}
            accessibilityLabel={t("ui.starting_screen")}
            onPress={() => { }}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: Colors.onSurface, flex: 1 },
                ]}
              >
                {t("ui.starting_screen")}
              </Text>
              <Pressable
                onPress={handleCloseStartScreenModal}
                accessibilityRole="button"
                accessibilityLabel={t("ui.ok")}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={Colors.onSurfaceVariant}
                />
              </Pressable>
            </View>
            <Text
              style={[
                styles.settingCaption,
                { color: Colors.onSurfaceVariant },
              ]}
            >
              {t("ui.select_start_screen")}
            </Text>
            <ScrollView
              style={styles.startScreenModalScroll}
              contentContainerStyle={styles.startScreenOptionList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {startScreenOptions.map((option) => {
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
                        borderColor: isSelected
                          ? Colors.tint
                          : Colors.outlineVariant,
                        backgroundColor: isSelected
                          ? Colors.highlightFaint
                          : Colors.surfaceBright,
                      },
                      pressed ? { opacity: 0.85 } : null,
                    ]}
                  >
                    <View
                      style={[
                        styles.startScreenIcon,
                        { backgroundColor: Colors.surfaceBright },
                      ]}
                    >
                      {renderStartScreenIcon(option, isSelected)}
                    </View>
                    <View style={styles.startScreenTextContainer}>
                      <Text
                        style={[
                          styles.settingLabel,
                          { color: Colors.onSurface },
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text
                        style={[
                          styles.settingCaption,
                          { color: Colors.onSurfaceVariant },
                        ]}
                      >
                        {option.description}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name={
                        isSelected
                          ? "check-circle"
                          : "checkbox-blank-circle-outline"
                      }
                      size={20}
                      color={isSelected ? Colors.tint : Colors.onSurfaceVariant}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        transparent
        visible={isThemeModalVisible}
        animationType="fade"
        onRequestClose={handleCloseThemeModal}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={handleCloseThemeModal}
          accessibilityRole="button"
        >
          <Pressable
            style={[
              styles.modalCard,
              MODAL_CARD_STYLE,
            ]}
            accessibilityLabel={t("ui.app_theme")}
            onPress={() => { }}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: Colors.onSurface, flex: 1 },
                ]}
              >
                {t("ui.app_theme")}
              </Text>
              <Pressable
                onPress={handleCloseThemeModal}
                accessibilityRole="button"
                accessibilityLabel={t("ui.ok")}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={Colors.onSurfaceVariant}
                />
              </Pressable>
            </View>
            <Text
              style={[
                styles.settingCaption,
                { color: Colors.onSurfaceVariant },
              ]}
            >
              {t("ui.select_theme")}
            </Text>
            <View style={styles.themeOptionRow}>
              {themeOptions.map((option) => {
                const isSelected = appTheme === option.key;
                return (
                  <Pressable
                    key={`theme-option-${option.key}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Set ${option.label} theme`}
                    onPress={() => handleSelectTheme(option.key)}
                    style={({ pressed }) => [
                      styles.themeOption,
                      {
                        borderColor: isSelected
                          ? Colors.tint
                          : Colors.outlineVariant,
                        backgroundColor: isSelected
                          ? Colors.tint
                          : Colors.surfaceBright,
                      },
                      pressed ? { opacity: 0.85 } : null,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={option.icon}
                      size={24}
                      color={
                        isSelected ? Colors.background : Colors.onSurfaceVariant
                      }
                    />
                    <Text
                      style={[
                        styles.themeOptionLabel,
                        {
                          color: isSelected
                            ? Colors.background
                            : Colors.onSurface,
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        transparent
        visible={isLanguageModalVisible}
        animationType="fade"
        onRequestClose={handleCloseLanguageModal}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={handleCloseLanguageModal}
          accessibilityRole="button"
        >
          <Pressable
            style={[
              styles.modalCard,
              MODAL_CARD_STYLE,
            ]}
            accessibilityLabel={t("ui.language")}
            onPress={() => { }}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: Colors.onSurface, flex: 1 },
                ]}
              >
                {t("ui.language")}
              </Text>
              <Pressable
                onPress={handleCloseLanguageModal}
                accessibilityRole="button"
                accessibilityLabel={t("ui.ok")}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={Colors.onSurfaceVariant}
                />
              </Pressable>
            </View>
            <Text
              style={[
                styles.settingCaption,
                { color: Colors.onSurfaceVariant },
              ]}
            >
              {t("ui.language_description", { label: selectedLanguageOption?.label ?? "English" })}
            </Text>
            <View style={styles.themeOptionRow}>
              {LANGUAGE_OPTIONS.map((option) => {
                const isSelected = appLanguage === option.key;
                return (
                  <Pressable
                    key={`language-option-${option.key}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Set ${option.label} language`}
                    onPress={() => handleSelectLanguage(option.key)}
                    style={({ pressed }) => [
                      styles.themeOption,
                      {
                        borderColor: isSelected
                          ? Colors.tint
                          : Colors.outlineVariant,
                        backgroundColor: isSelected
                          ? Colors.tint
                          : Colors.surfaceBright,
                      },
                      pressed ? { opacity: 0.85 } : null,
                    ]}
                  >
                    <View style={styles.modalFlagContainer}>
                      <Text style={styles.modalFlagText}>{option.flag}</Text>
                    </View>
                    <Text
                      style={[
                        styles.themeOptionLabel,
                        {
                          color: isSelected
                            ? Colors.background
                            : Colors.onSurface,
                        },
                      ]}
                    >
                      {option.label}
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
    backgroundColor: "transparent",
  },
  backdropArea: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    flex: 1,
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  menuScroll: {
    flex: 1,
  },
  menuContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 24,
    gap: 8,
  },
  headerContainer: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingRight: 10,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
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
    alignItems: "center",
    justifyContent: "center",
  },
  actionIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  settingTextContainer: {
    flex: 1,
    gap: 4,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  settingCaption: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxHeight: "92%",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 4,
  },
  startScreenModalScroll: {
    maxHeight: "100%",
    width: "100%",
  },
  startScreenOptionList: {
    gap: 4,
  },
  startScreenOption: {
    flexDirection: "row",
    alignItems: "center",
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
    alignItems: "center",
    justifyContent: "center",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tagAddButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tagAddLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  tagRows: {
    gap: 12,
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  tagActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tagEmpty: {
    fontSize: 12,
  },
  versionRow: {
    marginTop: 4,
    alignItems: "center",
    paddingTop: 12,
  },
  versionText: {
    fontSize: 12,
    fontWeight: "400",
  },
  ratingOptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  ratingOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  ratingOptionLabel: {
    fontWeight: "700",
  },
  themeOptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 8,
  },
  themeOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  themeOptionLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  flagIconContainer: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  flagIcon: {
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: "center",
  },
  modalFlagContainer: {
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  modalFlagText: {
    fontSize: 24,
    lineHeight: 32,
    textAlignVertical: "center",
  },
});
