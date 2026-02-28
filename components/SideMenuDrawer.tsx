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
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CocktailIcon from "@/assets/images/cocktails.svg";
import IngredientsIcon from "@/assets/images/ingredients.svg";
import ShakerIcon from "@/assets/images/shaker.svg";
import { AppDialog, type DialogOptions } from "@/components/AppDialog";
import { TagEditorModal } from "@/components/TagEditorModal";
import { TagPill } from "@/components/TagPill";
import { useAppColors } from "@/constants/theme";
import { AMAZON_STORES, AMAZON_STORE_KEYS, type AmazonStoreOverride } from "@/libs/amazon-stores";
import { base64ToBytes, bytesToBase64, createTarArchive, parseTarArchive } from "@/libs/archive-utils";
import { buildPhotoBaseName } from "@/libs/photo-utils";
import { useI18n } from "@/libs/i18n/use-i18n";
import { useInventory, type AppTheme, type StartScreen } from "@/providers/inventory-provider";
import { type ImportedPhotoEntry, type InventoryExportData, type InventoryExportFile } from "@/providers/inventory-types";
import Constants from "expo-constants";

const MAX_MENU_WIDTH = 500;
const MENU_WIDTH = Math.min(
  Math.round(Dimensions.get("window").width * 0.8),
  MAX_MENU_WIDTH,
);
const ANIMATION_DURATION = 200;
const APP_VERSION =
  Constants.expoConfig?.version ??
  Constants.manifest2?.extra?.expoClient?.version ??
  "unknown";

type StartScreenIcon =
  | {
    type: "icon";
    name: ComponentProps<typeof MaterialCommunityIcons>["name"];
  }
  | { type: "materialIcon"; name: ComponentProps<typeof MaterialIcons>["name"] }
  | { type: "asset"; source: ImageSource };

type StartScreenOption = {
  key: StartScreen;
  labelKey: string;
  descriptionKey: string;
  icon: StartScreenIcon;
};

const START_SCREEN_OPTIONS: StartScreenOption[] = [
  {
    key: "cocktails_all",
    labelKey: "startScreen.cocktails_all.label",
    descriptionKey: "startScreen.cocktails_all.description",
    icon: { type: "asset", source: CocktailIcon },
  },
  {
    key: "cocktails_my",
    labelKey: "startScreen.cocktails_my.label",
    descriptionKey: "startScreen.cocktails_my.description",
    icon: { type: "icon", name: "cup-water" },
  },
  {
    key: "cocktails_favorites",
    labelKey: "startScreen.cocktails_favorites.label",
    descriptionKey: "startScreen.cocktails_favorites.description",
    icon: { type: "icon", name: "star" },
  },
  {
    key: "shaker",
    labelKey: "startScreen.shaker.label",
    descriptionKey: "startScreen.shaker.description",
    icon: { type: "asset", source: ShakerIcon },
  },
  {
    key: "ingredients_all",
    labelKey: "startScreen.ingredients_all.label",
    descriptionKey: "startScreen.ingredients_all.description",
    icon: { type: "asset", source: IngredientsIcon },
  },
  {
    key: "ingredients_my",
    labelKey: "startScreen.ingredients_my.label",
    descriptionKey: "startScreen.ingredients_my.description",
    icon: { type: "icon", name: "check-circle" },
  },
  {
    key: "ingredients_shopping",
    labelKey: "startScreen.ingredients_shopping.label",
    descriptionKey: "startScreen.ingredients_shopping.description",
    icon: { type: "materialIcon", name: "shopping-cart" },
  },
];

type ThemeOption = {
  key: AppTheme;
  labelKey: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
};

const THEME_OPTIONS: ThemeOption[] = [
  { key: "light", labelKey: "theme.light", icon: "white-balance-sunny" },
  { key: "dark", labelKey: "theme.dark", icon: "moon-waning-crescent" },
  { key: "system", labelKey: "theme.system", icon: "cellphone-settings" },
];

type SideMenuDrawerProps = {
  visible: boolean;
  onClose: () => void;
};

