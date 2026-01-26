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
import { Colors } from "@/constants/theme";
import { type InventoryData } from "@/libs/inventory-data";
import { buildPhotoBaseName } from "@/libs/photo-utils";
import { useInventory, type StartScreen } from "@/providers/inventory-provider";

const MENU_WIDTH = Math.round(Dimensions.get("window").width * 0.75);
const ANIMATION_DURATION = 200;

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

const START_SCREEN_OPTIONS: StartScreenOption[] = [
  {
    key: "cocktails_all",
    label: "All cocktails",
    description: "Browse every recipe",
    icon: { type: "asset", source: CocktailIcon },
  },
  {
    key: "cocktails_my",
    label: "My cocktails",
    description: "See your creations first",
    icon: { type: "icon", name: "cup-water" },
  },
  {
    key: "cocktails_favorites",
    label: "Favorite cocktails",
    description: "Jump into saved cocktails",
    icon: { type: "icon", name: "star" },
  },
  {
    key: "shaker",
    label: "Shaker",
    description: "Mix based on your inventory",
    icon: { type: "asset", source: ShakerIcon },
  },
  {
    key: "ingredients_all",
    label: "All ingredients",
    description: "Manage every ingredient",
    icon: { type: "asset", source: IngredientsIcon },
  },
  {
    key: "ingredients_my",
    label: "My ingredients",
    description: "Start with what you own",
    icon: { type: "icon", name: "check-circle" },
  },
  {
    key: "ingredients_shopping",
    label: "Shopping list",
    description: "Head to your shopping items",
    icon: { type: "materialIcon", name: "shopping-cart" },
  },
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
    ratingFilterThreshold,
    setRatingFilterThreshold,
    startScreen,
    setStartScreen,
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
      actions: [{ label: "OK" }],
    });
  };

  const isValidInventoryData = (
    candidate: unknown,
  ): candidate is InventoryData => {
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
        "Export unavailable",
        "Load your inventory before exporting.",
      );
      return;
    }

    setIsExporting(true);

    try {
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!sharingAvailable) {
        showDialogMessage(
          "Sharing unavailable",
          "Sharing is not available on this device.",
        );
        return;
      }

      const directory =
        FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!directory) {
        showDialogMessage("Export failed", "Unable to access device storage.");
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
        dialogTitle: "Export cocktails & ingredients",
        UTI: "public.json",
      });
    } catch (error) {
      console.error("Failed to export inventory data", error);
      showDialogMessage("Export failed", "Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const base64Chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  const base64ToBytes = (base64: string) => {
    const cleaned = base64.replace(/[^A-Za-z0-9+/=]/g, "");
    const padding = cleaned.endsWith("==") ? 2 : cleaned.endsWith("=") ? 1 : 0;
    const byteLength = (cleaned.length * 3) / 4 - padding;
    const bytes = new Uint8Array(byteLength);
    let byteIndex = 0;

    for (let i = 0; i < cleaned.length; i += 4) {
      const enc1 = base64Chars.indexOf(cleaned[i]);
      const enc2 = base64Chars.indexOf(cleaned[i + 1]);
      const enc3 = base64Chars.indexOf(cleaned[i + 2]);
      const enc4 = base64Chars.indexOf(cleaned[i + 3]);

      const byte1 = (enc1 << 2) | (enc2 >> 4);
      const byte2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const byte3 = ((enc3 & 3) << 6) | enc4;

      bytes[byteIndex++] = byte1;
      if (cleaned[i + 2] !== "=") {
        bytes[byteIndex++] = byte2;
      }
      if (cleaned[i + 3] !== "=") {
        bytes[byteIndex++] = byte3;
      }
    }

    return bytes;
  };

  const bytesToBase64 = (bytes: Uint8Array) => {
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += 3) {
      const byte1 = bytes[i];
      const byte2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
      const byte3 = i + 2 < bytes.length ? bytes[i + 2] : 0;

      const enc1 = byte1 >> 2;
      const enc2 = ((byte1 & 3) << 4) | (byte2 >> 4);
      const enc3 = ((byte2 & 15) << 2) | (byte3 >> 6);
      const enc4 = byte3 & 63;

      if (i + 1 >= bytes.length) {
        chunks.push(`${base64Chars[enc1]}${base64Chars[enc2]}==`);
      } else if (i + 2 >= bytes.length) {
        chunks.push(
          `${base64Chars[enc1]}${base64Chars[enc2]}${base64Chars[enc3]}=`,
        );
      } else {
        chunks.push(
          `${base64Chars[enc1]}${base64Chars[enc2]}${base64Chars[enc3]}${base64Chars[enc4]}`,
        );
      }
    }
    return chunks.join("");
  };

  const createTarArchive = (
    files: Array<{ path: string; contents: Uint8Array }>,
  ) => {
    const encoder = new TextEncoder();
    const blocks: Uint8Array[] = [];
    let totalLength = 0;

    const writeString = (
      buffer: Uint8Array,
      offset: number,
      text: string,
      length: number,
    ) => {
      const encoded = encoder.encode(text);
      buffer.set(encoded.slice(0, length), offset);
    };

    const writeOctal = (
      buffer: Uint8Array,
      offset: number,
      length: number,
      value: number,
    ) => {
      const octal = value.toString(8).padStart(length - 1, "0");
      writeString(buffer, offset, `${octal}\0`, length);
    };

    const writeChecksum = (buffer: Uint8Array) => {
      let sum = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        sum += buffer[i];
      }
      const checksum = sum.toString(8).padStart(6, "0");
      writeString(buffer, 148, `${checksum}\0 `, 8);
    };

    const addFile = (filePath: string, contents: Uint8Array) => {
      const header = new Uint8Array(512);
      writeString(header, 0, filePath, 100);
      writeString(header, 100, "0000777\0", 8);
      writeString(header, 108, "0000000\0", 8);
      writeString(header, 116, "0000000\0", 8);
      writeOctal(header, 124, 12, contents.length);
      writeOctal(header, 136, 12, Math.floor(Date.now() / 1000));
      writeString(header, 148, "        ", 8);
      writeString(header, 156, "0", 1);
      writeString(header, 257, "ustar\0", 6);
      writeString(header, 263, "00", 2);
      writeChecksum(header);

      blocks.push(header);
      totalLength += header.length;

      blocks.push(contents);
      totalLength += contents.length;

      const paddingLength = (512 - (contents.length % 512)) % 512;
      if (paddingLength > 0) {
        blocks.push(new Uint8Array(paddingLength));
        totalLength += paddingLength;
      }
    };

    files.forEach((file) => addFile(file.path, file.contents));

    blocks.push(new Uint8Array(1024));
    totalLength += 1024;

    const archive = new Uint8Array(totalLength);
    let offset = 0;
    blocks.forEach((block) => {
      archive.set(block, offset);
      offset += block.length;
    });

    return bytesToBase64(archive);
  };

  const handleBackupPhotos = async () => {
    if (isBackingUpPhotos) {
      return;
    }

    const photoEntries = exportInventoryPhotoEntries();
    if (!photoEntries) {
      showDialogMessage(
        "Backup unavailable",
        "Load your inventory before backing up photos.",
      );
      return;
    }

    setIsBackingUpPhotos(true);

    try {
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!sharingAvailable) {
        showDialogMessage(
          "Sharing unavailable",
          "Sharing is not available on this device.",
        );
        return;
      }

      const directory =
        FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!directory) {
        showDialogMessage("Backup failed", "Unable to access device storage.");
        return;
      }

      const entries = photoEntries.filter((entry) => entry.uri);

      if (entries.length === 0) {
        showDialogMessage(
          "No photos to backup",
          "Add photos to cocktails or ingredients first.",
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
          "Backup failed",
          "Unable to find any stored photo files.",
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
        dialogTitle: "Backup cocktail & ingredient photos",
        UTI: "public.tar-archive",
      });
    } catch (error) {
      console.error("Failed to backup photos", error);
      showDialogMessage("Backup failed", "Please try again.");
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
        showDialogMessage("Import failed", "Unable to read the selected file.");
        return;
      }

      const contents = await FileSystem.readAsStringAsync(asset.uri);
      const parsed = JSON.parse(contents) as unknown;

      if (!isValidInventoryData(parsed)) {
        showDialogMessage(
          "Invalid file",
          "The selected file does not match the expected data format.",
        );
        return;
      }

      importInventoryData(parsed);
      onClose();
    } catch (error) {
      console.error("Failed to import inventory data", error);
      showDialogMessage(
        "Import failed",
        "Please try again with a valid JSON file.",
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
      title: "Delete tag",
      message: `Remove "${tag.name}"?`,
      actions: [
        { label: "Cancel", variant: "secondary" },
        {
          label: "Delete",
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
          accessibilityLabel="Close menu"
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
              Settings
            </Text>
          </View>
          {/* Preserve menu taps even if a text field elsewhere keeps the keyboard open. */}
          <ScrollView
            style={styles.menuScroll}
            contentContainerStyle={styles.menuContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reload bundled inventory"
              onPress={handleResetInventory}
              style={[
                styles.actionRow,
                {
                  borderColor: Colors.outline,
                  backgroundColor: Colors.surface,
                },
              ]}>
              <View style={[styles.actionIcon, { backgroundColor: Colors.surfaceVariant }]}>
                <MaterialCommunityIcons name="refresh" size={16} color={Colors.onSurfaceVariant} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: Colors.onSurface }]}>Reload bundled data</Text>
                <Text style={[styles.settingCaption, { color: Colors.onSurfaceVariant }]}>
                  Clear saved inventory and reload assets from data.json
                </Text>
              </View>
            </Pressable> */}
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ignoreGarnish }}
              onPress={toggleIgnoreGarnish}
              style={[
                styles.settingRow,
                {
                  borderColor: Colors.outline,
                  backgroundColor: Colors.surface,
                },
              ]}
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
                  Ignore garnish
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  All garnishes are optional
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allowAllSubstitutes }}
              onPress={toggleAllowAllSubstitutes}
              style={[
                styles.settingRow,
                {
                  borderColor: Colors.outline,
                  backgroundColor: Colors.surface,
                },
              ]}
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
                  Allow all substitutes
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  Always use substitutes
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
                  borderColor: Colors.outline,
                  backgroundColor: Colors.surface,
                },
              ]}
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
                  Show in imperial
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  Use oz instead of ml and grams
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: keepScreenAwake }}
              onPress={toggleKeepScreenAwake}
              style={[
                styles.settingRow,
                {
                  borderColor: Colors.outline,
                  backgroundColor: Colors.surface,
                },
              ]}
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
                  Keep screen awake
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  Prevent sleep on cocktail view
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Set starting screen"
              onPress={handleStartScreenPress}
              style={[
                styles.settingRow,
                {
                  borderColor: Colors.outline,
                  backgroundColor: Colors.surface,
                },
              ]}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: Colors.tint,
                    backgroundColor: Colors.surfaceVariant,
                  },
                ]}
              >
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
                  Starting screen
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  Open {selectedStartScreenOption?.label ?? "All cocktails"}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Set favorites rating filter"
              onPress={handleRatingThresholdPress}
              style={[
                styles.settingRow,
                {
                  borderColor: Colors.outline,
                  backgroundColor: Colors.surface,
                },
              ]}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: Colors.tint,
                    backgroundColor: Colors.surfaceVariant,
                  },
                ]}
              >
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
                  Favorites rating filter
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  Showing {ratingFilterThreshold}+ stars cocktails
                </Text>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Manage custom tags"
              onPress={handleOpenTagManager}
              style={[
                styles.settingRow,
                {
                  borderColor: Colors.outline,
                  backgroundColor: Colors.surface,
                },
              ]}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: Colors.tint,
                    backgroundColor: Colors.surfaceVariant,
                  },
                ]}
              >
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
                  Manage tags
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  Create or update your tags
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Export cocktails and ingredients"
              onPress={handleExportInventory}
              disabled={isExporting || isImporting}
              style={({ pressed }) => [
                styles.actionRow,
                {
                  borderColor: Colors.outline,
                  backgroundColor: Colors.surface,
                },
                pressed || isExporting ? { opacity: 0.8 } : null,
              ]}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: Colors.surfaceVariant },
                ]}
              >
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
                  {isExporting ? "Exporting data..." : "Export data"}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  Backup data to a file
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Import cocktails and ingredients"
              onPress={handleImportInventory}
              disabled={isExporting || isImporting}
              style={({ pressed }) => [
                styles.actionRow,
                {
                  borderColor: Colors.outline,
                  backgroundColor: Colors.surface,
                },
                pressed || isImporting ? { opacity: 0.8 } : null,
              ]}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: Colors.surfaceVariant },
                ]}
              >
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
                  {isImporting ? "Importing data..." : "Import data"}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  Load backup from a file
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Backup cocktail and ingredient photos"
              onPress={handleBackupPhotos}
              disabled={isExporting || isImporting || isBackingUpPhotos}
              style={({ pressed }) => [
                styles.actionRow,
                {
                  borderColor: Colors.outline,
                  backgroundColor: Colors.surface,
                },
                pressed || isBackingUpPhotos ? { opacity: 0.8 } : null,
              ]}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: Colors.surfaceVariant },
                ]}
              >
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
                  {isBackingUpPhotos ? "Exporting photos..." : "Export photos"}
                </Text>
                <Text
                  style={[
                    styles.settingCaption,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  Save photos as an archive
                </Text>
              </View>
            </Pressable>
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
              {
                backgroundColor: Colors.surface,
                borderColor: Colors.outline,
                shadowColor: Colors.shadow,
              },
            ]}
            accessibilityLabel="Favorites rating"
            onPress={() => {}}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: Colors.onSurface, flex: 1 },
                ]}
              >
                Favorites rating
              </Text>
              <Pressable
                onPress={handleCloseRatingModal}
                accessibilityRole="button"
                accessibilityLabel="Close"
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
              {
                backgroundColor: Colors.surface,
                borderColor: Colors.outline,
                shadowColor: Colors.shadow,
              },
            ]}
            accessibilityLabel="Manage tags"
            onPress={() => {}}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: Colors.onSurface, flex: 1 },
                ]}
              >
                Manage tags
              </Text>
              <Pressable
                onPress={handleCloseTagManager}
                accessibilityRole="button"
                accessibilityLabel="Close"
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
                    Cocktail tags
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
                      Add
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
                    No custom cocktail tags yet.
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
                                name: tag.name ?? "Tag",
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
                    Ingredient tags
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
                      Add
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
                    No custom ingredient tags yet.
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
                                name: tag.name ?? "Tag",
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
        title={tagEditorMode === "create" ? "New tag" : "Edit tag"}
        confirmLabel={tagEditorMode === "create" ? "Create" : "Save"}
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
              {
                backgroundColor: Colors.surface,
                borderColor: Colors.outline,
                shadowColor: Colors.shadow,
              },
            ]}
            accessibilityLabel="Starting screen"
            onPress={() => {}}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: Colors.onSurface, flex: 1 },
                ]}
              >
                Starting screen
              </Text>
              <Pressable
                onPress={handleCloseStartScreenModal}
                accessibilityRole="button"
                accessibilityLabel="Close"
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
              Select where the app opens
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
    paddingHorizontal: 10,
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
