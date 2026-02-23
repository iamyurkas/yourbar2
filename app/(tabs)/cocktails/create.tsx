import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { StackActions, useFocusEffect, useNavigation, type NavigationAction } from "@react-navigation/native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Stack, router, useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
  findNodeHandle,
} from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";

import { resolveAssetFromCatalog } from "@/assets/image-manifest";
import { AppDialog, type DialogOptions } from "@/components/AppDialog";
import { AppImage } from "@/components/AppImage";
import { HeaderIconButton } from "@/components/HeaderIconButton";
import { ListRow, Thumb } from "@/components/RowParts";
import { SubstituteModal } from "@/components/SubstituteModal";
import { TagEditorModal } from "@/components/TagEditorModal";
import { TagPill } from "@/components/TagPill";
import {
  METHOD_ICON_MAP,
  getCocktailMethodById,
  getCocktailMethods,
  type CocktailMethodId,
} from "@/constants/cocktail-methods";
import { BUILTIN_COCKTAIL_TAGS } from "@/constants/cocktail-tags";
import {
  COCKTAIL_UNIT_DICTIONARY,
  COCKTAIL_UNIT_OPTIONS,
} from "@/constants/cocktail-units";
import { GLASSWARE } from "@/constants/glassware";
import { useAppColors } from "@/constants/theme";
import {
  buildReturnToParams,
  parseReturnToParams,
  skipDuplicateBack,
} from "@/libs/navigation";
import { shouldStorePhoto, storePhoto } from "@/libs/photo-storage";
import { normalizeSearchText } from "@/libs/search-normalization";
import {
  useInventory,
  type Cocktail,
  type CreateCocktailInput,
  type Ingredient,
} from "@/providers/inventory-provider";
import { useUnsavedChanges } from "@/providers/unsaved-changes-provider";
import { tagColors } from "@/theme/theme";

const DEFAULT_METRIC_UNIT_ID = 11;
const DEFAULT_IMPERIAL_UNIT_ID = 12;
const MIN_AUTOCOMPLETE_LENGTH = 2;
const MAX_SUGGESTIONS = 8;
const INGREDIENT_REORDER_TRANSITION = LinearTransition.duration(180);

type EditableSubstitute = {
  key: string;
  ingredientId?: number;
  name: string;
  isBrand?: boolean;
};

type EditableIngredient = {
  key: string;
  ingredientId?: number;
  name: string;
  amount: string;
  unitId?: number;
  optional: boolean;
  garnish: boolean;
  allowBaseSubstitution: boolean;
  allowBrandSubstitution: boolean;
  allowStyleSubstitution: boolean;
  substitutes: EditableSubstitute[];
};

type CocktailFormSnapshot = {
  name: string;
  glassId: string | null;
  methodIds: CocktailMethodId[];
  description: string;
  instructions: string;
  imageUri: string | null;
  selectedTagIds: number[];
  ingredients: Array<{
    ingredientId?: number;
    name: string;
    amount: string;
    unitId?: number;
    optional: boolean;
    garnish: boolean;
    allowBaseSubstitution: boolean;
    allowBrandSubstitution: boolean;
    allowStyleSubstitution: boolean;
    substitutes: Array<{
      ingredientId?: number;
      name: string;
      isBrand?: boolean;
    }>;
  }>;
};