export function SideMenuDrawer({ visible, onClose }: SideMenuDrawerProps) {
  const {
    ignoreGarnish,
    setIgnoreGarnish,
    allowAllSubstitutes,
    setAllowAllSubstitutes,
    useImperialUnits,
    setUseImperialUnits,
    keepScreenAwake,
    setKeepScreenAwake,
    shakerSmartFilteringEnabled,
    setShakerSmartFilteringEnabled,
    ratingFilterThreshold,
    setRatingFilterThreshold,
    startScreen,
    setStartScreen,
    appTheme,
    setAppTheme,
    amazonStoreOverride,
    detectedAmazonStore,
    effectiveAmazonStore,
    setAmazonStoreOverride,
    restartOnboarding,
    resetInventoryFromBundle,
    exportInventoryData,
    exportInventoryPhotoEntries,
    importInventoryData,
    importInventoryPhotos,
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
  const insets = useSafeAreaInsets();
  const { t, locale, setLocale, languageOptions, currentLanguage } = useI18n();
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
  const [isAmazonStoreModalVisible, setAmazonStoreModalVisible] = useState(false);
  const [isLanguageModalVisible, setLanguageModalVisible] = useState(false);
  const [isBackupRestoreModalVisible, setBackupRestoreModalVisible] = useState(false);
  const amazonStoreModalCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const languageModalCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [isBackingUpData, setIsBackingUpData] = useState(false);
  const [isRestoringData, setIsRestoringData] = useState(false);
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

  const selectedStartScreenOption = useMemo(
    () => START_SCREEN_OPTIONS.find((option) => option.key === startScreen),
    [startScreen],
  );

  const selectedAmazonStoreLabel = useMemo(() => {
    if (!effectiveAmazonStore) {
      return t('settings.disabled');
    }

    return AMAZON_STORES[effectiveAmazonStore].label;
  }, [effectiveAmazonStore, t]);

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

  const toggleShakerSmartFiltering = () => {
    setShakerSmartFilteringEnabled(!shakerSmartFilteringEnabled);
  };

  const handleSmartShakerFilteringInfoPress = () => {
    setDialogOptions({
      title: t("sideMenu.smartShakerFilteringInfoTitle"),
      message: t("sideMenu.smartShakerFilteringInfoMessage"),
      actions: [{ label: t("common.gotIt"), variant: "secondary" }],
    });
  };

  const handleResetInventory = () => {
    setDialogOptions({
      title: t("sideMenu.restoreBundledData"),
      message:
        t("sideMenu.restoreBundledDataConfirmMessage"),
      actions: [
        { label: t("common.cancel"), variant: "secondary" },
        {
          label: t("sideMenu.restore"),
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

  const handleSelectTheme = (value: AppTheme) => {
    setAppTheme(value);
  };

  const handleAmazonStorePress = () => {
    setAmazonStoreModalVisible(true);
  };

  const handleBackupRestorePress = () => {
    setBackupRestoreModalVisible(true);
  };

  const handleLanguagePress = () => {
    setLanguageModalVisible(true);
  };

  const handleCloseLanguageModal = () => {
    clearTimeoutRef(languageModalCloseTimeout);
    setLanguageModalVisible(false);
  };

  const handleSelectLanguage = (value: "en-GB" | "en-US" | "uk-UA") => {
    setLocale(value);
    scheduleModalClose(languageModalCloseTimeout, setLanguageModalVisible);
  };

  const handleCloseAmazonStoreModal = () => {
    clearTimeoutRef(amazonStoreModalCloseTimeout);
    setAmazonStoreModalVisible(false);
  };

  const handleSelectAmazonStore = (value: AmazonStoreOverride | null) => {
    setAmazonStoreOverride(value);
    scheduleModalClose(amazonStoreModalCloseTimeout, setAmazonStoreModalVisible);
  };

  const handleCloseBackupRestoreModal = () => {
    setBackupRestoreModalVisible(false);
  };

  const handleBackupDataFromModal = () => {
    handleCloseBackupRestoreModal();
    void handleBackupData();
  };

  const handleRestoreDataFromModal = () => {
    handleCloseBackupRestoreModal();
    void handleRestoreData();
  };

  const handleResetInventoryFromModal = () => {
    handleCloseBackupRestoreModal();
    handleResetInventory();
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
      actions: [{ label: t("common.ok") }],
    });
  };


  const parsePhotoEntryFromArchivePath = (path: string): {
    type: ImportedPhotoEntry['type'];
    id: number;
    extension: string;
  } | null => {
    const normalizedPath = path.trim().replace(/^\/+/, "");
    const [category, filename] = normalizedPath.split("/");
    if (!category || !filename) {
      return null;
    }

    if (category !== "cocktails" && category !== "ingredients") {
      return null;
    }

    const extensionMatch = filename.match(/\.([a-zA-Z0-9]+)$/);
    const extension = extensionMatch?.[1]?.toLowerCase() ?? "jpg";
    const idMatch = filename.match(/^(\d+)-/);
    if (!idMatch) {
      return null;
    }

    const id = Number(idMatch[1]);
    if (!Number.isFinite(id) || id < 0) {
      return null;
    }

    return {
      type: category,
      id: Math.trunc(id),
      extension,
    };
  };

  const isValidInventoryData = (candidate: unknown): candidate is InventoryExportData => {
    if (!candidate || typeof candidate !== "object") {
      return false;
    }

    const record = candidate as { cocktails?: unknown; ingredients?: unknown };
    return Array.isArray(record.cocktails) && Array.isArray(record.ingredients);
  };

  const isInventoryExportFile = (candidate: unknown): candidate is InventoryExportFile => {
    if (!candidate || typeof candidate !== "object") {
      return false;
    }

    const record = candidate as { kind?: unknown; schemaVersion?: unknown };
    return (record.kind === "base" || record.kind === "translations") && typeof record.schemaVersion === "number";
  };

  const handleBackupData = async () => {
    if (isBackingUpData) {
      return;
    }

    const data = exportInventoryData();
    if (!data) {
      showDialogMessage(
        t("sideMenu.exportUnavailableTitle"),
        t("sideMenu.exportUnavailableMessage"),
      );
      return;
    }

    const photoEntries = exportInventoryPhotoEntries();
    if (!photoEntries) {
      showDialogMessage(
        t("sideMenu.backupUnavailableTitle"),
        t("sideMenu.backupUnavailableMessage"),
      );
      return;
    }

    setIsBackingUpData(true);

    try {
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!sharingAvailable) {
        showDialogMessage(
          t("sideMenu.sharingUnavailableTitle"),
          t("sideMenu.sharingUnavailableMessage"),
        );
        return;
      }

      const directory =
        FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!directory) {
        showDialogMessage(t("sideMenu.exportFailedTitle"), t("sideMenu.deviceStorageUnavailable"));
        return;
      }

      const files: { path: string; contents: Uint8Array }[] = [];
      const encoder = new TextEncoder();
      data.forEach((file) => {
        const path = file.kind === 'base' ? 'base.json' : `translations.${file.locale}.json`;
        files.push({
          path,
          contents: encoder.encode(JSON.stringify(file, null, 2)),
        });
      });

      const entries = photoEntries.filter((entry) => entry.uri);
      const nameCounts = new Map<string, number>();

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
        files.push({ path: `${entry.type}/${fileName}`, contents });
      }

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `yourbar-backup-${timestamp}.tar`;
      const fileUri = `${directory.replace(/\/?$/, "/")}${filename}`;
      const archiveBase64 = createTarArchive(files);
      await FileSystem.writeAsStringAsync(fileUri, archiveBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: "application/x-tar",
        dialogTitle: t("sideMenu.backupData"),
        UTI: "public.tar-archive",
      });
    } catch (error) {
      console.error("Failed to back up data", error);
      showDialogMessage(t("sideMenu.backupFailedTitle"), t("common.tryAgainLater"));
    } finally {
      setIsBackingUpData(false);
    }
  };

  const handleRestoreData = async () => {
    if (isRestoringData) {
      return;
    }

    setIsRestoringData(true);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/x-tar", "public.tar-archive"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        showDialogMessage(t("sideMenu.importFailedTitle"), t("sideMenu.importReadArchiveFailed"));
        return;
      }

      const archiveBase64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const archiveBytes = base64ToBytes(archiveBase64);
      const archivedFiles = parseTarArchive(archiveBytes);

      if (archivedFiles.length === 0) {
        showDialogMessage(t("sideMenu.importFailedTitle"), t("sideMenu.importArchiveEmpty"));
        return;
      }

      const decoder = new TextDecoder();
      const importFiles: InventoryExportFile[] = [];
      let hasLegacyBase = false;
      let legacyBase: InventoryExportData | null = null;
      for (const archived of archivedFiles) {
        if (!archived.path.toLowerCase().endsWith('.json')) {
          continue;
        }

        const parsed = JSON.parse(decoder.decode(archived.contents)) as unknown;
        if (isInventoryExportFile(parsed)) {
          importFiles.push(parsed);
        } else if (isValidInventoryData(parsed) && !hasLegacyBase) {
          hasLegacyBase = true;
          legacyBase = parsed;
        }
      }

      if (importFiles.length === 0 && !legacyBase) {
        showDialogMessage(t("sideMenu.importFailedTitle"), t("sideMenu.importMissingInventory"));
        return;
      }

      importInventoryData(importFiles.length > 0 ? importFiles : (legacyBase as InventoryExportData));

      const directory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
      if (!directory) {
        showDialogMessage(t("sideMenu.importFailedTitle"), t("sideMenu.deviceStorageUnavailable"));
        return;
      }

      const importedPhotoEntries: ImportedPhotoEntry[] = [];
      const timestamp = Date.now();
      const photosDir = `${directory.replace(/\/?$/, "/")}imported-photos/`;
      await FileSystem.makeDirectoryAsync(photosDir, { intermediates: true });

      for (const file of archivedFiles) {
        if (file.path.toLowerCase().endsWith('.json')) {
          continue;
        }

        const parsedPath = parsePhotoEntryFromArchivePath(file.path);
        if (!parsedPath || file.contents.length === 0) {
          continue;
        }

        const outputFileName = `${parsedPath.type}-${parsedPath.id}-${timestamp}.${parsedPath.extension}`;
        const destinationUri = `${photosDir}${outputFileName}`;
        await FileSystem.writeAsStringAsync(destinationUri, bytesToBase64(file.contents), {
          encoding: FileSystem.EncodingType.Base64,
        });

        importedPhotoEntries.push({
          type: parsedPath.type,
          id: parsedPath.id,
          photoUri: destinationUri,
        });
      }

      importInventoryPhotos(importedPhotoEntries);
      onClose();
    } catch (error) {
      console.error("Failed to restore backup archive", error);
      showDialogMessage(
        t("sideMenu.importFailedTitle"),
        t("sideMenu.importRetryWithValidArchive"),
      );
    } finally {
      setIsRestoringData(false);
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
      title: t("sideMenu.deleteTagTitle"),
      message: t("sideMenu.deleteTagMessage", { name: tag.name }),
      actions: [
        { label: t("common.cancel"), variant: "secondary" },
        {
          label: t("common.delete"),
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

  const handleReportIssue = async () => {
    const subject = `${t("sideMenu.reportIssueSubject")} - ${APP_VERSION}`;
    const mailtoUrl = `mailto:your.bar.app@gmail.com?subject=${encodeURIComponent(subject)}`;

    try {
      await Linking.openURL(mailtoUrl);
    } catch (error) {
      console.error("Failed to open email client", error);
      showDialogMessage(
        t("sideMenu.emailUnavailableTitle"),
        t("sideMenu.emailUnavailableMessage"),
      );
    }
  };

  const handleRateApp = async () => {
    const iosAppStoreId = Constants.expoConfig?.extra?.iosAppStoreId;
    const androidPackageName =
      Constants.expoConfig?.android?.package ?? Constants.manifest2?.extra?.expoClient?.android?.package;

    const rateUrl = Platform.select({
      ios: iosAppStoreId
        ? `itms-apps://itunes.apple.com/app/viewContentsUserReviews/id${iosAppStoreId}?action=write-review`
        : null,
      android: androidPackageName ? `market://details?id=${androidPackageName}` : null,
      default: null,
    });

    if (!rateUrl) {
      showDialogMessage(t("common.error"), t("common.tryAgainLater"));
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(rateUrl);
      if (canOpen) {
        await Linking.openURL(rateUrl);
        return;
      }

      if (Platform.OS === "android" && androidPackageName) {
        await Linking.openURL(
          `https://play.google.com/store/apps/details?id=${androidPackageName}`,
        );
        return;
      }

      showDialogMessage(t("common.error"), t("common.tryAgainLater"));
    } catch (error) {
      console.error("Failed to open app rating", error);
      showDialogMessage(t("common.error"), t("common.tryAgainLater"));
    }
  };

  useEffect(() => {
    return () => {
      clearTimeoutRef(ratingModalCloseTimeout);
      clearTimeoutRef(startScreenModalCloseTimeout);
      clearTimeoutRef(amazonStoreModalCloseTimeout);
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
          accessibilityLabel={t("sideMenu.closeMenu")}
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
              {
                backgroundColor: Colors.surface,
                paddingTop: Math.max(insets.top, 16) + 16,
              },
            ]}
          >
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: Colors.onSurface }]}>
                {t("sideMenu.settingsTitle")}
              </Text>
              <View
                style={[
                  styles.themeToggle,
                  {
                    borderColor: Colors.outline,
                    backgroundColor: Colors.surfaceBright,
                  },
                ]}
              >
                {THEME_OPTIONS.map((option) => {
                  const isSelected = appTheme === option.key;

                  return (
                    <Pressable
                      key={`header-theme-option-${option.key}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={t("sideMenu.setThemeA11y", { theme: t(option.labelKey) })}
                      onPress={() => handleSelectTheme(option.key)}
                      style={({ pressed }) => [
                        styles.themeToggleOption,
                        {
                          backgroundColor: isSelected
                            ? Colors.tint
                            : "transparent",
                        },
                        pressed ? { opacity: 0.85 } : null,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={option.icon}
                        size={15}
                        color={
                          isSelected
                            ? Colors.background
                            : Colors.onSurfaceVariant
                        }
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>
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
                  {t("sideMenu.ignoreGarnish")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("sideMenu.ignoreGarnishCaption")}
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
                  {t("sideMenu.allowAllSubstitutes")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("sideMenu.allowAllSubstitutesCaption")}
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
                  {t("sideMenu.useImperial")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("sideMenu.useImperialCaption")}
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
                  {t("sideMenu.keepScreenAwake")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("sideMenu.keepScreenAwakeCaption")}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: shakerSmartFilteringEnabled }}
              onPress={toggleShakerSmartFiltering}
              style={[styles.settingRow, SURFACE_ROW_STYLE]}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: shakerSmartFilteringEnabled
                      ? Colors.tint
                      : Colors.outlineVariant,
                    backgroundColor: shakerSmartFilteringEnabled
                      ? Colors.tint
                      : "transparent",
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="check"
                  size={16}
                  color={
                    shakerSmartFilteringEnabled ? Colors.background : Colors.outlineVariant
                  }
                />
              </View>
              <View style={styles.settingTextContainer}>
                <View style={styles.settingLabelRow}>
                  <Text
                    style={[styles.settingLabel, { color: Colors.onSurface }]}
                  >
                    {t("sideMenu.smartShakerFiltering")}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("sideMenu.smartShakerFilteringInfo")}
                    hitSlop={8}
                    onPress={(event) => {
                      event.stopPropagation();
                      handleSmartShakerFilteringInfoPress();
                    }}
                    style={styles.settingInfoButton}
                  >
                    <MaterialCommunityIcons
                      name="help-circle-outline"
                      size={16}
                      color={Colors.primary}
                    />
                  </Pressable>
                </View>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("sideMenu.smartShakerFilteringCaption")}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("sideMenu.startingScreen")}
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
                  {t("sideMenu.startingScreen")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("sideMenu.startingScreenOpen", { screen: selectedStartScreenOption ? t(selectedStartScreenOption.labelKey) : t("startScreen.cocktails_all.label") })}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={Colors.onSurfaceVariant}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("sideMenu.favoritesRatingFilter")}
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
                  {t("sideMenu.favoritesRatingFilter")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("sideMenu.favoritesRatingFilterCaption", { rating: ratingFilterThreshold })}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={Colors.onSurfaceVariant}
              />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("sideMenu.manageTags")}
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
                  {t("sideMenu.manageTags")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("sideMenu.manageTagsCaption")}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={Colors.onSurfaceVariant}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("sideMenu.amazonStore")}
              onPress={handleAmazonStorePress}
              style={[styles.settingRow, SURFACE_ROW_STYLE]}
            >
              <View style={[styles.checkbox, SURFACE_ICON_STYLE]}>
                <MaterialCommunityIcons
                  name="shopping"
                  size={16}
                  color={Colors.tint}
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[styles.settingLabel, { color: Colors.onSurface }]}
                >
                  {t("sideMenu.amazonStore")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("sideMenu.amazonStoreCurrent", { label: selectedAmazonStoreLabel })}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={Colors.onSurfaceVariant}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("sideMenu.language")}
              onPress={handleLanguagePress}
              style={[styles.settingRow, SURFACE_ROW_STYLE]}
            >
              <Text style={styles.languageFlagIcon}>{currentLanguage.flag}</Text>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[styles.settingLabel, { color: Colors.onSurface }]}
                >
                  {t("sideMenu.language")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("sideMenu.languageCurrent", { name: currentLanguage.nativeName })}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={Colors.onSurfaceVariant}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("sideMenu.restartOnboarding")}
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
                <Text style={[styles.settingLabel, { color: Colors.onSurface }]}>{t("sideMenu.restartOnboarding")}</Text>
                <Text style={[styles.settingCaption, { color: Colors.onSurfaceVariant }]}>
                  {t("sideMenu.restartOnboardingCaption")}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("sideMenu.backupRestore")}
              onPress={handleBackupRestorePress}
              style={({ pressed }) => [
                styles.actionRow,
                SURFACE_ROW_STYLE,
                pressed ? { opacity: 0.8 } : null,
              ]}>
              <View style={[styles.actionIcon, ACTION_ICON_STYLE]}>
                <MaterialCommunityIcons name="backup-restore" size={16} color={Colors.onSurfaceVariant} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: Colors.onSurface }]}>{t("sideMenu.backupRestore")}</Text>
                <Text style={[styles.settingCaption, { color: Colors.onSurfaceVariant }]}>
                  {t("sideMenu.backupRestoreCaption")}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={Colors.onSurfaceVariant}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("sideMenu.rateAppTitle")}
              onPress={handleRateApp}
              style={[
                styles.actionRow,
                SURFACE_ROW_STYLE,
              ]}
            >
              <View style={[styles.actionIcon, ACTION_ICON_STYLE]}>
                <MaterialCommunityIcons
                  name="star-circle-outline"
                  size={16}
                  color={Colors.onSurfaceVariant}
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: Colors.onSurface }]}>{t("sideMenu.rateAppTitle")}</Text>
                <Text style={[styles.settingCaption, { color: Colors.onSurfaceVariant }]}>{t("sideMenu.rateAppCaption")}</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("sideMenu.reportIssueTitle")}
              onPress={handleReportIssue}
              style={[
                styles.actionRow,
                SURFACE_ROW_STYLE,
              ]}
            >
              <View style={[styles.actionIcon, ACTION_ICON_STYLE]}>
                <MaterialCommunityIcons
                  name="email-alert-outline"
                  size={16}
                  color={Colors.onSurfaceVariant}
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: Colors.onSurface }]}>{t("sideMenu.reportIssueTitle")}</Text>
                <Text style={[styles.settingCaption, { color: Colors.onSurfaceVariant }]}>{t("sideMenu.reportIssueCaption")}</Text>
              </View>
            </Pressable>
            <View style={styles.versionRow}>
              <Text
                style={[styles.versionText, { color: Colors.onSurfaceVariant }]}
              >
                {t("sideMenu.version", { version: APP_VERSION })}
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
            accessibilityLabel={t("sideMenu.favoritesRatingFilter")}
            onPress={() => { }}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: Colors.onSurface, flex: 1 },
                ]}
              >
                {t("sideMenu.favoritesRatingFilter")}
              </Text>
              <Pressable
                onPress={handleCloseRatingModal}
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
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
              {t("sideMenu.favoritesRatingModalDescription")}
            </Text>
            <View style={styles.ratingOptionRow}>
              {[1, 2, 3, 4, 5].map((value) => {
                const isSelected = value === ratingFilterThreshold;
                return (
                  <Pressable
                    key={`rating-threshold-${value}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={t("sideMenu.favoritesRatingOption", { value })}
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
            accessibilityLabel={t("sideMenu.manageTags")}
            onPress={() => { }}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: Colors.onSurface, flex: 1 },
                ]}
              >
                {t("sideMenu.manageTags")}
              </Text>
              <Pressable
                onPress={handleCloseTagManager}
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
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
                    {t("sideMenu.cocktailTags")}
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
                      {t("common.create")}
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
                    {t("sideMenu.noCustomCocktailTags")}
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
                            accessibilityLabel={t("sideMenu.editNamedTagA11y", { name: tag.name ?? t("sideMenu.tagFallbackName") })}
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
                            accessibilityLabel={t("sideMenu.deleteNamedTagA11y", { name: tag.name ?? t("sideMenu.tagFallbackName") })}
                            onPress={() =>
                              handleDeleteTag("cocktail", {
                                id: Number(tag.id),
                                name: tag.name ?? t("sideMenu.tagFallbackName"),
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
                    {t("sideMenu.ingredientTags")}
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
                      {t("common.create")}
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
                    {t("sideMenu.noCustomIngredientTags")}
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
                            accessibilityLabel={t("sideMenu.editNamedTagA11y", { name: tag.name ?? t("sideMenu.tagFallbackName") })}
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
                            accessibilityLabel={t("sideMenu.deleteNamedTagA11y", { name: tag.name ?? t("sideMenu.tagFallbackName") })}
                            onPress={() =>
                              handleDeleteTag("ingredient", {
                                id: Number(tag.id),
                                name: tag.name ?? t("sideMenu.tagFallbackName"),
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
        title={tagEditorMode === "create" ? t("tagEditor.newTag") : t("tagEditor.editTag")}
        confirmLabel={tagEditorMode === "create" ? t("common.create") : t("common.save")}
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
            accessibilityLabel={t("sideMenu.startingScreen")}
            onPress={() => { }}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: Colors.onSurface, flex: 1 },
                ]}
              >
                {t("sideMenu.startingScreen")}
              </Text>
              <Pressable
                onPress={handleCloseStartScreenModal}
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
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
              {t("sideMenu.startScreenModalDescription")}
            </Text>
            <ScrollView
              style={styles.startScreenModalScroll}
              contentContainerStyle={styles.startScreenOptionList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {START_SCREEN_OPTIONS.map((option) => {
                const isSelected = startScreen === option.key;
                return (
                  <Pressable
                    key={`start-screen-${option.key}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={t("sideMenu.startScreenOptionA11y", { screen: t(option.labelKey) })}
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
                        {t(option.labelKey)}
                      </Text>
                      <Text
                        style={[
                          styles.settingCaption,
                          { color: Colors.onSurfaceVariant },
                        ]}
                      >
                        {t(option.descriptionKey)}
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
        visible={isAmazonStoreModalVisible}
        animationType="fade"
        onRequestClose={handleCloseAmazonStoreModal}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={handleCloseAmazonStoreModal}
          accessibilityRole="button"
        >
          <Pressable
            style={[
              styles.modalCard,
              MODAL_CARD_STYLE,
            ]}
            accessibilityLabel={t("sideMenu.amazonStore")}
            onPress={() => { }}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: Colors.onSurface, flex: 1 },
                ]}
              >
                {t("sideMenu.amazonStore")}
              </Text>
              <Pressable
                onPress={handleCloseAmazonStoreModal}
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
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
              {t("sideMenu.amazonStoreModalDescription")}
            </Text>
            <ScrollView
              style={styles.startScreenModalScroll}
              contentContainerStyle={styles.startScreenOptionList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Pressable
                key="amazon-store-auto"
                accessibilityRole="button"
                accessibilityState={{ selected: amazonStoreOverride == null }}
                accessibilityLabel={t("sideMenu.useAutomaticAmazonStoreDetection")}
                onPress={() => handleSelectAmazonStore(null)}
                style={({ pressed }) => [
                  styles.startScreenOption,
                  {
                    borderColor: amazonStoreOverride == null
                      ? Colors.tint
                      : Colors.outlineVariant,
                    backgroundColor: amazonStoreOverride == null
                      ? Colors.highlightFaint
                      : Colors.surfaceBright,
                  },
                  pressed ? { opacity: 0.85 } : null,
                ]}
              >
                <View style={styles.startScreenTextContainer}>
                  <Text
                    style={[
                      styles.settingLabel,
                      { color: Colors.onSurface },
                    ]}
                  >
                    {t("sideMenu.amazonStoreAutomatic")}
                  </Text>
                  <Text
                    style={[
                      styles.settingCaption,
                      { color: Colors.onSurfaceVariant },
                    ]}
                  >
                    {t("sideMenu.amazonStoreDetected", {
                      store: detectedAmazonStore
                        ? AMAZON_STORES[detectedAmazonStore].label
                        : t("sideMenu.amazonStoreUnknown"),
                    })}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name={
                    amazonStoreOverride == null
                      ? "check-circle"
                      : "checkbox-blank-circle-outline"
                  }
                  size={20}
                  color={amazonStoreOverride == null ? Colors.tint : Colors.onSurfaceVariant}
                />
              </Pressable>
              {AMAZON_STORE_KEYS.map((storeKey) => {
                const isSelected = amazonStoreOverride === storeKey;
                const option = AMAZON_STORES[storeKey];

                return (
                  <Pressable
                    key={`amazon-store-${storeKey}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={t("sideMenu.amazonStoreSetToA11y", { store: option.label })}
                    onPress={() => handleSelectAmazonStore(storeKey)}
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
                        {t(`amazon.country.${storeKey}`) !== `amazon.country.${storeKey}`
                          ? t(`amazon.country.${storeKey}`)
                          : option.countryName}
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
              <Pressable
                key="amazon-store-disabled"
                accessibilityRole="button"
                accessibilityState={{ selected: amazonStoreOverride === 'DISABLED' }}
                accessibilityLabel={t("sideMenu.disableAmazonLink")}
                onPress={() => handleSelectAmazonStore('DISABLED')}
                style={({ pressed }) => [
                  styles.startScreenOption,
                  {
                    borderColor: amazonStoreOverride === 'DISABLED'
                      ? Colors.tint
                      : Colors.outlineVariant,
                    backgroundColor: amazonStoreOverride === 'DISABLED'
                      ? Colors.highlightFaint
                      : Colors.surfaceBright,
                  },
                  pressed ? { opacity: 0.85 } : null,
                ]}
              >
                <View style={styles.startScreenTextContainer}>
                  <Text
                    style={[
                      styles.settingLabel,
                      { color: Colors.onSurface },
                    ]}
                  >
                    {t("sideMenu.amazonStoreDisabled")}
                  </Text>
                  <Text
                    style={[
                      styles.settingCaption,
                      { color: Colors.onSurfaceVariant },
                    ]}
                  >
                    {t("sideMenu.amazonStoreHideLink")}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name={
                    amazonStoreOverride === 'DISABLED'
                      ? "check-circle"
                      : "checkbox-blank-circle-outline"
                  }
                  size={20}
                  color={amazonStoreOverride === 'DISABLED' ? Colors.tint : Colors.onSurfaceVariant}
                />
              </Pressable>
            </ScrollView>
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
            accessibilityLabel={t("languageModal.title")}
            onPress={() => { }}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: Colors.onSurface, flex: 1 }]}> 
                {t("languageModal.title")}
              </Text>
              <Pressable
                onPress={handleCloseLanguageModal}
                accessibilityRole="button"
                accessibilityLabel={t("languageModal.close")}
              >
                <MaterialCommunityIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </Pressable>
            </View>
            <Text style={[styles.settingCaption, { color: Colors.onSurfaceVariant }]}>
              {t("languageModal.description")}
            </Text>
            <ScrollView
              style={styles.startScreenModalScroll}
              contentContainerStyle={styles.startScreenOptionList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {languageOptions.map((option) => {
                const isSelected = locale === option.code;
                const localizedLanguageName = t(`language.${option.code}`);
                return (
                  <Pressable
                    key={`language-${option.code}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={t("languageModal.selectLanguage", { name: option.nativeName })}
                    onPress={() => handleSelectLanguage(option.code)}
                    style={({ pressed }) => [
                      styles.startScreenOption,
                      {
                        borderColor: isSelected ? Colors.tint : Colors.outlineVariant,
                        backgroundColor: isSelected ? Colors.highlightFaint : Colors.surfaceBright,
                      },
                      pressed ? { opacity: 0.85 } : null,
                    ]}
                  >
                    <Text style={styles.languageFlagIcon}>{option.flag}</Text>
                    <View style={styles.startScreenTextContainer}>
                      <Text style={[styles.settingLabel, { color: Colors.onSurface }]}>
                        {option.nativeName}
                      </Text>
                      <Text style={[styles.settingCaption, { color: Colors.onSurfaceVariant }]}>
                        {localizedLanguageName}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name={isSelected ? 'check-circle' : 'checkbox-blank-circle-outline'}
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
        visible={isBackupRestoreModalVisible}
        animationType="fade"
        onRequestClose={handleCloseBackupRestoreModal}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={handleCloseBackupRestoreModal}
          accessibilityRole="button"
        >
          <Pressable
            style={[
              styles.modalCard,
              MODAL_CARD_STYLE,
            ]}
            accessibilityLabel={t("sideMenu.backupRestore")}
            onPress={() => { }}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: Colors.onSurface, flex: 1 },
                ]}
              >
                {t("sideMenu.backupRestore")}
              </Text>
              <Pressable
                onPress={handleCloseBackupRestoreModal}
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={Colors.onSurfaceVariant}
                />
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("sideMenu.backupData")}
              onPress={handleBackupDataFromModal}
              disabled={isBackingUpData || isRestoringData}
              style={({ pressed }) => [
                styles.actionRow,
                styles.backupRestoreModalActionRow,
                {
                  borderColor: Colors.outlineVariant,
                  backgroundColor: Colors.surface,
                },
                pressed || isBackingUpData ? { opacity: 0.8 } : null,
              ]}
            >
              <View style={[styles.actionIcon, ACTION_ICON_STYLE]}>
                <MaterialCommunityIcons
                  name="content-save-outline"
                  size={16}
                  color={Colors.onSurfaceVariant}
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[styles.settingLabel, { color: Colors.onSurface }]}
                >
                  {isBackingUpData ? t("sideMenu.backingUpData") : t("sideMenu.backupData")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("sideMenu.backupDataDescription")}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("sideMenu.restoreData")}
              onPress={handleRestoreDataFromModal}
              disabled={isBackingUpData || isRestoringData}
              style={({ pressed }) => [
                styles.actionRow,
                styles.backupRestoreModalActionRow,
                {
                  borderColor: Colors.outlineVariant,
                  backgroundColor: Colors.surface,
                },
                pressed || isRestoringData ? { opacity: 0.8 } : null,
              ]}
            >
              <View style={[styles.actionIcon, ACTION_ICON_STYLE]}>
                <MaterialCommunityIcons
                  name="restore"
                  size={16}
                  color={Colors.onSurfaceVariant}
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text
                  style={[styles.settingLabel, { color: Colors.onSurface }]}
                >
                  {isRestoringData ? t("sideMenu.restoringData") : t("sideMenu.restoreData")}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("sideMenu.restoreDataDescription")}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("sideMenu.reloadBundledInventory")}
              onPress={handleResetInventoryFromModal}
              style={({ pressed }) => [
                styles.actionRow,
                styles.backupRestoreModalActionRow,
                {
                  borderColor: Colors.outlineVariant,
                  backgroundColor: Colors.surface,
                },
                pressed ? { opacity: 0.8 } : null,
              ]}
            >
              <View style={[styles.actionIcon, ACTION_ICON_STYLE]}>
                <MaterialCommunityIcons name="refresh" size={16} color={Colors.onSurfaceVariant} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: Colors.onSurface }]}>{t("sideMenu.restoreBundledData")}</Text>
                <Text style={[styles.settingCaption, { color: Colors.onSurfaceVariant }]}>{t("sideMenu.restoreBundledDataDescription")}</Text>
              </View>
            </Pressable>
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
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  themeToggle: {
    flexDirection: "row",
    alignItems: "center",
    padding: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 3,
  },
  themeToggleOption: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
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
  backupRestoreModalActionRow: {
    paddingLeft: 8,
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
  settingLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  settingInfoButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  settingCaption: {
    fontSize: 12,
  },
  languageFlagIcon: {
    fontSize: 18,
    lineHeight: 20,
    marginRight: 2,
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
    maxWidth: 500,
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
});