function getParamValue(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function createUniqueKey(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function createEditableSubstitute(
  parentKey: string,
  source: {
    ingredientId?: number | null;
    name?: string | null;
    brand?: boolean | null;
  },
): EditableSubstitute | undefined {
  const name = source.name?.trim();
  if (!name) {
    return undefined;
  }

  const ingredientValue = Number(source.ingredientId ?? -1);
  const substituteIngredientId =
    Number.isFinite(ingredientValue) && ingredientValue >= 0
      ? Math.trunc(ingredientValue)
      : undefined;

  return {
    key: createUniqueKey(`sub-${parentKey}`),
    ingredientId: substituteIngredientId,
    name,
    isBrand: source.brand ?? false,
  } satisfies EditableSubstitute;
}

function createEditableIngredient(
  defaultUnitId: number,
  initial?: Partial<EditableIngredient>,
): EditableIngredient {
  return {
    key: createUniqueKey("ingredient"),
    ingredientId: initial?.ingredientId,
    name: initial?.name ?? "",
    amount: initial?.amount ?? "",
    unitId: initial?.unitId ?? defaultUnitId,
    optional: initial?.optional ?? false,
    garnish: initial?.garnish ?? false,
    allowBaseSubstitution: initial?.allowBaseSubstitution ?? false,
    allowBrandSubstitution: initial?.allowBrandSubstitution ?? false,
    allowStyleSubstitution: initial?.allowStyleSubstitution ?? false,
    substitutes: initial?.substitutes ?? [],
  } satisfies EditableIngredient;
}

function shouldUsePluralUnits(amountRaw?: string) {
  if (!amountRaw) {
    return false;
  }
  const numericAmount = Number(amountRaw.trim());
  return Number.isFinite(numericAmount) && numericAmount !== 1;
}

function mapRecipeIngredientToEditable(
  recipe: NonNullable<Cocktail["ingredients"]>[number],
  defaultUnitId: number,
): EditableIngredient {
  const key = createUniqueKey("ingredient");
  const unitId =
    typeof recipe.unitId === "number" &&
      Number.isFinite(recipe.unitId) &&
      recipe.unitId >= 0
      ? Math.trunc(recipe.unitId)
      : undefined;

  const substitutes = (recipe.substitutes ?? [])
    .map((item) =>
      createEditableSubstitute(key, {
        ingredientId:
          typeof item.ingredientId === "number" ? item.ingredientId : undefined,
        name: item.name,
        brand: (item as { brand?: boolean }).brand ?? false,
      }),
    )
    .filter((item): item is EditableSubstitute => Boolean(item));

  return {
    key,
    ingredientId:
      typeof recipe.ingredientId === "number" &&
        Number.isFinite(recipe.ingredientId)
        ? Math.trunc(recipe.ingredientId)
        : undefined,
    name: recipe.name ?? "",
    amount: recipe.amount ?? "",
    unitId: unitId ?? defaultUnitId,
    optional: Boolean(recipe.optional),
    garnish: Boolean(recipe.garnish),
    allowBaseSubstitution: Boolean(
      (recipe as { allowBaseSubstitution?: boolean }).allowBaseSubstitution,
    ),
    allowBrandSubstitution: Boolean(
      (recipe as { allowBrandSubstitution?: boolean }).allowBrandSubstitution,
    ),
    allowStyleSubstitution: Boolean(
      (recipe as { allowStyleSubstitution?: boolean }).allowStyleSubstitution,
    ),
    substitutes,
  } satisfies EditableIngredient;
}

export default function CreateCocktailScreen() {
  const navigation = useNavigation();
  const Colors = useAppColors();
  const {
    ingredients: inventoryIngredients,
    cocktails,
    availableIngredientIds,
    shoppingIngredientIds,
    createCocktail,
    updateCocktail,
    deleteCocktail,
    customCocktailTags,
    createCustomCocktailTag,
    useImperialUnits,
  } = useInventory();
  const params = useLocalSearchParams();
  const { setHasUnsavedChanges, setRequireLeaveConfirmation, setSaveHandler } = useUnsavedChanges();

  const modeParam = getParamValue(params.mode);
  const isEditMode = modeParam === "edit";
  const sourceParam = getParamValue(params.source);
  const ingredientParam = getParamValue(params.ingredientId);
  const ingredientNameParam = getParamValue(params.ingredientName);
  const cocktailParam = getParamValue(params.cocktailId);
  const cocktailNameParam = getParamValue(params.cocktailName);
  const openInstanceIdParam = getParamValue(params.openInstanceId);
  const formReturnParams = useMemo(() => {
    const payload = {
      mode: modeParam,
      source: sourceParam,
      ingredientId: ingredientParam,
      ingredientName: ingredientNameParam,
      cocktailId: cocktailParam,
      cocktailName: cocktailNameParam,
      openInstanceId: openInstanceIdParam,
    };
    const json = JSON.stringify(payload);
    return json === "{}" ? undefined : json;
  }, [
    cocktailNameParam,
    cocktailParam,
    ingredientNameParam,
    ingredientParam,
    modeParam,
    openInstanceIdParam,
    sourceParam,
  ]);
  const returnToPath = useMemo(() => {
    const value = getParamValue(params.returnToPath);
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }, [params.returnToPath]);
  const returnToParams = useMemo(() => {
    return parseReturnToParams(params.returnToParams);
  }, [params.returnToParams]);
  const shouldConfirmOnLeave = useMemo(
    () => sourceParam === "ingredient",
    [sourceParam],
  );

  const [name, setName] = useState("");
  const [glassId, setGlassId] = useState<string | null>("martini");
  const [isGlassModalVisible, setIsGlassModalVisible] = useState(false);
  const [methodIds, setMethodIds] = useState<CocktailMethodId[]>([]);
  const [isMethodModalVisible, setIsMethodModalVisible] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [ingredientsState, setIngredientsState] = useState<
    EditableIngredient[]
  >(() => [
    createEditableIngredient(
      useImperialUnits ? DEFAULT_IMPERIAL_UNIT_ID : DEFAULT_METRIC_UNIT_ID,
    ),
  ]);
  const [prefilledCocktail, setPrefilledCocktail] = useState<
    Cocktail | undefined
  >(undefined);
  const [unitPickerTarget, setUnitPickerTarget] = useState<string | null>(null);
  const [substituteTarget, setSubstituteTarget] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [permissionStatus, requestPermission] =
    ImagePicker.useMediaLibraryPermissions();
  const [cameraPermissionStatus, requestCameraPermission] =
    ImagePicker.useCameraPermissions();
  const [dialogOptions, setDialogOptions] = useState<DialogOptions | null>(
    null,
  );
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initialSnapshot, setInitialSnapshot] =
    useState<CocktailFormSnapshot | null>(null);
  const [isTagModalVisible, setTagModalVisible] = useState(false);
  const prefilledTargetId = prefilledCocktail?.id ?? prefilledCocktail?.name;
  const defaultUnitId = useImperialUnits
    ? DEFAULT_IMPERIAL_UNIT_ID
    : DEFAULT_METRIC_UNIT_ID;
  const defaultCocktailTagId = BUILTIN_COCKTAIL_TAGS.find(
    (tag) => tag.name.trim().toLowerCase() === "custom",
  )?.id;

  const renderMethodIcon = (methodId: CocktailMethodId, iconColor: string) => {
    const icon = METHOD_ICON_MAP[methodId];
    const isMuddle = methodId === "muddle";

    if (icon.type === "asset") {
      return (
        <View style={styles.methodOptionIconWrapper}>
          <Image
            source={icon.source}
            style={[styles.methodOptionIcon, { tintColor: iconColor }]}
            contentFit="contain"
          />
        </View>
      );
    }

    return (
      <View style={styles.methodOptionIconWrapper}>
        <MaterialCommunityIcons
          name={icon.name}
          size={18}
          color={iconColor}
          style={isMuddle ? styles.muddleIcon : undefined}
        />
      </View>
    );
  };

  const initializedRef = useRef(false);
  const lastIdRef = useRef<string | undefined>(undefined);
  const lastModeRef = useRef<boolean | undefined>(undefined);
  const isNavigatingAfterSaveRef = useRef(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const isHandlingBackRef = useRef(false);

  useEffect(() => {
    isNavigatingAfterSaveRef.current = false;
  }, [cocktailNameParam, cocktailParam, ingredientNameParam, ingredientParam, isEditMode, openInstanceIdParam]);

  const ingredientById = useMemo(() => {
    const map = new Map<number, Ingredient>();
    inventoryIngredients.forEach((item) => {
      const id = Number(item.id ?? -1);
      if (Number.isFinite(id) && id >= 0) {
        map.set(id, item);
      }
    });
    return map;
  }, [inventoryIngredients]);

  const closeDialog = useCallback(() => {
    setDialogOptions(null);
  }, []);

  const showDialog = useCallback((options: DialogOptions) => {
    setDialogOptions(options);
  }, []);

  const buildSnapshot = useCallback((): CocktailFormSnapshot => {
    const normalizedTags = [...selectedTagIds].sort((a, b) => a - b);
    return {
      name,
      glassId,
      methodIds,
      description,
      instructions,
      imageUri,
      selectedTagIds: normalizedTags,
      ingredients: ingredientsState.map((item) => ({
        ingredientId: item.ingredientId,
        name: item.name,
        amount: item.amount,
        unitId: item.unitId,
        optional: item.optional,
        garnish: item.garnish,
        allowBaseSubstitution: item.allowBaseSubstitution,
        allowBrandSubstitution: item.allowBrandSubstitution,
        allowStyleSubstitution: item.allowStyleSubstitution,
        substitutes: item.substitutes.map((substitute) => ({
          ingredientId: substitute.ingredientId,
          name: substitute.name,
          isBrand: substitute.isBrand,
        })),
      })),
    };
  }, [
    description,
    glassId,
    imageUri,
    ingredientsState,
    instructions,
    methodIds,
    name,
    selectedTagIds,
  ]);

  useEffect(() => {
    if (!isInitialized || initialSnapshot) {
      return;
    }

    setInitialSnapshot(buildSnapshot());
  }, [buildSnapshot, initialSnapshot, isInitialized]);

  const hasUnsavedChanges = useMemo(() => {
    if (!initialSnapshot) {
      return false;
    }

    return JSON.stringify(buildSnapshot()) !== JSON.stringify(initialSnapshot);
  }, [buildSnapshot, initialSnapshot]);

  useEffect(() => {
    setHasUnsavedChanges(hasUnsavedChanges || shouldConfirmOnLeave);
  }, [hasUnsavedChanges, setHasUnsavedChanges, shouldConfirmOnLeave]);

  useEffect(() => {
    setRequireLeaveConfirmation(shouldConfirmOnLeave);
    return () => {
      setRequireLeaveConfirmation(false);
    };
  }, [setRequireLeaveConfirmation, shouldConfirmOnLeave]);

  useFocusEffect(
    useCallback(() => {
      setHasUnsavedChanges(hasUnsavedChanges || shouldConfirmOnLeave);
      return () => {
        setHasUnsavedChanges(false);
      };
    }, [hasUnsavedChanges, setHasUnsavedChanges, shouldConfirmOnLeave]),
  );

  useEffect(() => () => {
    setHasUnsavedChanges(false);
    setRequireLeaveConfirmation(false);
  }, [setHasUnsavedChanges, setRequireLeaveConfirmation]);

  const getBaseGroupId = useCallback(
    (rawId: number | string | null | undefined) => {
      if (rawId == null) {
        return undefined;
      }

      const id = Number(rawId);
      if (!Number.isFinite(id) || id < 0) {
        return undefined;
      }

      const ingredientRecord = ingredientById.get(id);
      if (ingredientRecord?.baseIngredientId != null) {
        const baseId = Number(ingredientRecord.baseIngredientId);
        if (Number.isFinite(baseId) && baseId >= 0) {
          return baseId;
        }
      }

      if (ingredientRecord?.id != null) {
        const normalizedId = Number(ingredientRecord.id);
        if (Number.isFinite(normalizedId) && normalizedId >= 0) {
          return normalizedId;
        }
      }

      return id;
    },
    [ingredientById],
  );

  const cocktailsByBaseGroup = useMemo(() => {
    const map = new Map<number, Set<string>>();

    cocktails.forEach((cocktail: Cocktail) => {
      const id = cocktail.id;
      const cocktailKey =
        id != null ? String(id) : normalizeSearchText(cocktail.name ?? "");
      if (!cocktailKey) {
        return;
      }

      const seenBaseIds = new Set<number>();
      (cocktail.ingredients ?? []).forEach((item) => {
        const baseGroupId = getBaseGroupId(item.ingredientId);
        if (baseGroupId == null || seenBaseIds.has(baseGroupId)) {
          return;
        }

        seenBaseIds.add(baseGroupId);
        let set = map.get(baseGroupId);
        if (!set) {
          set = new Set<string>();
          map.set(baseGroupId, set);
        }

        set.add(cocktailKey);
      });
    });

    return map;
  }, [cocktails, getBaseGroupId]);

  const placeholderLabel = useMemo(
    () => (imageUri ? "Змінити фото" : "Додати фото"),
    [imageUri],
  );

  const selectedGlass = useMemo(
    () => GLASSWARE.find((item) => item.id === glassId),
    [glassId],
  );
  const selectedMethods = useMemo(
    () => methodIds.map((id) => getCocktailMethodById(id)).filter(Boolean),
    [methodIds],
  );

  const availableCocktailTags = useMemo(() => {
    const sortedCustom = [...customCocktailTags].sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? ""),
    );
    return [...BUILTIN_COCKTAIL_TAGS, ...sortedCustom];
  }, [customCocktailTags]);

  const tagSelection = useMemo(() => {
    const set = new Set(selectedTagIds);
    return availableCocktailTags.map((tag) => ({
      ...tag,
      selected: set.has(tag.id),
    }));
  }, [availableCocktailTags, selectedTagIds]);

  const handleOpenTagModal = useCallback(() => {
    setTagModalVisible(true);
  }, []);

  const handleCloseTagModal = useCallback(() => {
    setTagModalVisible(false);
  }, []);

  const handleCreateTag = useCallback(
    (data: { name: string; color: string }) => {
      const created = createCustomCocktailTag(data);
      if (created?.id != null) {
        setSelectedTagIds((prev) =>
          prev.includes(created.id) ? prev : [...prev, created.id],
        );
      }
      setTagModalVisible(false);
    },
    [createCustomCocktailTag],
  );

  const scrollFieldIntoView = useCallback((target?: number | null) => {
    if (target == null) {
      return;
    }

    const scrollNodeHandle = scrollRef.current?.getInnerViewNode
      ? findNodeHandle(scrollRef.current.getInnerViewNode())
      : findNodeHandle(scrollRef.current);
    if (!scrollNodeHandle) {
      return;
    }

    UIManager.measureLayout(
      target,
      scrollNodeHandle,
      () => { },
      (_x, y) => {
        const HEADER_OFFSET = 56;
        const targetOffset = Math.max(0, y - HEADER_OFFSET);
        scrollRef.current?.scrollTo({ y: targetOffset, animated: true });
      },
    );
  }, []);

  useEffect(() => {
    const currentId =
      openInstanceIdParam ??
      cocktailParam ??
      cocktailNameParam ??
      ingredientParam ??
      ingredientNameParam;
    if (initializedRef.current && currentId === lastIdRef.current && isEditMode === lastModeRef.current) {
      return;
    }

    setPrefilledCocktail(undefined);
    setName("");
    setGlassId("martini");
    setMethodIds([]);
    setDescription("");
    setInstructions("");
    setImageUri(null);
    setSelectedTagIds([]);
    setInitialSnapshot(null);

    let prefillCompleted = false;

    const resolveCocktail = (value?: string) => {
      if (!value) {
        return undefined;
      }
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        const byId = cocktails.find(
          (item) => Number(item.id ?? -1) === Math.trunc(numeric),
        );
        if (byId) {
          return byId;
        }
      }
      const normalized = normalizeSearchText(value);
      return cocktails.find(
        (item) => normalizeSearchText(item.name ?? "") === normalized,
      );
    };

    const baseCocktail =
      resolveCocktail(cocktailParam) ?? resolveCocktail(cocktailNameParam);
    if (baseCocktail) {
      setPrefilledCocktail(baseCocktail);
      setName(baseCocktail.name ?? "");
      setGlassId(baseCocktail.glassId ?? "martini");
      const legacyMethodId =
        (baseCocktail as { methodId?: CocktailMethodId | null }).methodId ??
        null;
      const nextMethodIds =
        baseCocktail.methodIds && baseCocktail.methodIds.length > 0
          ? baseCocktail.methodIds
          : legacyMethodId
            ? [legacyMethodId]
            : [];
      setMethodIds(nextMethodIds);
      setDescription(baseCocktail.description ?? "");
      setInstructions(baseCocktail.instructions ?? "");
      setImageUri(baseCocktail.photoUri ?? null);
      const mappedTags = (baseCocktail.tags ?? [])
        .map((tag) => Number(tag.id ?? -1))
        .filter((id): id is number => Number.isFinite(id) && id >= 0)
        .map((id) => Math.trunc(id));
      setSelectedTagIds(mappedTags);

      const recipe = [...(baseCocktail.ingredients ?? [])].sort(
        (a, b) => a.order - b.order,
      );
      if (recipe.length) {
        setIngredientsState(
          recipe.map((item) => mapRecipeIngredientToEditable(item, defaultUnitId)),
        );
      }
      prefillCompleted = true;
    }

    if (!isEditMode && !baseCocktail && defaultCocktailTagId != null) {
      setSelectedTagIds((prev) =>
        prev.length ? prev : [defaultCocktailTagId],
      );
    }

    if (!prefillCompleted) {
      const resolveIngredient = (value?: string, fallbackName?: string) => {
        if (value) {
          const numeric = Number(value);
          if (Number.isFinite(numeric)) {
            const byId = inventoryIngredients.find(
              (item) => Number(item.id ?? -1) === Math.trunc(numeric),
            );
            if (byId) {
              return byId;
            }
          }
          const normalized = normalizeSearchText(value);
          const bySlug = inventoryIngredients.find(
            (item) => normalizeSearchText(item.name ?? "") === normalized,
          );
          if (bySlug) {
            return bySlug;
          }
        }
        if (fallbackName) {
          const normalized = normalizeSearchText(fallbackName);
          return inventoryIngredients.find(
            (item) => normalizeSearchText(item.name ?? "") === normalized,
          );
        }
        return undefined;
      };

      const baseIngredient = resolveIngredient(
        ingredientParam,
        ingredientNameParam,
      );
      if (baseIngredient) {
        const ingredientId = Number(baseIngredient.id ?? -1);
        const preset = createEditableIngredient(defaultUnitId, {
          ingredientId:
            Number.isFinite(ingredientId) && ingredientId >= 0
              ? ingredientId
              : undefined,
          name: baseIngredient.name ?? "",
        });
        setIngredientsState([preset]);
        prefillCompleted = true;
      }
    }

    if (!prefillCompleted) {
      setIngredientsState([createEditableIngredient(defaultUnitId)]);
    }

    initializedRef.current = true;
    lastIdRef.current = currentId;
    lastModeRef.current = isEditMode;
    setIsInitialized(true);
  }, [
    cocktails,
    cocktailNameParam,
    cocktailParam,
    defaultUnitId,
    ingredientNameParam,
    ingredientParam,
    inventoryIngredients,
    isEditMode,
    openInstanceIdParam,
    defaultCocktailTagId,
  ]);

  const ensureMediaPermission = useCallback(async () => {
    if (permissionStatus?.granted) {
      return true;
    }

    const { status, granted, canAskAgain } = await requestPermission();
    if (granted || status === ImagePicker.PermissionStatus.GRANTED) {
      return true;
    }

    if (!canAskAgain) {
      showDialog({
        title: "Потрібен доступ до медіа",
        message:
          "Надайте доступ до фототеки в налаштуваннях системи, щоб додати фото коктейлю.",
        actions: [{ label: "OK" }],
      });
    }

    return false;
  }, [permissionStatus?.granted, requestPermission, showDialog]);

  const handlePickImage = useCallback(async () => {
    if (isPickingImage) {
      return;
    }

    const hasPermission = await ensureMediaPermission();
    if (!hasPermission) {
      return;
    }

    try {
      setIsPickingImage(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 1,
        exif: false,
      });

      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        if (asset?.uri) {
          setImageUri(asset.uri);
        }
      }
    } catch (error) {
      console.warn("Failed to pick image", error);
      showDialog({
        title: "Не вдалося вибрати зображення",
        message: "Спробуйте пізніше.",
        actions: [{ label: "OK" }],
      });
    } finally {
      setIsPickingImage(false);
    }
  }, [ensureMediaPermission, isPickingImage, showDialog]);

  const ensureCameraPermission = useCallback(async () => {
    if (cameraPermissionStatus?.granted) {
      return true;
    }

    const { status, granted, canAskAgain } = await requestCameraPermission();
    if (granted || status === ImagePicker.PermissionStatus.GRANTED) {
      return true;
    }

    if (!canAskAgain) {
      showDialog({
        title: "Потрібен доступ до камери",
        message:
          "Надайте доступ до камери в налаштуваннях системи, щоб зробити фото коктейлю.",
        actions: [{ label: "OK" }],
      });
    }

    return false;
  }, [cameraPermissionStatus?.granted, requestCameraPermission, showDialog]);

  const handleTakePhoto = useCallback(async () => {
    if (isPickingImage) {
      return;
    }

    const hasPermission = await ensureCameraPermission();
    if (!hasPermission) {
      return;
    }

    try {
      setIsPickingImage(true);
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 1,
        exif: false,
      });

      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        if (asset?.uri) {
          setImageUri(asset.uri);
        }
      }
    } catch (error) {
      console.warn("Failed to capture image", error);
      showDialog({
        title: "Не вдалося зробити фото",
        message: "Спробуйте пізніше.",
        actions: [{ label: "OK" }],
      });
    } finally {
      setIsPickingImage(false);
    }
  }, [ensureCameraPermission, isPickingImage, showDialog]);

  const handleSelectImageSource = useCallback(() => {
    showDialog({
      title: "Додати фото",
      message: "Оберіть, як додати фото коктейлю.",
      actions: [
        {
          label: "Зробити фото",
          onPress: () => {
            void handleTakePhoto();
          },
        },
        {
          label: "Вибрати з галереї",
          onPress: () => {
            void handlePickImage();
          },
        },
        { label: "Скасувати", variant: "secondary" },
      ],
    });
  }, [handlePickImage, handleTakePhoto, showDialog]);

  const handleRemovePhoto = useCallback(() => {
    setImageUri(null);
  }, []);

  const isSaveDisabled = isSaving || isPickingImage;

  const handleToggleTag = useCallback((tagId: number) => {
    setSelectedTagIds((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId);
      }
      return [...prev, tagId];
    });
  }, []);

  const handleChangeIngredient = useCallback(
    (key: string, changes: Partial<EditableIngredient>) => {
      setIngredientsState((prev) =>
        prev.map((item) => (item.key === key ? { ...item, ...changes } : item)),
      );
    },
    [],
  );

  const handleRemoveIngredient = useCallback(
    (key: string) => {
      setIngredientsState((prev) => {
        const next = prev.filter((item) => item.key !== key);
        return next.length > 0
          ? next
          : [createEditableIngredient(defaultUnitId)];
      });
    },
    [defaultUnitId],
  );

  const handleMoveIngredient = useCallback(
    (key: string, direction: "up" | "down") => {
      setIngredientsState((prev) => {
        const currentIndex = prev.findIndex((item) => item.key === key);
        if (currentIndex < 0) {
          return prev;
        }

        const targetIndex =
          direction === "up" ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= prev.length) {
          return prev;
        }

        const next = [...prev];
        const [moved] = next.splice(currentIndex, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      });
    },
    [],
  );

  const handleAddIngredient = useCallback(() => {
    setIngredientsState((prev) => [
      ...prev,
      createEditableIngredient(defaultUnitId),
    ]);
  }, [defaultUnitId]);

  const handleUpdateSubstitutes = useCallback(
    (
      key: string,
      updater: (items: EditableSubstitute[]) => EditableSubstitute[],
    ) => {
      setIngredientsState((prev) =>
        prev.map((item) =>
          item.key === key
            ? {
              ...item,
              substitutes: updater(item.substitutes),
            }
            : item,
        ),
      );
    },
    [],
  );

  const handleRemoveSubstitute = useCallback(
    (ingredientKey: string, substituteKey: string) => {
      handleUpdateSubstitutes(ingredientKey, (items) =>
        items.filter((substitute) => substitute.key !== substituteKey),
      );
    },
    [handleUpdateSubstitutes],
  );

  const handleOpenUnitPicker = useCallback((key: string) => {
    setUnitPickerTarget(key);
  }, []);

  const handleSelectUnit = useCallback(
    (unitId?: number) => {
      if (unitPickerTarget) {
        handleChangeIngredient(unitPickerTarget, { unitId });
      }
      setUnitPickerTarget(null);
    },
    [handleChangeIngredient, unitPickerTarget],
  );

  const handleCloseUnitPicker = useCallback(() => {
    setUnitPickerTarget(null);
  }, []);

  const handleToggleMethod = useCallback((targetId: CocktailMethodId) => {
    setMethodIds((prev) => {
      if (prev.includes(targetId)) {
        return prev.filter((id) => id !== targetId);
      }
      return [...prev, targetId];
    });
  }, []);

  const handleClearMethods = useCallback(() => {
    setMethodIds([]);
    setIsMethodModalVisible(false);
  }, []);

  const targetUnitPickerIngredient = useMemo(
    () => ingredientsState.find((item) => item.key === unitPickerTarget),
    [ingredientsState, unitPickerTarget],
  );

  const usePluralUnitsInPicker = useMemo(
    () => shouldUsePluralUnits(targetUnitPickerIngredient?.amount),
    [targetUnitPickerIngredient?.amount],
  );

  const handleOpenSubstituteModal = useCallback((key: string) => {
    setSubstituteTarget(key);
  }, []);

  const handleCloseSubstituteModal = useCallback(() => {
    setSubstituteTarget(null);
  }, []);

  const handleRequestCreateIngredient = useCallback(
    (suggested: string) => {
      const trimmed = suggested.trim();
      if (!trimmed) {
        router.push({
          pathname: "/ingredients/create",
          params: {
            mode: "create",
            fromCocktailAddIngredient: "true",
            returnToPath: "/cocktails/create",
            returnToParams: formReturnParams,
          },
        });
        return;
      }
      router.push({
        pathname: "/ingredients/create",
        params: {
          mode: "create",
          suggestedName: trimmed,
          fromCocktailAddIngredient: "true",
          returnToPath: "/cocktails/create",
          returnToParams: formReturnParams,
        },
      });
    },
    [formReturnParams],
  );

  const handleSelectSubstituteCandidate = useCallback(
    (candidate: Ingredient) => {
      if (!substituteTarget) {
        return;
      }

      const nameValue = candidate.name ?? "";
      const trimmedName = nameValue.trim();
      if (!trimmedName) {
        return;
      }

      const candidateId = Number(candidate.id ?? -1);
      const numericId =
        Number.isFinite(candidateId) && candidateId >= 0
          ? Math.trunc(candidateId)
          : undefined;

      const newSubstitute: EditableSubstitute = {
        key: createUniqueKey(`sub-${substituteTarget}`),
        name: trimmedName,
        ingredientId: numericId,
        isBrand: false,
      };

      handleUpdateSubstitutes(substituteTarget, (items) => {
        const normalizedName = normalizeSearchText(trimmedName);
        const exists = items.some((item) => {
          if (numericId != null && item.ingredientId === numericId) {
            return true;
          }
          return normalizeSearchText(item.name) === normalizedName;
        });
        if (exists) {
          return items;
        }
        return [...items, newSubstitute];
      });
    },
    [handleUpdateSubstitutes, substituteTarget],
  );

  const handleSubmit = useCallback(async () => {
    if (isSaving) {
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      showDialog({
        title: "Потрібна назва",
        message: "Введіть назву коктейлю.",
        actions: [{ label: "OK" }],
      });
      return;
    }

    const sanitizedIngredients = ingredientsState
      .map((item, index) => {
        const ingredientName = item.name.trim();
        if (!ingredientName) {
          return undefined;
        }

        const normalizedIngredientId =
          item.ingredientId != null ? Number(item.ingredientId) : undefined;
        const ingredientId =
          normalizedIngredientId != null &&
            Number.isFinite(normalizedIngredientId) &&
            normalizedIngredientId >= 0
            ? Math.trunc(normalizedIngredientId)
            : undefined;

        const normalizedUnitId =
          item.unitId != null ? Number(item.unitId) : undefined;
        const unitId =
          normalizedUnitId != null &&
            Number.isFinite(normalizedUnitId) &&
            normalizedUnitId >= 0
            ? Math.trunc(normalizedUnitId)
            : undefined;

        const substitutes = item.substitutes
          .map((substitute) => {
            const substituteName = substitute.name.trim();
            if (!substituteName) {
              return undefined;
            }

            const rawIngredientLink =
              substitute.ingredientId != null
                ? Number(substitute.ingredientId)
                : undefined;
            const substituteIngredientId =
              rawIngredientLink != null &&
                Number.isFinite(rawIngredientLink) &&
                rawIngredientLink >= 0
                ? Math.trunc(rawIngredientLink)
                : undefined;

            return {
              ingredientId: substituteIngredientId,
              name: substituteName,
              brand: substitute.isBrand ?? false,
            };
          })
          .filter(
            (
              substitute,
            ): substitute is {
              ingredientId?: number;
              name: string;
              brand: boolean;
            } => Boolean(substitute),
          );

        return {
          ingredientId,
          name: ingredientName,
          amount: item.amount.trim() || undefined,
          unitId,
          optional: item.optional,
          garnish: item.garnish,
          allowBaseSubstitution: item.allowBaseSubstitution,
          allowBrandSubstitution: item.allowBrandSubstitution,
          allowStyleSubstitution: item.allowStyleSubstitution,
          substitutes,
          order: index + 1,
        } satisfies CreateCocktailInput["ingredients"][number];
      })
      .filter((value): value is CreateCocktailInput["ingredients"][number] =>
        Boolean(value),
      );

    if (!sanitizedIngredients.length) {
      showDialog({
        title: "Потрібен рецепт",
        message: "Додайте принаймні один інгредієнт до коктейлю.",
        actions: [{ label: "OK" }],
      });
      return;
    }

    const descriptionValue = description.trim();
    const instructionsValue = instructions.trim();
    const tags = selectedTagIds
      .map((tagId) => availableCocktailTags.find((tag) => tag.id === tagId))
      .filter((tag): tag is (typeof availableCocktailTags)[number] =>
        Boolean(tag),
      );

    setIsSaving(true);
    try {
      const photoHasChanged = imageUri !== prefilledCocktail?.photoUri;
      const shouldProcessPhoto =
        shouldStorePhoto(imageUri) && (!isEditMode || photoHasChanged);
      const initialPhotoUri = shouldProcessPhoto
        ? undefined
        : (imageUri ?? undefined);

      const submission = {
        name: trimmedName,
        glassId: glassId ?? undefined,
        methodIds,
        photoUri: initialPhotoUri,
        description: descriptionValue || undefined,
        instructions: instructionsValue || undefined,
        tags,
        ingredients: sanitizedIngredients,
      } satisfies CreateCocktailInput;

      let persisted =
        isEditMode && prefilledCocktail?.id != null
          ? updateCocktail(Number(prefilledCocktail.id), {
            ...submission,
            photoUri:
              imageUri && shouldProcessPhoto && prefilledCocktail?.id != null
                ? await storePhoto({
                  uri: imageUri,
                  id: prefilledCocktail.id,
                  name: trimmedName,
                  category: "cocktails",
                  suffix: String(Date.now()),
                })
                : submission.photoUri,
          })
          : createCocktail(submission);

      if (!persisted) {
        showDialog({
          title: "Не вдалося зберегти коктейль",
          message: "Спробуйте пізніше.",
          actions: [{ label: "OK" }],
        });
        return;
      }

      if (
        !isEditMode &&
        shouldProcessPhoto &&
        imageUri &&
        persisted.id != null
      ) {
        const storedPhotoUri = await storePhoto({
          uri: imageUri,
          id: persisted.id,
          name: trimmedName,
          category: "cocktails",
        });

        if (storedPhotoUri && storedPhotoUri !== persisted.photoUri) {
          const updated = updateCocktail(Number(persisted.id), {
            ...submission,
            photoUri: storedPhotoUri,
          });
          if (updated) {
            persisted = updated;
          }
        }
      }

      setHasUnsavedChanges(false);
      isNavigatingAfterSaveRef.current = true;
      const targetId = persisted.id ?? persisted.name;
      if (!isEditMode && returnToPath) {
        router.replace({ pathname: returnToPath, params: returnToParams });
        return;
      }

      if (targetId) {
        router.replace({
          pathname: "/cocktails/[cocktailId]",
          params: {
            cocktailId: String(targetId),
            ...buildReturnToParams(returnToPath, returnToParams),
          },
        });
        return;
      }

      router.replace("/cocktails");
    } finally {
      setIsSaving(false);
    }
  }, [
    availableCocktailTags,
    createCocktail,
    updateCocktail,
    description,
    glassId,
    imageUri,
    ingredientsState,
    instructions,
    isSaving,
    isEditMode,
    methodIds,
    name,
    navigation,
    prefilledCocktail?.id,
    prefilledCocktail?.photoUri,
    returnToParams,
    returnToPath,
    selectedTagIds,
    setHasUnsavedChanges,
    showDialog,
    shouldStorePhoto,
    storePhoto,
  ]);

  const handleDeletePress = useCallback(() => {
    if (!isEditMode) {
      return;
    }

    const normalizedId =
      prefilledCocktail?.id != null ? Number(prefilledCocktail.id) : NaN;
    const numericId =
      Number.isFinite(normalizedId) && normalizedId >= 0
        ? Math.trunc(normalizedId)
        : undefined;

    if (numericId == null) {
      showDialog({
        title: "Коктейль не знайдено",
        message: "Спробуйте пізніше.",
        actions: [{ label: "OK" }],
      });
      return;
    }

    const trimmedName = prefilledCocktail?.name?.trim();
    const message = trimmedName
      ? `Are you sure you want to delete\n${trimmedName}?\n\nThis action cannot be undone.`
      : "Ви впевнені, що хочете видалити цей коктейль?\n\nЦю дію неможливо скасувати.";

    showDialog({
      title: "Видалити коктейль",
      message,
      actions: [
        { label: "Скасувати", variant: "secondary" },
        {
          label: "Видалити",
          variant: "destructive",
          onPress: () => {
            const wasDeleted = deleteCocktail(numericId);
            if (!wasDeleted) {
              showDialog({
                title: "Не вдалося видалити коктейль",
                message: "Спробуйте пізніше.",
                actions: [{ label: "OK" }],
              });
              return;
            }

            setHasUnsavedChanges(false);
            const state = navigation.getState();
            const currentIndex = state.index ?? 0;
            if (currentIndex >= 2) {
              navigation.dispatch(StackActions.pop(2));
              return;
            }
            if (returnToPath) {
              router.navigate({ pathname: returnToPath, params: returnToParams });
              return;
            }
            if (navigation.canGoBack()) {
              navigation.goBack();
              return;
            }
            router.replace("/cocktails");
          },
        },
      ],
    });
  }, [
    deleteCocktail,
    isEditMode,
    navigation,
    prefilledCocktail?.id,
    prefilledCocktail?.name,
    returnToParams,
    returnToPath,
    setHasUnsavedChanges,
    showDialog,
  ]);

  const confirmLeave = useCallback(
    (onLeave: () => void) => {
      showDialog({
        title: "Вийти без збереження?",
        message: "Якщо вийти з цього екрана, зміни буде втрачено.",
        actions: [
          { label: "Зберегти", variant: "primary", onPress: handleSubmit },
          { label: "Залишитися", variant: "secondary" },
          {
            label: "Вийти",
            variant: "destructive",
            onPress: () => {
              setHasUnsavedChanges(false);
              onLeave();
            },
          },
        ],
      });
    },
    [handleSubmit, setHasUnsavedChanges, showDialog],
  );

  useEffect(() => {
    setSaveHandler(() => handleSubmit);
    return () => {
      setSaveHandler(null);
    };
  }, [handleSubmit, setSaveHandler]);

  useEffect(() => {
    const isBackAction = (action: NavigationAction) =>
      action.type === "GO_BACK" || action.type === "POP";

    const leaveBack = () => {
      if (returnToPath) {
        router.replace({ pathname: returnToPath, params: returnToParams });
        return;
      }

      skipDuplicateBack(navigation);
    };

    const leaveScreen = (action?: NavigationAction) => {
      if (isBackAction(action ?? { type: "GO_BACK" })) {
        leaveBack();
        return;
      }

      if (returnToPath) {
        router.replace({ pathname: returnToPath, params: returnToParams });
        return;
      }

      router.replace("/cocktails");
    };

    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (isNavigatingAfterSaveRef.current || isHandlingBackRef.current) {
        return;
      }

      if (hasUnsavedChanges || shouldConfirmOnLeave) {
        event.preventDefault();
        confirmLeave(() => {
          isHandlingBackRef.current = true;
          leaveScreen(event.data.action);
          setTimeout(() => {
            isHandlingBackRef.current = false;
          }, 0);
        });
        return;
      }

      if (isBackAction(event.data.action)) {
        event.preventDefault();
        isHandlingBackRef.current = true;
        leaveScreen(event.data.action);
        setTimeout(() => {
          isHandlingBackRef.current = false;
        }, 0);
      }
    });

    return unsubscribe;
  }, [
    confirmLeave,
    hasUnsavedChanges,
    navigation,
    returnToPath,
    returnToParams,
    shouldConfirmOnLeave,
  ]);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const imageSource = useMemo(() => {
    if (!imageUri) {
      return undefined;
    }
    const asset = resolveAssetFromCatalog(imageUri);
    if (asset) {
      return asset;
    }
    if (/^https?:/i.test(imageUri) || imageUri.startsWith("file:")) {
      return { uri: imageUri } as const;
    }
    return undefined;
  }, [imageUri]);

  const glassImageSource = useMemo(() => {
    if (!selectedGlass?.imageUri) {
      return undefined;
    }
    return resolveAssetFromCatalog(selectedGlass.imageUri) ?? undefined;
  }, [selectedGlass?.imageUri]);

  const substituteModalIngredient = useMemo(() => {
    if (!substituteTarget) {
      return undefined;
    }
    return ingredientsState.find((item) => item.key === substituteTarget);
  }, [ingredientsState, substituteTarget]);

  const substituteModalSelectionIds = useMemo(() => {
    if (!substituteModalIngredient) {
      return undefined;
    }

    const ids = new Set<number>();
    substituteModalIngredient.substitutes.forEach((item) => {
      const normalized = item.ingredientId != null ? Number(item.ingredientId) : NaN;
      if (Number.isFinite(normalized) && normalized >= 0) {
        ids.add(Math.trunc(normalized));
      }
    });

    return ids.size ? ids : undefined;
  }, [substituteModalIngredient]);

  const substituteModalSelectionNames = useMemo(() => {
    if (!substituteModalIngredient) {
      return undefined;
    }

    const names = new Set<string>();
    substituteModalIngredient.substitutes.forEach((item) => {
      const normalized = normalizeSearchText(item.name);
      if (normalized) {
        names.add(normalized);
      }
    });

    return names.size ? names : undefined;
  }, [substituteModalIngredient]);

  return (
    <>
      <Stack.Screen
        options={{
          title: isEditMode ? "Редагувати коктейль" : "Додати новий коктейль",
          headerTitleAlign: "center",
          headerStyle: { backgroundColor: Colors.surface },
          headerShadowVisible: false,
          headerTitleStyle: {
            color: Colors.onSurface,
            fontSize: 17,
            fontWeight: "600",
          },
          headerLeft: () => (
            <HeaderIconButton
              onPress={handleGoBack}
              accessibilityLabel="Назад"
            >
              <MaterialCommunityIcons
                name={Platform.OS === "ios" ? "chevron-left" : "arrow-left"}
                size={Platform.OS === "ios" ? 26 : 22}
                color={Colors.onSurface}
              />
            </HeaderIconButton>
          ),
          headerRight: () => (
            <HeaderIconButton
              onPress={() => setIsHelpVisible(true)}
              accessibilityLabel="Відкрити довідку екрана"
            >
              <MaterialCommunityIcons
                name="help-circle-outline"
                size={20}
                color={Colors.onSurface}
              />
            </HeaderIconButton>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.select({ ios: 96, default: 0 })}
      >
        <ScrollView
          ref={scrollRef}
          style={[styles.flex, { backgroundColor: Colors.background }]}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={[styles.label, { color: Colors.onSurface }]}>Назва</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="напр., Маргарита"
              style={[
                styles.input,
                {
                  borderColor: Colors.outlineVariant,
                  color: Colors.text,
                  backgroundColor: Colors.surface,
                },
              ]}
              placeholderTextColor={`${Colors.onSurfaceVariant}99`}
            />
          </View>

          <View style={[styles.section, styles.rowWrap]}>
            <View
              style={[
                styles.card,
                styles.halfCard,
                { backgroundColor: Colors.background },
              ]}
            >
              <Text style={[styles.cardLabel, { color: Colors.onSurface }]}>Склянка</Text>
              <Pressable
                style={styles.glassTile}
                accessibilityRole="button"
                accessibilityLabel="Вибрати посуд"
                onPress={() => setIsGlassModalVisible(true)}
              >
                {glassImageSource ? (
                  <AppImage
                    source={glassImageSource}
                    style={styles.glassPreview}
                    contentFit="contain"
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="glass-cocktail"
                    size={48}
                    color={Colors.onSurfaceVariant}
                  />
                )}
              </Pressable>
            </View>

            <View
              style={[
                styles.card,
                styles.halfCard,
                { backgroundColor: Colors.background },
              ]}
            >
              <Text style={[styles.cardLabel, { color: Colors.onSurface }]}>Фото</Text>
              <View style={styles.photoTileWrapper}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={placeholderLabel}
                  style={[
                    styles.photoTile,
                    { borderColor: Colors.outlineVariant, backgroundColor: Colors.background },
                    !imageSource && { backgroundColor: Colors.surface },
                  ]}
                  onPress={handleSelectImageSource}
                  android_ripple={{ color: `${Colors.surface}33` }}
                >
                  {imageSource ? (
                    <AppImage
                      source={imageSource}
                      style={[styles.photoPreview, { backgroundColor: Colors.background }]}
                      contentFit="contain"
                    />
                  ) : (
                    <View style={styles.photoPlaceholderContent}>
                      <MaterialCommunityIcons
                        name="image-plus"
                        size={28}
                        color={`${Colors.onSurfaceVariant}99`}
                      />
                      <Text
                        style={[
                          styles.cardHint,
                          { color: `${Colors.onSurfaceVariant}99` },
                        ]}
                      >
                        Tap to select image
                      </Text>
                    </View>
                  )}
                  {imageSource ? (
                    <View
                      pointerEvents="none"
                      style={[styles.cropFrame, { borderColor: Colors.tint }]}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    />
                  ) : null}
                </Pressable>
                {imageUri ? (
                  <Pressable
                    onPress={handleRemovePhoto}
                    hitSlop={8}
                    style={styles.removePhotoButton}
                    accessibilityRole="button"
                    accessibilityLabel="Видалити фото"
                  >
                    <MaterialCommunityIcons
                      name="trash-can-outline"
                      size={18}
                      color={Colors.error}
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: Colors.onSurface }]}>
              Method
            </Text>
            <Pressable
              style={[
                styles.methodPicker,
                {
                  borderColor: Colors.outlineVariant,
                  backgroundColor: Colors.surface,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Вибрати метод"
              onPress={() => setIsMethodModalVisible(true)}
            >
              <View style={styles.methodPickerContent}>
                <Text
                  style={[
                    styles.methodPickerLabel,
                    { color: Colors.onSurface },
                  ]}
                  numberOfLines={1}
                >
                  {selectedMethods.length
                    ? selectedMethods.map((method) => method.label).join(", ")
                    : "Не вказано"}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-down"
                size={20}
                color={Colors.onSurfaceVariant}
              />
            </Pressable>
          </View>

          <View style={styles.section}>
            <View style={styles.tagHeader}>
              <Text style={[styles.label, { color: Colors.onSurface }]}>
                Tags
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Створити тег"
                onPress={handleOpenTagModal}
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
                  Create tag
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.hint, { color: Colors.onSurfaceVariant }]}>
              Select one or more tags
            </Text>
            <View style={styles.tagList}>
              {tagSelection.map((tag) => (
                <TagPill
                  key={tag.id}
                  label={tag.name}
                  color={tag.color}
                  selected={tag.selected}
                  onPress={() => handleToggleTag(tag.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: tag.selected }}
                  androidRippleColor={`${Colors.surface}33`}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: Colors.onSurface }]}>
              Description
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Необов’язковий опис"
              placeholderTextColor={`${Colors.onSurfaceVariant}99`}
              style={[
                styles.input,
                styles.multilineInput,
                {
                  borderColor: Colors.outlineVariant,
                  color: Colors.text,
                  backgroundColor: Colors.surface,
                },
              ]}
              multiline
              textAlignVertical="top"
              onFocus={(event) => scrollFieldIntoView(event.nativeEvent.target)}
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: Colors.onSurface }]}>
              Instructions
            </Text>
            <TextInput
              value={instructions}
              onChangeText={setInstructions}
              placeholder="1. Grab some ice..."
              placeholderTextColor={`${Colors.onSurfaceVariant}99`}
              style={[
                styles.input,
                styles.multilineInput,
                {
                  borderColor: Colors.outlineVariant,
                  color: Colors.text,
                  backgroundColor: Colors.surface,
                },
              ]}
              multiline
              textAlignVertical="top"
              onFocus={(event) => scrollFieldIntoView(event.nativeEvent.target)}
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: Colors.onSurface }]}>
              Ingredients
            </Text>
            <View style={styles.ingredientsList}>
              {ingredientsState.map((ingredient, index) => (
                <EditableIngredientRow
                  key={ingredient.key}
                  ingredient={ingredient}
                  inventoryIngredients={inventoryIngredients}
                  availableIngredientIds={availableIngredientIds}
                  shoppingIngredientIds={shoppingIngredientIds}
                  getBaseGroupId={getBaseGroupId}
                  cocktailsByBaseGroup={cocktailsByBaseGroup}
                  onChange={handleChangeIngredient}
                  onRemove={handleRemoveIngredient}
                  onMove={handleMoveIngredient}
                  onRequestUnitPicker={handleOpenUnitPicker}
                  onRequestAddSubstitute={handleOpenSubstituteModal}
                  onRemoveSubstitute={handleRemoveSubstitute}
                  onRequestCreateIngredient={handleRequestCreateIngredient}
                  onInputFocus={scrollFieldIntoView}
                  onOpenDialog={showDialog}
                  index={index}
                  totalCount={ingredientsState.length}
                />
              ))}
            </View>
            <Pressable
              onPress={handleAddIngredient}
              style={[
                styles.addIngredientButton,
                {
                  borderColor: Colors.outlineVariant,
                  backgroundColor: Colors.surface,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Додати інгредієнт"
            >
              <MaterialCommunityIcons
                name="plus"
                size={18}
                color={Colors.tint}
              />
              <Text style={[styles.addIngredientLabel, { color: Colors.tint }]}>
                Add ingredient
              </Text>
            </Pressable>
          </View>
          <View style={styles.buttonsContainer}>
            <Pressable
              onPress={handleSubmit}
              disabled={isSaveDisabled}
              style={[
                styles.submitButton,
                {
                  backgroundColor: Colors.tint,
                  opacity: isSaveDisabled ? 0.6 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Зберегти коктейль"
            >
              <Text style={[styles.submitLabel, { color: Colors.onPrimary }]}>
                Save cocktail
              </Text>
            </Pressable>

            {isEditMode || prefilledTargetId ? (
              <View style={styles.inlineActions}>
                {prefilledTargetId && !isEditMode ? (
                  <Pressable
                    onPress={() =>
                      router.replace({
                        pathname: "/cocktails/create",
                        params: {
                          cocktailId: String(prefilledTargetId),
                          cocktailName: prefilledCocktail?.name ?? undefined,
                          mode: "edit",
                          source: sourceParam ?? undefined,
                        },
                      })
                    }
                    style={[styles.inlineActionButton, { borderColor: Colors.primary, backgroundColor: Colors.surfaceBright }]}
                    accessibilityRole="button"
                    accessibilityLabel="Редагувати коктейль"
                  >
                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={18}
                      color={Colors.primary}
                    />
                    <Text style={[styles.inlineActionLabel, { color: Colors.primary }]}>Edit cocktail</Text>
                  </Pressable>
                ) : null}
                {isEditMode ? (
                  <Pressable
                    onPress={handleDeletePress}
                    style={[styles.inlineActionButton, { borderColor: Colors.error, backgroundColor: Colors.surfaceBright }]}
                    accessibilityRole="button"
                    accessibilityLabel="Видалити коктейль"
                  >
                    <MaterialIcons
                      name="delete-outline"
                      size={18}
                      color={Colors.error}
                    />
                    <Text style={[styles.inlineActionLabel, { color: Colors.error }]}>Delete cocktail</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={isGlassModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsGlassModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsGlassModalVisible(false)}
          accessibilityRole="button"
          accessibilityLabel="Закрити"
        >
          <Pressable
            onPress={(event) => event.stopPropagation?.()}
            style={[
              styles.modalCard,
              {
                backgroundColor: Colors.surface,
                borderColor: Colors.outline,
                shadowColor: Colors.shadow,
              },
            ]}
            accessibilityRole="menu"
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: Colors.onSurface }]}>
                Select glass
              </Text>
              <Pressable
                onPress={() => setIsGlassModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Закрити"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={Colors.onSurfaceVariant}
                />
              </Pressable>
            </View>
            <FlatList
              data={GLASSWARE}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.glassRow}
              renderItem={({ item }) => {
                const isSelected = glassId === item.id;
                const asset = resolveAssetFromCatalog(item.imageUri);
                return (
                  <Pressable
                    onPress={() => {
                      setGlassId(item.id);
                      setIsGlassModalVisible(false);
                    }}
                    style={[
                      styles.glassOption,
                      {
                        borderColor: isSelected
                          ? Colors.outline
                          : Colors.outlineVariant,
                        backgroundColor: isSelected
                          ? Colors.highlightFaint
                          : Colors.surfaceBright,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${item.name}`}
                  >
                    {asset ? (
                      <AppImage
                        source={asset}
                        style={styles.glassOptionImage}
                        contentFit="cover"
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name="glass-cocktail"
                        size={32}
                        color={Colors.onSurfaceVariant}
                      />
                    )}
                    <Text
                      style={[
                        styles.glassOptionLabel,
                        { color: Colors.onSurface },
                      ]}
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                );
              }}
              contentContainerStyle={styles.glassList}
              showsVerticalScrollIndicator={false}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={unitPickerTarget != null}
        transparent
        animationType="fade"
        onRequestClose={handleCloseUnitPicker}
      >
        <Pressable
          style={styles.unitModalOverlay}
          onPress={handleCloseUnitPicker}
          accessibilityRole="button"
        >
          <Pressable
            onPress={(event) => event.stopPropagation?.()}
            style={[
              styles.unitModalCard,
              {
                backgroundColor: Colors.surface,
                borderColor: Colors.outline,
                shadowColor: Colors.shadow,
              },
            ]}
            accessibilityRole="menu"
          >
            <View style={styles.unitModalHeader}>
              <Text
                style={[styles.unitModalTitle, { color: Colors.onSurface }]}
              >
                Select unit
              </Text>
              <Pressable
                onPress={handleCloseUnitPicker}
                accessibilityRole="button"
                accessibilityLabel="Закрити"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={Colors.onSurfaceVariant}
                />
              </Pressable>
            </View>
            <ScrollView
              style={styles.unitModalScroll}
              contentContainerStyle={styles.unitModalList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {COCKTAIL_UNIT_OPTIONS.map((option) => {
                const optionLabel = usePluralUnitsInPicker
                  ? (COCKTAIL_UNIT_DICTIONARY[option.id]?.plural ??
                    option.label)
                  : option.label;
                const displayLabel = optionLabel || " ";
                const isSelected =
                  option.id === targetUnitPickerIngredient?.unitId;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => handleSelectUnit(option.id)}
                    style={[
                      styles.unitOption,
                      {
                        borderColor: isSelected
                          ? Colors.tint
                          : Colors.outlineVariant,
                        backgroundColor: isSelected
                          ? Colors.highlightFaint
                          : Colors.surfaceBright,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={
                      displayLabel.trim()
                        ? `Select ${displayLabel.trim()}`
                        : "Вибрати порожню одиницю"
                    }
                  >
                    <Text
                      style={[styles.unitLabel, { color: Colors.onSurface }]}
                    >
                      {displayLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isMethodModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMethodModalVisible(false)}
      >
        <Pressable
          style={styles.unitModalOverlay}
          onPress={() => setIsMethodModalVisible(false)}
          accessibilityRole="button"
        >
          <Pressable
            onPress={(event) => event.stopPropagation?.()}
            style={[
              styles.unitModalCard,
              {
                backgroundColor: Colors.surface,
                borderColor: Colors.outline,
                shadowColor: Colors.shadow,
              },
            ]}
            accessibilityRole="menu"
          >
            <View style={styles.unitModalHeader}>
              <Text
                style={[styles.unitModalTitle, { color: Colors.onSurface }]}
              >
                Select method
              </Text>
              <Pressable
                onPress={() => setIsMethodModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Закрити"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={Colors.onSurfaceVariant}
                />
              </Pressable>
            </View>
            <ScrollView
              style={styles.unitModalScroll}
              contentContainerStyle={styles.methodModalList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Pressable
                onPress={handleClearMethods}
                style={[
                  styles.methodOption,
                  {
                    borderColor:
                      methodIds.length === 0
                        ? Colors.tint
                        : Colors.outlineVariant,
                    backgroundColor:
                      methodIds.length === 0
                        ? Colors.highlightFaint
                        : Colors.surfaceBright,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Очистити методи"
              >
                <Text
                  style={[
                    styles.methodOptionLabel,
                    { color: Colors.onSurface },
                  ]}
                >
                  Не вказано
                </Text>
                <Text
                  style={[
                    styles.methodOptionDescription,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  Очистити всі вибрані методи.
                </Text>
              </Pressable>
              {getCocktailMethods().map((method) => {
                const isSelected = methodIds.includes(method.id);
                const iconColor = isSelected
                  ? Colors.tint
                  : Colors.onSurfaceVariant;
                return (
                  <Pressable
                    key={method.id}
                    onPress={() => handleToggleMethod(method.id)}
                    style={[
                      styles.methodOption,
                      {
                        borderColor: isSelected
                          ? Colors.tint
                          : Colors.outlineVariant,
                        backgroundColor: isSelected
                          ? Colors.highlightFaint
                          : Colors.surfaceBright,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Вибрати ${method.label}`}
                  >
                    <View style={styles.methodOptionHeader}>
                      <View style={styles.methodOptionTitleRow}>
                        {renderMethodIcon(method.id, iconColor)}
                        <Text
                          style={[
                            styles.methodOptionLabel,
                            { color: Colors.onSurface },
                          ]}
                        >
                          {method.label}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.methodOptionDescription,
                        { color: Colors.onSurfaceVariant },
                      ]}
                    >
                      {method.description}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <SubstituteModal
        visible={substituteTarget != null}
        onClose={handleCloseSubstituteModal}
        onSelect={handleSelectSubstituteCandidate}
        ingredientName={substituteModalIngredient?.name}
        excludedIngredientId={substituteModalIngredient?.ingredientId}
        selectedSubstituteIds={substituteModalSelectionIds}
        selectedSubstituteNames={substituteModalSelectionNames}
      />

      <AppDialog
        visible={isHelpVisible}
        title="Додавання коктейлю"
        message="Використовуйте цей екран, щоб створити новий рецепт коктейлю.\n\nЗаповніть назву, фото, теги, інгредієнти, метод і інструкції, а потім натисніть «Зберегти»."
        actions={[{ label: "Зрозуміло", variant: "secondary" }]}
        onRequestClose={() => setIsHelpVisible(false)}
      />

      <AppDialog
        visible={dialogOptions != null}
        title={dialogOptions?.title ?? ""}
        message={dialogOptions?.message}
        actions={dialogOptions?.actions ?? []}
        onRequestClose={closeDialog}
      />

      <TagEditorModal
        visible={isTagModalVisible}
        title="Новий тег"
        confirmLabel="Створити"
        onClose={handleCloseTagModal}
        onSave={handleCreateTag}
      />
    </>
  );
}

type EditableIngredientRowProps = {
  ingredient: EditableIngredient;
  inventoryIngredients: Ingredient[];
  availableIngredientIds: Set<number>;
  shoppingIngredientIds: Set<number>;
  getBaseGroupId: (
    rawId: number | string | null | undefined,
  ) => number | undefined;
  cocktailsByBaseGroup: Map<number, Set<string>>;
  onChange: (key: string, changes: Partial<EditableIngredient>) => void;
  onRemove: (key: string) => void;
  onMove: (key: string, direction: "up" | "down") => void;
  onRequestUnitPicker: (key: string) => void;
  onRequestAddSubstitute: (key: string) => void;
  onRemoveSubstitute: (ingredientKey: string, substituteKey: string) => void;
  onRequestCreateIngredient: (name: string) => void;
  onInputFocus: (target?: number | null) => void;
  onOpenDialog: (options: DialogOptions) => void;
  index: number;
  totalCount: number;
};

function EditableIngredientRow({
  ingredient,
  inventoryIngredients,
  availableIngredientIds,
  shoppingIngredientIds,
  getBaseGroupId,
  cocktailsByBaseGroup,
  onChange,
  onRemove,
  onMove,
  onRequestUnitPicker,
  onRequestAddSubstitute,
  onRemoveSubstitute,
  onRequestCreateIngredient,
  onInputFocus,
  onOpenDialog,
  index,
  totalCount,
}: EditableIngredientRowProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const hideSuggestionsTimeout = useRef<NodeJS.Timeout | null>(null);
  const Colors = useAppColors();

  const normalizedName = normalizeSearchText(ingredient.name);

  const canReorder = totalCount > 1;
  const canMoveUp = canReorder && index > 0;
  const canMoveDown = canReorder && index < totalCount - 1;

  const ingredientRecord = useMemo(() => {
    if (ingredient.ingredientId == null) {
      return undefined;
    }

    return inventoryIngredients.find(
      (candidate) =>
        Number(candidate.id ?? -1) === Number(ingredient.ingredientId),
    );
  }, [ingredient.ingredientId, inventoryIngredients]);

  const baseIngredientId = useMemo(() => {
    const candidate = ingredientRecord?.baseIngredientId;
    if (candidate == null) {
      return undefined;
    }

    const parsed = Number(candidate);
    return Number.isFinite(parsed) && parsed >= 0
      ? Math.trunc(parsed)
      : undefined;
  }, [ingredientRecord?.baseIngredientId]);

  const isBrandedIngredient = baseIngredientId != null;

  const baseIngredientRecord = useMemo(() => {
    if (baseIngredientId == null) {
      return undefined;
    }

    return inventoryIngredients.find(
      (candidate) => Number(candidate.id ?? -1) === baseIngredientId,
    );
  }, [baseIngredientId, inventoryIngredients]);

  const baseIngredientStyleId = useMemo(() => {
    const candidate = baseIngredientRecord?.styleIngredientId;
    if (candidate == null) {
      return undefined;
    }

    const parsed = Number(candidate);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : undefined;
  }, [baseIngredientRecord?.styleIngredientId]);

  const styleIngredientId = useMemo(() => {
    const candidate = ingredientRecord?.styleIngredientId;
    if (candidate == null) {
      return undefined;
    }

    const parsed = Number(candidate);
    return Number.isFinite(parsed) && parsed >= 0
      ? Math.trunc(parsed)
      : undefined;
  }, [ingredientRecord?.styleIngredientId]);

  const isStyledIngredient = styleIngredientId != null;
  const shouldShowStyleSubstitution = isStyledIngredient || baseIngredientStyleId != null;

  const suggestions = useMemo(() => {
    if (normalizedName.length < MIN_AUTOCOMPLETE_LENGTH) {
      return [];
    }

    const filtered = inventoryIngredients.filter((candidate) => {
      const nameNormalized =
        candidate.searchNameNormalized ??
        normalizeSearchText(candidate.name ?? "");
      if (nameNormalized.startsWith(normalizedName)) {
        return true;
      }

      return (candidate.searchTokensNormalized ?? []).some((token) =>
        token.startsWith(normalizedName),
      );
    });

    return filtered.slice(0, MAX_SUGGESTIONS);
  }, [inventoryIngredients, normalizedName]);

  const hasExactMatch = useMemo(() => {
    if (!normalizedName) {
      return false;
    }

    return inventoryIngredients.some((candidate) => {
      const nameNormalized =
        candidate.searchNameNormalized ??
        normalizeSearchText(candidate.name ?? "");
      return nameNormalized === normalizedName;
    });
  }, [inventoryIngredients, normalizedName]);

  const showAddButton = normalizedName.length > 0 && !hasExactMatch;

  const renderSubtitle = useCallback(
    (baseGroupId: number | undefined) => {
      if (baseGroupId == null) {
        return undefined;
      }

      const count = cocktailsByBaseGroup.get(baseGroupId)?.size ?? 0;
      if (count <= 0) {
        return undefined;
      }

      const label = count === 1 ? "рецепт" : "рецепти";
      return `${count} ${label}`;
    },
    [cocktailsByBaseGroup],
  );

  useEffect(() => {
    if (normalizedName.length < MIN_AUTOCOMPLETE_LENGTH) {
      return;
    }
    const exactMatch = inventoryIngredients.find((candidate) => {
      const nameNormalized =
        candidate.searchNameNormalized ??
        normalizeSearchText(candidate.name ?? "");
      return nameNormalized === normalizedName;
    });
    const exactId = Number(exactMatch?.id ?? -1);
    const numericExactId =
      Number.isFinite(exactId) && exactId >= 0
        ? Math.trunc(exactId)
        : undefined;
    if (exactMatch && ingredient.ingredientId !== numericExactId) {
      onChange(ingredient.key, {
        ingredientId: numericExactId,
        name: exactMatch.name ?? ingredient.name,
      });
    }
  }, [
    ingredient.key,
    ingredient.ingredientId,
    ingredient.name,
    inventoryIngredients,
    normalizedName,
    onChange,
  ]);

  const handleNameFocus = useCallback(() => {
    setIsFocused(true);
    setShowSuggestions(true);
    if (hideSuggestionsTimeout.current) {
      clearTimeout(hideSuggestionsTimeout.current);
      hideSuggestionsTimeout.current = null;
    }
  }, []);

  const handleNameBlur = useCallback(() => {
    setIsFocused(false);
    hideSuggestionsTimeout.current = setTimeout(() => {
      setShowSuggestions(false);
      hideSuggestionsTimeout.current = null;
    }, 120);
  }, []);

  const handleSelectSuggestion = useCallback(
    (candidate: Ingredient) => {
      if (hideSuggestionsTimeout.current) {
        clearTimeout(hideSuggestionsTimeout.current);
        hideSuggestionsTimeout.current = null;
      }
      const candidateId = Number(candidate.id ?? -1);
      const numericId =
        Number.isFinite(candidateId) && candidateId >= 0
          ? Math.trunc(candidateId)
          : undefined;
      onChange(ingredient.key, {
        ingredientId: numericId,
        name: candidate.name ?? ingredient.name,
      });
      setShowSuggestions(false);
    },
    [ingredient.key, ingredient.name, onChange],
  );

  const handleToggleOptional = useCallback(() => {
    onChange(ingredient.key, { optional: !ingredient.optional });
  }, [ingredient.key, ingredient.optional, onChange]);

  const handleToggleGarnish = useCallback(() => {
    onChange(ingredient.key, { garnish: !ingredient.garnish });
  }, [ingredient.key, ingredient.garnish, onChange]);

  const handleToggleAllowBase = useCallback(() => {
    onChange(ingredient.key, {
      allowBaseSubstitution: !ingredient.allowBaseSubstitution,
    });
  }, [ingredient.allowBaseSubstitution, ingredient.key, onChange]);

  const handleToggleAllowBrand = useCallback(() => {
    onChange(ingredient.key, {
      allowBrandSubstitution: !ingredient.allowBrandSubstitution,
    });
  }, [ingredient.allowBrandSubstitution, ingredient.key, onChange]);

  const handleToggleAllowStyle = useCallback(() => {
    onChange(ingredient.key, {
      allowStyleSubstitution: !ingredient.allowStyleSubstitution,
    });
  }, [ingredient.allowStyleSubstitution, ingredient.key, onChange]);

  const usePluralUnits = useMemo(
    () => shouldUsePluralUnits(ingredient.amount),
    [ingredient.amount],
  );

  const unitLabel = useMemo(() => {
    if (ingredient.unitId == null) {
      return "Без одиниці";
    }
    const entry = COCKTAIL_UNIT_DICTIONARY[ingredient.unitId];
    if (!entry) {
      return "";
    }
    const label = usePluralUnits
      ? (entry.plural ?? entry.singular)
      : entry.singular;
    return label || "";
  }, [ingredient.unitId, usePluralUnits]);

  useEffect(() => {
    return () => {
      if (hideSuggestionsTimeout.current) {
        clearTimeout(hideSuggestionsTimeout.current);
        hideSuggestionsTimeout.current = null;
      }
    };
  }, []);

  return (
    <Animated.View
      layout={INGREDIENT_REORDER_TRANSITION}
      style={[
        styles.ingredientCard,
        { zIndex: Math.max(totalCount - index, 1) },
        { borderColor: Colors.outlineVariant, backgroundColor: Colors.surface },
      ]}
    >
      <View style={styles.ingredientHeaderSimple}>
        <View style={styles.ingredientTitleRow}>
          <Text
            style={[styles.ingredientHeading, { color: Colors.onSurface }]}
          >{`${index + 1}. Ingredient`}</Text>
          <View
            style={[
              styles.reorderControls,
              !canReorder && styles.reorderControlsPlaceholder,
            ]}
            pointerEvents={canReorder ? "auto" : "none"}
          >
            <Pressable
              onPress={() => onMove(ingredient.key, "up")}
              disabled={!canMoveUp}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Перемістити інгредієнт вгору"
              style={[
                styles.reorderButton,
                { borderColor: Colors.outlineVariant, backgroundColor: Colors.surface },
                !canMoveUp && styles.reorderButtonDisabled,
              ]}
            >
              <MaterialIcons
                name="keyboard-arrow-up"
                size={18}
                color={
                  canMoveUp
                    ? Colors.onSurfaceVariant
                    : `${Colors.onSurfaceVariant}66`
                }
              />
            </Pressable>
            <Pressable
              onPress={() => onMove(ingredient.key, "down")}
              disabled={!canMoveDown}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Перемістити інгредієнт вниз"
              style={[
                styles.reorderButton,
                { borderColor: Colors.outlineVariant, backgroundColor: Colors.surface },
                !canMoveDown && styles.reorderButtonDisabled,
              ]}
            >
              <MaterialIcons
                name="keyboard-arrow-down"
                size={18}
                color={
                  canMoveDown
                    ? Colors.onSurfaceVariant
                    : `${Colors.onSurfaceVariant}66`
                }
              />
            </Pressable>
          </View>
        </View>
        <Pressable
          onPress={() => onRemove(ingredient.key)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Видалити інгредієнт"
          style={!canReorder && styles.hiddenControl}
          pointerEvents={canReorder ? "auto" : "none"}
        >
          <MaterialIcons name="delete-outline" size={20} color={Colors.error} />
        </Pressable>
      </View>
      <View style={styles.ingredientNameWrapper}>
        <TextInput
          value={ingredient.name}
          onChangeText={(text) => {
            const nextNormalized = normalizeSearchText(text);
            const shouldClearId =
              ingredient.ingredientId != null &&
              nextNormalized !== normalizedName;
            onChange(ingredient.key, {
              name: text,
              ingredientId: shouldClearId ? undefined : ingredient.ingredientId,
            });
            if (isFocused) {
              setShowSuggestions(
                nextNormalized.length >= MIN_AUTOCOMPLETE_LENGTH,
              );
            }
          }}
          placeholder="Назва інгредієнта"
          placeholderTextColor={`${Colors.onSurfaceVariant}99`}
          style={[
            styles.input,
            styles.ingredientNameInput,
            {
              borderColor: Colors.outlineVariant,
              color: Colors.text,
              backgroundColor: Colors.background,
              paddingRight: showAddButton ? 72 : 16,
            },
          ]}
          onFocus={(event) => {
            handleNameFocus();
            onInputFocus(event.nativeEvent.target);
          }}
          onBlur={handleNameBlur}
          autoCapitalize="words"
        />

        {showAddButton ? (
          <Pressable
            onPress={() => {
              setShowSuggestions(false);
              onRequestCreateIngredient(ingredient.name);
            }}
            style={[
              styles.ingredientNameCreate,
              { backgroundColor: Colors.background },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Створити новий інгредієнт"
            hitSlop={8}
          >
            <Text
              style={[styles.ingredientNameCreateLabel, { color: Colors.tint }]}
            >
              + Add
            </Text>
          </Pressable>
        ) : null}
      </View>

      {showSuggestions && suggestions.length ? (
        <View
          style={[
            styles.suggestionList,
            {
              borderColor: Colors.outlineVariant,
              backgroundColor: Colors.surface,
            },
          ]}
          pointerEvents={isFocused ? "auto" : "none"}
        >
          {suggestions.map((candidate, index) => {
            const candidateId = Number(candidate.id ?? -1);
            const baseGroupId = getBaseGroupId(candidate.id);
            const isAvailable =
              candidateId >= 0 && availableIngredientIds.has(candidateId);
            const isOnShoppingList =
              candidateId >= 0 && shoppingIngredientIds.has(candidateId);
            const candidateTagColors = (candidate.tags ?? [])
              .filter(Boolean)
              .map((tag) => tag?.color ?? tagColors.yellow);
            const subtitle = renderSubtitle(baseGroupId);
            const brandIndicatorColor =
              candidate.styleIngredientId != null
                ? Colors.styledIngredient
                : candidate.baseIngredientId != null
                  ? Colors.primary
                  : undefined;
            const isLast = index === suggestions.length - 1;
            const separatorColor = isAvailable
              ? Colors.outline
              : Colors.outlineVariant;

            return (
              <React.Fragment key={candidate.id ?? candidate.name}>
                <ListRow
                  title={candidate.name ?? ""}
                  subtitle={subtitle}
                  onPress={() => handleSelectSuggestion(candidate)}
                  selected={isAvailable}
                  highlightColor={Colors.highlightFaint}
                  tagColors={candidateTagColors}
                  thumbnail={
                    <Thumb
                      label={candidate.name ?? undefined}
                      uri={candidate.photoUri}
                    />
                  }
                  brandIndicatorColor={brandIndicatorColor}
                  control={null}
                  metaFooter={
                    isOnShoppingList ? (
                      <MaterialIcons
                        name="shopping-cart"
                        size={16}
                        color={Colors.tint}
                        style={styles.shoppingIcon}
                        accessibilityRole="image"
                        accessibilityLabel="У списку покупок"
                      />
                    ) : (
                      <View style={styles.shoppingIconPlaceholder} />
                    )
                  }
                  metaAlignment="center"
                  accessibilityRole="button"
                />
                {!isLast ? (
                  <View
                    style={[
                      styles.suggestionSeparator,
                      { backgroundColor: separatorColor },
                    ]}
                    pointerEvents="none"
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </View>
      ) : null}

      <View style={styles.rowInputs}>
        <View style={styles.amountColumn}>
          <Text style={[styles.inputLabel, { color: Colors.onSurfaceVariant }]}>
            Amount
          </Text>
          <TextInput
            value={ingredient.amount}
            onChangeText={(text) => onChange(ingredient.key, { amount: text })}
            placeholder="напр., 45"
            placeholderTextColor={`${Colors.onSurfaceVariant}99`}
            keyboardType="decimal-pad"
            style={[
              styles.input,
              { borderColor: Colors.outlineVariant, color: Colors.text, backgroundColor: Colors.background },
            ]}
            onFocus={(event) => onInputFocus(event.nativeEvent.target)}
          />
        </View>
        <View style={styles.unitColumn}>
          <Text style={[styles.inputLabel, { color: Colors.onSurfaceVariant }]}>
            Unit
          </Text>
          <Pressable
            onPress={() => onRequestUnitPicker(ingredient.key)}
            style={[
              styles.unitSelector,
              {
                borderColor: Colors.outlineVariant,
                backgroundColor: Colors.background,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Вибрати одиницю"
          >
            <Text style={[styles.unitLabel, { color: Colors.onSurface }]}>
              {unitLabel}
            </Text>
            <MaterialIcons
              name="expand-more"
              size={18}
              color={Colors.onSurfaceVariant}
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.toggleRow}>
        <ToggleChip
          label="Прикраса"
          active={ingredient.garnish}
          onToggle={handleToggleGarnish}
        />
        <ToggleChip
          label="Необов’язково"
          active={ingredient.optional}
          onToggle={handleToggleOptional}
        />
      </View>

      {isBrandedIngredient ? (
        <View style={styles.toggleRow}>
          <ToggleChip
            label="Дозволити базову заміну"
            active={ingredient.allowBaseSubstitution}
            onToggle={handleToggleAllowBase}
            onInfo={() =>
              onOpenDialog({
                title: "Дозволити базову заміну",
                message:
                  "Якщо вказаний інгредієнт недоступний, коктейль вважатиметься доступним із його базовим інгредієнтом.",
                actions: [{ label: "OK" }],
              })
            }
          />
          <ToggleChip
            label="Дозволити брендову заміну"
            active={ingredient.allowBrandSubstitution}
            onToggle={handleToggleAllowBrand}
            onInfo={() =>
              onOpenDialog({
                title: "Дозволити брендову заміну",
                message:
                  "Якщо вказаний інгредієнт недоступний, коктейль вважатиметься доступним із брендовими інгредієнтами цієї бази.",
                actions: [{ label: "OK" }],
              })
            }
          />
        </View>
      ) : null}

      {shouldShowStyleSubstitution ? (
        <View style={styles.toggleRow}>
          <ToggleChip
            label="Дозволити стильові заміни"
            active={ingredient.allowStyleSubstitution}
            onToggle={handleToggleAllowStyle}
            onInfo={() =>
              onOpenDialog({
                title: "Дозволити стильові заміни",
                message:
                  "Якщо вказаний стильовий інгредієнт недоступний, коктейль вважатиметься доступним із його стильовою базою або іншими стилями тієї самої бази.",
                actions: [{ label: "OK" }],
              })
            }
          />
        </View>
      ) : null}

      <View style={styles.substitutesSection}>
        <Pressable
          onPress={() => onRequestAddSubstitute(ingredient.key)}
          style={[
            styles.addSubstituteButton,
            {
              borderColor: Colors.outlineVariant,
              backgroundColor: Colors.background,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Додати заміну"
        >
          <MaterialCommunityIcons name="plus" size={16} color={Colors.tint} />
          <Text style={[styles.addSubstituteLabel, { color: Colors.tint }]}>
            Add substitute
          </Text>
        </Pressable>
        {ingredient.substitutes.length ? (
          <View style={styles.substitutesList}>
            {ingredient.substitutes.map((substitute) => (
              <View
                key={substitute.key}
                style={[
                  styles.substitutePill,
                  {
                    borderColor: Colors.outlineVariant,
                    backgroundColor: `${Colors.tint}1A`,
                  },
                  substitute.isBrand && {
                    borderLeftColor: Colors.tint,
                    borderLeftWidth: 4,
                  },
                ]}
              >
                <Text
                  style={[styles.substituteLabel, { color: Colors.onSurface }]}
                  numberOfLines={1}
                >
                  {substitute.name}
                  {substitute.isBrand ? " • brand" : ""}
                </Text>
                <Pressable
                  onPress={() =>
                    onRemoveSubstitute(ingredient.key, substitute.key)
                  }
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${substitute.name}`}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={16}
                    color={Colors.onSurfaceVariant}
                  />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

type ToggleChipProps = {
  label: string;
  active: boolean;
  onToggle: () => void;
  onInfo?: () => void;
};

function ToggleChip({ label, active, onToggle, onInfo }: ToggleChipProps) {
  const Colors = useAppColors();
  return (
    <View style={styles.toggleChipContainer}>
      <Pressable
        onPress={onToggle}
        style={[
          styles.toggleChip,
          {
            backgroundColor: active ? `${Colors.tint}1A` : "transparent",
          },
        ]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: active }}
      >
        <MaterialCommunityIcons
          name={active ? "checkbox-marked-outline" : "checkbox-blank-outline"}
          size={18}
          color={active ? Colors.tint : Colors.onSurfaceVariant}
        />
        <Text
          style={[styles.toggleChipLabel, { color: Colors.onSurfaceVariant }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
      {onInfo ? (
        <Pressable
          onPress={onInfo}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`About ${label}`}
        >
          <MaterialCommunityIcons
            name="information-outline"
            size={16}
            color={Colors.onSurfaceVariant}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  inlineActions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  inlineActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    height: 56,
    minWidth: 250,
    borderRadius: 10,
    borderWidth: 1,
  },
  inlineActionLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 120,
  },
  section: {
    gap: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
  hint: {
    fontSize: 14,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 14, default: 12 }),
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 120,
  },
  rowWrap: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  card: {
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  halfCard: {
    flex: 1,
    minWidth: "48%",
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  glassTile: {
    width: 150,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "center",
    borderRadius: 12,
    overflow: "hidden",
  },
  glassPreview: {
    width: 150,
    height: 150,
    borderRadius: 12,
  },
  cardHint: {
    fontSize: 12,
  },
  photoTileWrapper: {
    width: 150,
    height: 150,
    alignSelf: "center",
    position: "relative",
  },
  photoTile: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  photoPlaceholderContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  photoPreview: {
    width: "100%",
    height: "100%",
  },
  cropFrame: {
    position: "absolute",
    top: 10,
    bottom: 10,
    left: 10,
    right: 10,
    borderRadius: 10,
    borderWidth: 0,
  },
  methodPicker: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  methodPickerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  methodPickerLabel: {
    fontSize: 15,
    fontWeight: "400",
    flex: 1,
  },
  glassRow: {
    justifyContent: "space-between",
    gap: 16,
  },
  glassOption: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 12,
  },
  glassOptionImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  glassOptionLabel: {
    textAlign: "center",
    fontSize: 14,
  },
  glassList: {
    gap: 12,
    paddingVertical: 8,
  },
  tagHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
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
  tagList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  manageTagsLink: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
  },
  addIngredientButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
    width: "50%",
    alignSelf: "flex-start",
    zIndex: 1,
  },
  addIngredientLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  ingredientsList: {
    gap: 16,
    zIndex: 2,
  },
  ingredientCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  ingredientHeaderSimple: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ingredientTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  ingredientHeading: {
    fontSize: 14,
    fontWeight: "600",
  },
  reorderControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 6,
  },
  reorderControlsPlaceholder: {
    opacity: 0,
  },
  reorderButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  reorderButtonDisabled: {
    opacity: 0.6,
  },
  hiddenControl: {
    opacity: 0,
  },
  ingredientNameInput: {
    flex: 1,
  },
  ingredientNameWrapper: {
    position: "relative",
  },
  ingredientNameCreate: {
    position: "absolute",
    right: 12,
    top: 2,
    bottom: 2,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 4,
  },
  ingredientNameCreateLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  suggestionList: {
    position: "absolute",
    top: 100,
    left: 0,
    right: 0,
    zIndex: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: "hidden",
    paddingTop: 0,
    paddingBottom: 4,
  },
  suggestionSeparator: {
    height: StyleSheet.hairlineWidth,
  },
  shoppingIcon: {
    marginTop: 4,
  },
  shoppingIconPlaceholder: {
    minHeight: 16,
    minWidth: 16,
    marginTop: 4,
  },
  rowInputs: {
    flexDirection: "row",
    gap: 12,
  },
  amountColumn: {
    flex: 1,
    gap: 6,
  },
  unitColumn: {
    flex: 1,
    gap: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  unitSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  unitLabel: {
    fontSize: 16,
    fontWeight: "400",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  toggleChipContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  toggleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  toggleChipLabel: {
    fontSize: 14,
    fontWeight: "400",
  },
  substitutesSection: {
    gap: 10,
  },
  addSubstituteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 52,
    width: "50%",
    alignSelf: "flex-start",
  },
  addSubstituteLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  substitutesList: {
    gap: 8,
  },
  substitutePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  substituteLabel: {
    fontSize: 14,
    fontWeight: "400",
    flex: 1,
  },
  substituteHint: {
    fontSize: 14,
  },
  buttonsContainer: {
    marginTop: 8,
    gap: 24,
  },
  submitButton: {
    borderRadius: 12,
    height: 56,
    minWidth: 250,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    paddingHorizontal: 20,
    zIndex: 1,
  },
  submitLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  bottomSpacer: {
    height: 200,
  },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalCard: {
    width: "100%",
    maxHeight: "92%",
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
  modalCardSmall: {
    borderRadius: 12,
    padding: 20,
    gap: 12,
  },
  unitModalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  unitModalCard: {
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
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 4,
  },
  unitModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  modalActionButton: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalActionLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  unitModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  modalListContent: {
    gap: 8,
    paddingBottom: 12,
  },
  modalEmptyText: {
    textAlign: "center",
    fontSize: 14,
    marginTop: 24,
  },
  unitList: {},
  unitModalScroll: {
    maxHeight: "100%",
    width: "100%",
  },
  unitModalList: {
    flexGrow: 1,
    paddingVertical: 8,
    gap: 4,
  },
  methodModalList: {
    flexGrow: 1,
    paddingVertical: 8,
    gap: 4,
  },
  unitOption: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  methodOption: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  methodOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
  },
  methodOptionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  methodOptionIconWrapper: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  methodOptionIcon: {
    width: 18,
    height: 18,
  },
  muddleIcon: {
    transform: [{ scaleX: 2 }],
  },
  methodOptionLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  methodOptionDescription: {
    fontSize: 13,
  },
  removePhotoButton: {
    position: "absolute",
    top: 8,
    right: 8,
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  clearButton: {
    padding: 6,
    borderRadius: 8,
  },
});
