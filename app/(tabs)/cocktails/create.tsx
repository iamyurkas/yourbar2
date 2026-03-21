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
  InteractionManager,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { resolveAssetFromCatalog } from "@/assets/image-manifest";
import { AppDialog, type DialogOptions } from "@/components/AppDialog";
import { AppImage } from "@/components/AppImage";
import { HeaderIconButton } from "@/components/HeaderIconButton";
import { ImageCropperModal } from "@/components/ImageCropperModal";
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
import { compareGlobalAlphabet, compareOptionalGlobalAlphabet } from "@/libs/global-sort";
import { getPluralCategory } from "@/libs/i18n/plural";
import { useI18n } from "@/libs/i18n/use-i18n";
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
const MIN_DEFAULT_SERVINGS = 1;
const MAX_DEFAULT_SERVINGS = 6;
const DEFAULT_SERVINGS_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

type EditableSubstitute = {
  key: string;
  ingredientId?: number;
  name: string;
  isBrand?: boolean;
  amount: string;
  unitId?: number;
};

type SubstituteUnitPickerTarget = {
  ingredientKey: string;
  substituteKey: string;
};

type EditableIngredient = {
  key: string;
  ingredientId?: number;
  name: string;
  amount: string;
  unitId?: number;
  optional: boolean;
  garnish: boolean;
  process: boolean;
  serving: boolean;
  allowBaseSubstitution: boolean;
  allowBrandSubstitution: boolean;
  allowStyleSubstitution: boolean;
  substitutes: EditableSubstitute[];
};

type CocktailFormSnapshot = {
  name: string;
  defaultServings: number;
  glassId: string | null;
  methodIds: CocktailMethodId[];
  description: string;
  instructions: string;
  video: string;
  imageUri: string | null;
  selectedTagIds: number[];
  ingredients: {
    ingredientId?: number;
    name: string;
    amount: string;
    unitId?: number;
    optional: boolean;
    garnish: boolean;
    process: boolean;
    serving: boolean;
    allowBaseSubstitution: boolean;
    allowBrandSubstitution: boolean;
    allowStyleSubstitution: boolean;
    substitutes: {
      ingredientId?: number;
      name: string;
      isBrand?: boolean;
      amount: string;
      unitId?: number;
    }[];
  }[];
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
    amount?: string | null;
    unit?: string | null;
    unitId?: number | string | null;
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

  const unitIdValue = source.unitId != null ? Number(source.unitId) : undefined;
  const substituteUnitId =
    unitIdValue != null && Number.isFinite(unitIdValue) && unitIdValue >= 0
      ? Math.trunc(unitIdValue)
      : undefined;

  return {
    key: createUniqueKey(`sub-${parentKey}`),
    ingredientId: substituteIngredientId,
    name,
    isBrand: source.brand ?? false,
    amount: source.amount?.trim() ?? "",
    unitId: substituteUnitId,
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
    process: initial?.process ?? false,
    serving: initial?.serving ?? false,
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

function sanitizeDefaultServings(value?: number | null): number {
  const normalized = Number(value ?? MIN_DEFAULT_SERVINGS);
  if (!Number.isFinite(normalized)) {
    return MIN_DEFAULT_SERVINGS;
  }

  const integerValue = Math.trunc(normalized);
  return Math.max(MIN_DEFAULT_SERVINGS, Math.min(MAX_DEFAULT_SERVINGS, integerValue));
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
        amount: (item as { amount?: string }).amount,
        unitId:
          (item as { unitId?: number | string | null }).unitId ??
          (item as { unit?: string }).unit,
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
    process: Boolean((recipe as { process?: boolean }).process),
    serving: Boolean((recipe as { serving?: boolean }).serving),
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
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
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
  const {
    setHasUnsavedChanges,
    setRequireLeaveConfirmation,
    setSaveHandler,
    consumeSkipNextLeaveConfirmation,
  } = useUnsavedChanges();

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
  const ingredientCreateReturnParams = useMemo(() => {
    const payload = {
      mode: modeParam,
      source: "ingredient",
      ingredientId: ingredientParam,
      ingredientName: ingredientNameParam,
      cocktailId: cocktailParam,
      cocktailName: cocktailNameParam,
      openInstanceId: openInstanceIdParam,
    };
    const json = JSON.stringify(payload);
    return json === "{}" ? formReturnParams : json;
  }, [
    cocktailNameParam,
    cocktailParam,
    formReturnParams,
    ingredientNameParam,
    ingredientParam,
    modeParam,
    openInstanceIdParam,
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
  const [defaultServings, setDefaultServings] = useState(MIN_DEFAULT_SERVINGS);
  const [glassId, setGlassId] = useState<string | null>("martini");
  const [isGlassModalVisible, setIsGlassModalVisible] = useState(false);
  const [methodIds, setMethodIds] = useState<CocktailMethodId[]>([]);
  const [isMethodModalVisible, setIsMethodModalVisible] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [pendingCropUri, setPendingCropUri] = useState<string | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [video, setVideo] = useState("");
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
  const [substituteUnitPickerTarget, setSubstituteUnitPickerTarget] =
    useState<SubstituteUnitPickerTarget | null>(null);
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
    (tag) => tag.id === 11 || tag.name.trim().toLowerCase() === "custom",
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
  const imagePickingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearImagePickingTimeout = useCallback(() => {
    if (imagePickingTimeoutRef.current) {
      clearTimeout(imagePickingTimeoutRef.current);
      imagePickingTimeoutRef.current = null;
    }
  }, []);

  const beginImagePicking = useCallback(() => {
    clearImagePickingTimeout();
    setIsPickingImage(true);
    imagePickingTimeoutRef.current = setTimeout(() => {
      setIsPickingImage(false);
      imagePickingTimeoutRef.current = null;
      console.warn("Image picking state reset after timeout");
    }, 45_000);
  }, [clearImagePickingTimeout]);

  const endImagePicking = useCallback(() => {
    clearImagePickingTimeout();
    setIsPickingImage(false);
  }, [clearImagePickingTimeout]);

  useEffect(
    () => () => {
      clearImagePickingTimeout();
    },
    [clearImagePickingTimeout],
  );

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
      defaultServings,
      glassId,
      methodIds,
      description,
      instructions,
      video,
      imageUri,
      selectedTagIds: normalizedTags,
      ingredients: ingredientsState.map((item) => ({
        ingredientId: item.ingredientId,
        name: item.name,
        amount: item.amount,
        unitId: item.unitId,
        optional: item.optional,
        garnish: item.garnish,
        process: item.process,
        serving: item.serving,
        allowBaseSubstitution: item.allowBaseSubstitution,
        allowBrandSubstitution: item.allowBrandSubstitution,
        allowStyleSubstitution: item.allowStyleSubstitution,
        substitutes: item.substitutes.map((substitute) => ({
          ingredientId: substitute.ingredientId,
          name: substitute.name,
          isBrand: substitute.isBrand,
          amount: substitute.amount,
          unitId: substitute.unitId,
        })),
      })),
    };
  }, [
    description,
    defaultServings,
    glassId,
    imageUri,
    ingredientsState,
    instructions,
    video,
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
      })
    });

    return map;
  }, [cocktails, getBaseGroupId]);

  const placeholderLabel = useMemo(
    () => (imageUri ? t("cocktailForm.changePhoto") : t("cocktailForm.addPhoto")),
    [imageUri, t],
  );

  const selectedGlass = useMemo(
    () => GLASSWARE.find((item) => item.id === glassId),
    [glassId],
  );
  const selectedMethods = useMemo(
    () => methodIds.flatMap((id) => {
      const method = getCocktailMethodById(id);
      return method ? [method] : [];
    }),
    [methodIds],
  );

  const availableCocktailTags = useMemo(() => {
    const sortedCustom = [...customCocktailTags].sort((a, b) =>
      compareOptionalGlobalAlphabet(a.name, b.name),
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
        const HEADER_OFFSET = 156;
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
    setDefaultServings(MIN_DEFAULT_SERVINGS);
    setGlassId("martini");
    setMethodIds([]);
    setDescription("");
    setInstructions("");
    setVideo("");
    setImageUri(null);
    setPendingCropUri(null);
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
      setDefaultServings(
        sanitizeDefaultServings(
          (baseCocktail as { defaultServings?: number | null }).defaultServings,
        ),
      );
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
      setVideo(baseCocktail.video ?? "");
      setImageUri(baseCocktail.photoUri ?? null);
      setPendingCropUri(null);
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
        title: t("cocktailForm.mediaAccessRequired"),
        message:
          t("cocktailForm.mediaAccessRequiredMessage"),
        actions: [{ label: t("common.ok") }],
      });
    }

    return false;
  }, [permissionStatus?.granted, requestPermission, showDialog, t]);

  const handlePickImage = useCallback(async () => {
    if (isPickingImage) {
      return;
    }

    const hasPermission = await ensureMediaPermission();
    if (!hasPermission) {
      return;
    }

    try {
      beginImagePicking();
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 1,
        exif: false,
      });

      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        if (asset?.uri) {
          setPendingCropUri(asset.uri);
        }
      }
    } catch (error) {
      console.warn("Failed to pick image", error);
      showDialog({
        title: t("cocktailForm.couldNotPickImage"),
        message: t("common.tryAgainLater"),
        actions: [{ label: t("common.ok") }],
      });
    } finally {
      endImagePicking();
    }
  }, [beginImagePicking, endImagePicking, ensureMediaPermission, isPickingImage, showDialog, t]);

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
        title: t("cocktailForm.cameraAccessRequired"),
        message:
          t("cocktailForm.cameraAccessRequiredMessage"),
        actions: [{ label: t("common.ok") }],
      });
    }

    return false;
  }, [cameraPermissionStatus?.granted, requestCameraPermission, showDialog, t]);

  const handleTakePhoto = useCallback(async () => {
    if (isPickingImage) {
      return;
    }

    const hasPermission = await ensureCameraPermission();
    if (!hasPermission) {
      return;
    }

    try {
      beginImagePicking();
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 1,
        exif: false,
      });

      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        if (asset?.uri) {
          setPendingCropUri(asset.uri);
        }
      }
    } catch (error) {
      console.warn("Failed to capture image", error);
      showDialog({
        title: t("cocktailForm.couldNotTakePhoto"),
        message: t("common.tryAgainLater"),
        actions: [{ label: t("common.ok") }],
      });
    } finally {
      endImagePicking();
    }
  }, [beginImagePicking, endImagePicking, ensureCameraPermission, isPickingImage, showDialog, t]);

  const handleSelectImageSource = useCallback(() => {
    const runAfterDialogDismiss = (callback: () => void) => {
      InteractionManager.runAfterInteractions(() => {
        requestAnimationFrame(() => {
          callback();
        });
      });
    };

    showDialog({
      title: t("cocktailForm.addPhoto"),
      message: t("cocktailForm.addPhotoMessage"),
      actions: [
        {
          label: t("cocktailForm.takePhoto"),
          onPress: () => {
            runAfterDialogDismiss(() => {
              void handleTakePhoto();
            });
          },
        },
        {
          label: t("cocktailForm.chooseFromGallery"),
          onPress: () => {
            runAfterDialogDismiss(() => {
              void handlePickImage();
            });
          },
        },
        { label: t("common.cancel"), variant: "secondary" },
      ],
    });
  }, [handlePickImage, handleTakePhoto, showDialog, t]);

  const handleRemovePhoto = useCallback(() => {
    setImageUri(null);
    setPendingCropUri(null);
  }, []);

  const handleCancelCrop = useCallback(() => {
    setPendingCropUri(null);
  }, []);

  const handleApplyCrop = useCallback((uri: string) => {
    setImageUri(uri);
    setPendingCropUri(null);
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

  const handleChangeSubstitute = useCallback(
    (
      ingredientKey: string,
      substituteKey: string,
      changes: Partial<Pick<EditableSubstitute, "amount" | "unitId">>,
    ) => {
      handleUpdateSubstitutes(ingredientKey, (items) =>
        items.map((substitute) =>
          substitute.key === substituteKey
            ? { ...substitute, ...changes }
            : substitute,
        ),
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

  const handleOpenSubstituteUnitPicker = useCallback(
    (ingredientKey: string, substituteKey: string) => {
      setSubstituteUnitPickerTarget({ ingredientKey, substituteKey });
    },
    [],
  );

  const handleCloseSubstituteUnitPicker = useCallback(() => {
    setSubstituteUnitPickerTarget(null);
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

  const sortedUnitOptions = useMemo(() => {
    const category = usePluralUnitsInPicker ? getPluralCategory(locale, 2) : "one";
    const form = usePluralUnitsInPicker ? "plural" : "singular";
    const mappedOptions = COCKTAIL_UNIT_OPTIONS.map((option) => {
      let displayLabel = t(`unit.${option.id}.${category}`);
      if (displayLabel === `unit.${option.id}.${category}`) {
        displayLabel = t(`unit.${option.id}.${form}`);
      }

      if (displayLabel === `unit.${option.id}.${form}`) {
        displayLabel = option.label || " ";
      }

      return {
        ...option,
        displayLabel,
      };
    });

    const emptyUnitOption = mappedOptions.find((option) => !option.displayLabel.trim());
    const namedUnitOptions = mappedOptions
      .filter((option) => option !== emptyUnitOption)
      .sort((a, b) => {
        const labelDiff = compareGlobalAlphabet(a.displayLabel.trim(), b.displayLabel.trim());
        if (labelDiff !== 0) {
          return labelDiff;
        }
        return a.id - b.id;
      });

    return emptyUnitOption ? [emptyUnitOption, ...namedUnitOptions] : namedUnitOptions;
  }, [locale, t, usePluralUnitsInPicker]);

  const targetSubstituteForUnitPicker = useMemo(() => {
    if (!substituteUnitPickerTarget) {
      return undefined;
    }

    const ingredient = ingredientsState.find(
      (item) => item.key === substituteUnitPickerTarget.ingredientKey,
    );
    return ingredient?.substitutes.find(
      (substitute) => substitute.key === substituteUnitPickerTarget.substituteKey,
    );
  }, [ingredientsState, substituteUnitPickerTarget]);

  const usePluralUnitsInSubstitutePicker = useMemo(
    () => shouldUsePluralUnits(targetSubstituteForUnitPicker?.amount),
    [targetSubstituteForUnitPicker?.amount],
  );

  const sortedSubstituteUnitOptions = useMemo(() => {
    const category = usePluralUnitsInSubstitutePicker
      ? getPluralCategory(locale, 2)
      : "one";
    const form = usePluralUnitsInSubstitutePicker ? "plural" : "singular";

    const mappedOptions = COCKTAIL_UNIT_OPTIONS.map((option) => {
      let displayLabel = t(`unit.${option.id}.${category}`);
      if (displayLabel === `unit.${option.id}.${category}`) {
        displayLabel = t(`unit.${option.id}.${form}`);
      }

      if (displayLabel === `unit.${option.id}.${form}`) {
        displayLabel = option.label || " ";
      }

      return {
        ...option,
        displayLabel,
      };
    });

    const emptyUnitOption = mappedOptions.find(
      (option) => !option.displayLabel.trim(),
    );
    const namedUnitOptions = mappedOptions
      .filter((option) => option !== emptyUnitOption)
      .sort((a, b) => {
        const labelDiff = compareGlobalAlphabet(
          a.displayLabel.trim(),
          b.displayLabel.trim(),
        );
        if (labelDiff !== 0) {
          return labelDiff;
        }
        return a.id - b.id;
      });

    return emptyUnitOption
      ? [emptyUnitOption, ...namedUnitOptions]
      : namedUnitOptions;
  }, [locale, t, usePluralUnitsInSubstitutePicker]);

  const selectedSubstituteUnitOptionId = targetSubstituteForUnitPicker?.unitId;

  const handleSelectSubstituteUnit = useCallback(
    (unitId?: number) => {
      if (!substituteUnitPickerTarget) {
        return;
      }

      const selectedOption = sortedSubstituteUnitOptions.find(
        (option) => option.id === unitId,
      );

      handleChangeSubstitute(
        substituteUnitPickerTarget.ingredientKey,
        substituteUnitPickerTarget.substituteKey,
        {
          unitId: selectedOption?.id,
        },
      );

      setSubstituteUnitPickerTarget(null);
    },
    [handleChangeSubstitute, sortedSubstituteUnitOptions, substituteUnitPickerTarget],
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
            returnToParams: ingredientCreateReturnParams,
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
          returnToParams: ingredientCreateReturnParams,
        },
      });
    },
    [ingredientCreateReturnParams],
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
        amount: "",
        unitId: undefined,
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
        title: t("cocktailForm.nameRequired"),
        message: t("cocktailForm.nameRequiredMessage"),
        actions: [{ label: t("common.ok") }],
      });
      return;
    }

    const sanitizedIngredients: CreateCocktailInput["ingredients"] = ingredientsState
      .flatMap((item, index) => {
        const ingredientName = item.name.trim();
        if (!ingredientName) {
          return [];
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

        const substitutes: CreateCocktailInput["ingredients"][number]["substitutes"] = item.substitutes.flatMap((substitute) => {
          const substituteName = substitute.name.trim();
          if (!substituteName) {
            return [];
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

          return [{
            ingredientId: substituteIngredientId,
            name: substituteName,
            brand: substitute.isBrand ?? false,
            amount: substitute.amount.trim() || undefined,
            unitId: substitute.unitId,
          }];
        });

        const isIceIngredient =
          ingredientId != null &&
          ingredientById.get(ingredientId)?.ingredientKind === 'ice';

        const process = isIceIngredient ? !item.serving : item.process;
        const serving = isIceIngredient ? !process : item.serving;

        return [{
          ingredientId,
          name: ingredientName,
          amount: item.amount.trim() || undefined,
          unitId,
          optional: isIceIngredient ? false : item.optional,
          garnish: isIceIngredient ? false : item.garnish,
          process,
          serving,
          allowBaseSubstitution: item.allowBaseSubstitution,
          allowBrandSubstitution: item.allowBrandSubstitution,
          allowStyleSubstitution: item.allowStyleSubstitution,
          substitutes,
          order: index + 1,
        } satisfies CreateCocktailInput["ingredients"][number]];
      });

    if (!sanitizedIngredients.length) {
      showDialog({
        title: t("cocktailForm.recipeRequired"),
        message: t("cocktailForm.recipeRequiredMessage"),
        actions: [{ label: t("common.ok") }],
      });
      return;
    }

    const descriptionValue = description.trim();
    const instructionsValue = instructions.trim();
    const videoValue = video.trim();
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
        defaultServings: sanitizeDefaultServings(defaultServings),
        glassId: glassId ?? undefined,
        methodIds,
        photoUri: initialPhotoUri,
        description: descriptionValue || undefined,
        instructions: instructionsValue || undefined,
        video: videoValue || undefined,
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
          title: t("cocktailForm.couldNotSave"),
          message: t("common.tryAgainLater"),
          actions: [{ label: t("common.ok") }],
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
        router.replace({ pathname: returnToPath as never, params: returnToParams as never });
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
    defaultServings,
    description,
    glassId,
    imageUri,
    ingredientById,
    ingredientsState,
    instructions,
    video,
    isSaving,
    isEditMode,
    methodIds,
    name,
    prefilledCocktail?.id,
    prefilledCocktail?.photoUri,
    returnToParams,
    returnToPath,
    selectedTagIds,
    setHasUnsavedChanges,
    showDialog,
    t,
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
        title: t("cocktailForm.cocktailNotFound"),
        message: t("common.tryAgainLater"),
        actions: [{ label: t("common.ok") }],
      });
      return;
    }

    const trimmedName = prefilledCocktail?.name?.trim();
    const message = trimmedName
      ? t("cocktailForm.deleteConfirmNamed", { name: trimmedName })
      : t("cocktailForm.deleteConfirmUnnamed");

    showDialog({
      title: t("cocktailForm.deleteCocktail"),
      message,
      actions: [
        { label: t("common.cancel"), variant: "secondary" },
        {
          label: t("common.delete"),
          variant: "destructive",
          onPress: () => {
            const wasDeleted = deleteCocktail(numericId);
            if (!wasDeleted) {
              showDialog({
                title: t("cocktailForm.couldNotDelete"),
                message: t("common.tryAgainLater"),
                actions: [{ label: t("common.ok") }],
              });
              return;
            }

            setHasUnsavedChanges(false);
            const state = navigation.getState();
            const currentIndex = state?.index ?? 0;
            if (currentIndex >= 2) {
              navigation.dispatch(StackActions.pop(2));
              return;
            }
            if (returnToPath) {
              router.navigate({ pathname: returnToPath as never, params: returnToParams as never });
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
    t,
  ]);

  const confirmLeave = useCallback(
    (onLeave: () => void) => {
      showDialog({
        title: t("cocktailForm.leaveWithoutSaving"),
        message: t("cocktailForm.leaveWithoutSavingMessage"),
        actions: [
          { label: t("common.save"), variant: "primary", onPress: handleSubmit },
          { label: t("cocktailForm.stay"), variant: "secondary" },
          {
            label: t("cocktailForm.leave"),
            variant: "destructive",
            onPress: () => {
              setHasUnsavedChanges(false);
              onLeave();
            },
          },
        ],
      });
    },
    [handleSubmit, setHasUnsavedChanges, showDialog, t],
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
        router.replace({ pathname: returnToPath as never, params: returnToParams as never });
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
        router.replace({ pathname: returnToPath as never, params: returnToParams as never });
        return;
      }

      router.replace("/cocktails");
    };

    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (isNavigatingAfterSaveRef.current || isHandlingBackRef.current) {
        return;
      }
      if (consumeSkipNextLeaveConfirmation()) {
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
    consumeSkipNextLeaveConfirmation,
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
          title: isEditMode ? t("cocktailForm.editTitle") : t("cocktailForm.addTitle"),
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
              accessibilityLabel={t("common.goBack")}
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
              accessibilityLabel={t("common.openScreenHelp")}
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
            <Text style={[styles.label, { color: Colors.onSurface }]}>
              {t("cocktailForm.name")}
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("cocktailForm.namePlaceholder")}
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
              <Text style={[styles.cardLabel, { color: Colors.onSurface }]}>
                {t("cocktailForm.glass")}
              </Text>
              <Pressable
                style={styles.glassTile}
                accessibilityRole="button"
                accessibilityLabel={t("cocktailForm.selectGlassware")}
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
              <Text style={[styles.cardLabel, { color: Colors.onSurface }]}>
                {t("cocktailForm.photo")}
              </Text>
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
                          styles.photoPlaceholderHint,
                          { color: `${Colors.onSurfaceVariant}99` },
                        ]}
                      >
                        {t("cocktailForm.tapToSelectImage")}
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
                    accessibilityLabel={t("cocktailForm.removePhoto")}
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
              {t("cocktailForm.method")}
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
              accessibilityLabel={t("cocktailForm.selectMethod")}
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
                    ? selectedMethods
                      .map((method) => t(`cocktailMethod.${method.id}.label`))
                      .join(", ")
                    : t("cocktailForm.notSpecified")}
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
                {t("cocktailForm.tags")}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("cocktailForm.createTag")}
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
                  {t("cocktailForm.createTag")}
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.hint, { color: Colors.onSurfaceVariant }]}>
              {t("cocktailForm.selectTags")}
            </Text>
            <View style={styles.tagList}>
              {tagSelection.map((tag) => {
                const isBuiltin = BUILTIN_COCKTAIL_TAGS.some(bt => bt.id === tag.id);
                const translatedName = isBuiltin ? t(`cocktailTag.${tag.id}`) : tag.name;
                const finalName = (isBuiltin && translatedName !== `cocktailTag.${tag.id}`) ? translatedName : tag.name;

                return (
                  <TagPill
                    key={tag.id}
                    label={finalName}
                    color={tag.color}
                    selected={tag.selected}
                    onPress={() => handleToggleTag(tag.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: tag.selected }}
                    androidRippleColor={`${Colors.surface}33`}
                  />
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: Colors.onSurface }]}>
              {t("cocktailForm.description")}
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t("cocktailForm.optionalDescription")}
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
              {t("cocktailForm.instructions")}
            </Text>
            <TextInput
              value={instructions}
              onChangeText={setInstructions}
              placeholder={t("cocktailForm.instructionsPlaceholder")}
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
              {t("cocktailForm.video")}
            </Text>
            <TextInput
              value={video}
              onChangeText={setVideo}
              placeholder={t("cocktailForm.videoPlaceholder")}
              placeholderTextColor={`${Colors.onSurfaceVariant}99`}
              style={[
                styles.input,
                {
                  borderColor: Colors.outlineVariant,
                  color: Colors.text,
                  backgroundColor: Colors.surface,
                },
              ]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              onFocus={(event) => scrollFieldIntoView(event.nativeEvent.target)}
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: Colors.onSurface }]}>
              {t("cocktailForm.defaultServings")}
            </Text>
            <View style={styles.servingsGrid}>
              {DEFAULT_SERVINGS_OPTIONS.map((option) => {
                const isSelected = defaultServings === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setDefaultServings(option)}
                    accessibilityRole="button"
                    accessibilityLabel={t("cocktailForm.selectNamed", { name: String(option) })}
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.servingsCell,
                      {
                        borderColor: isSelected ? Colors.tint : Colors.outlineVariant,
                        backgroundColor: isSelected ? Colors.tint : Colors.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.servingsCellLabel,
                        { color: isSelected ? Colors.onPrimary : Colors.onSurface },
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: Colors.onSurface }]}>
              {t("cocktailForm.ingredients")}
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
                  onRequestSubstituteUnitPicker={handleOpenSubstituteUnitPicker}
                  onRequestAddSubstitute={handleOpenSubstituteModal}
                  onRemoveSubstitute={handleRemoveSubstitute}
                  onChangeSubstitute={handleChangeSubstitute}
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
              accessibilityLabel={t("cocktailForm.addIngredient")}
            >
              <MaterialCommunityIcons
                name="plus"
                size={18}
                color={Colors.tint}
              />
              <Text style={[styles.addIngredientLabel, { color: Colors.tint }]}>
                {t("cocktailForm.addIngredient")}
              </Text>
            </Pressable>
          </View>
          <View style={styles.buttonsContainer}>
            <Pressable
              onPress={handleSubmit}
              disabled={isSaveDisabled}
              style={({ pressed }) => [
                styles.submitButton,
                {
                  backgroundColor: Colors.tint,
                  opacity: isSaveDisabled ? 0.6 : pressed ? 0.8 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("cocktailForm.saveCocktail")}
            >
              <Text style={[styles.submitLabel, { color: Colors.onPrimary }]}>
                {t("cocktailForm.saveCocktail")}
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
                    accessibilityLabel={t("cocktailForm.editCocktail")}
                  >
                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={18}
                      color={Colors.primary}
                    />
                    <Text style={[styles.inlineActionLabel, { color: Colors.primary }]}>{t("cocktailForm.editCocktail")}</Text>
                  </Pressable>
                ) : null}
                {isEditMode ? (
                  <Pressable
                    onPress={handleDeletePress}
                    style={[styles.inlineActionButton, { borderColor: Colors.error, backgroundColor: Colors.surfaceBright }]}
                    accessibilityRole="button"
                    accessibilityLabel={t("cocktailForm.deleteCocktail")}
                  >
                    <MaterialIcons
                      name="delete-outline"
                      size={18}
                      color={Colors.error}
                    />
                    <Text style={[styles.inlineActionLabel, { color: Colors.error }]}>{t("cocktailForm.deleteCocktail")}</Text>
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
          style={[
            styles.modalOverlay,
            {
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
          onPress={() => setIsGlassModalVisible(false)}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
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
                {t("cocktailForm.selectGlass")}
              </Text>
              <Pressable
                onPress={() => setIsGlassModalVisible(false)}
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
                    accessibilityLabel={t("cocktailForm.selectNamed", { name: t(`glassware.${item.id}`) })}
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
                      {t(`glassware.${item.id}`)}
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
          style={[
            styles.unitModalOverlay,
            {
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
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
                {t("cocktailForm.selectUnit")}
              </Text>
              <Pressable
                onPress={handleCloseUnitPicker}
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
              style={styles.unitModalScroll}
              contentContainerStyle={styles.unitModalList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {sortedUnitOptions.map((option) => {
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
                      option.displayLabel.trim()
                        ? t("cocktailForm.selectNamed", { name: option.displayLabel.trim() })
                        : t("cocktailForm.selectEmptyUnit")
                    }
                  >
                    <Text
                      style={[styles.unitLabel, { color: Colors.onSurface }]}
                    >
                      {option.displayLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={substituteUnitPickerTarget != null}
        transparent
        animationType="fade"
        onRequestClose={handleCloseSubstituteUnitPicker}
      >
        <Pressable
          style={[
            styles.unitModalOverlay,
            {
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
          onPress={handleCloseSubstituteUnitPicker}
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
              <Text style={[styles.unitModalTitle, { color: Colors.onSurface }]}>
                {t("cocktailForm.selectUnit")}
              </Text>
              <Pressable
                onPress={handleCloseSubstituteUnitPicker}
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
              style={styles.unitModalScroll}
              contentContainerStyle={styles.unitModalList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {sortedSubstituteUnitOptions.map((option) => {
                const isSelected = option.id === selectedSubstituteUnitOptionId;
                return (
                  <Pressable
                    key={`substitute-${option.id}`}
                    onPress={() => handleSelectSubstituteUnit(option.id)}
                    style={[
                      styles.unitOption,
                      {
                        borderColor: isSelected ? Colors.tint : Colors.outlineVariant,
                        backgroundColor: isSelected
                          ? Colors.highlightFaint
                          : Colors.surfaceBright,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={
                      option.displayLabel.trim()
                        ? t("cocktailForm.selectNamed", {
                          name: option.displayLabel.trim(),
                        })
                        : t("cocktailForm.selectEmptyUnit")
                    }
                  >
                    <Text style={[styles.unitLabel, { color: Colors.onSurface }]}>
                      {option.displayLabel}
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
          style={[
            styles.unitModalOverlay,
            {
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
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
                {t("cocktailForm.selectMethod")}
              </Text>
              <Pressable
                onPress={() => setIsMethodModalVisible(false)}
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
                accessibilityLabel={t("cocktailForm.clearMethods")}
              >
                <Text
                  style={[
                    styles.methodOptionLabel,
                    { color: Colors.onSurface },
                  ]}
                >
                  {t("cocktailForm.notSpecified")}
                </Text>
                <Text
                  style={[
                    styles.methodOptionDescription,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  {t("cocktailForm.clearMethodsDescription")}
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
                    accessibilityLabel={t("cocktailForm.selectNamed", { name: t(`cocktailMethod.${method.id}.label`) })}
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
                          {t(`cocktailMethod.${method.id}.label`)}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.methodOptionDescription,
                        { color: Colors.onSurfaceVariant },
                      ]}
                    >
                      {t(`cocktailMethod.${method.id}.description`)}
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
        title={t("cocktailForm.helpTitle")}
        message={t("cocktailForm.helpMessage")}
        actions={[{ label: t("common.gotIt"), variant: "secondary" }]}
        onRequestClose={() => setIsHelpVisible(false)}
      />

      <AppDialog
        visible={dialogOptions != null}
        title={dialogOptions?.title ?? ""}
        message={dialogOptions?.message}
        actions={dialogOptions?.actions ?? []}
        onRequestClose={closeDialog}
      />
      <ImageCropperModal
        visible={pendingCropUri != null}
        imageUri={pendingCropUri}
        onCancel={handleCancelCrop}
        onApply={handleApplyCrop}
      />

      <TagEditorModal
        visible={isTagModalVisible}
        title={t("cocktailForm.newTag")}
        confirmLabel={t("common.create")}
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
  onRequestSubstituteUnitPicker: (
    ingredientKey: string,
    substituteKey: string,
  ) => void;
  onRequestAddSubstitute: (key: string) => void;
  onRemoveSubstitute: (ingredientKey: string, substituteKey: string) => void;
  onChangeSubstitute: (
    ingredientKey: string,
    substituteKey: string,
    changes: Partial<Pick<EditableSubstitute, "amount" | "unitId">>,
  ) => void;
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
  onRequestSubstituteUnitPicker,
  onRequestAddSubstitute,
  onRemoveSubstitute,
  onChangeSubstitute,
  onRequestCreateIngredient,
  onInputFocus,
  onOpenDialog,
  index,
  totalCount,
}: EditableIngredientRowProps) {
  const { t, locale } = useI18n();
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [expandedSubstituteKeys, setExpandedSubstituteKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const hideSuggestionsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const isIceIngredient = ingredientRecord?.ingredientKind === 'ice';

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

      return t("cocktailForm.recipesCount", { count });
    },
    [cocktailsByBaseGroup, t],
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

  const handleSelectProcess = useCallback(() => {
    onChange(ingredient.key, { process: true, serving: false });
  }, [ingredient.key, onChange]);

  const handleSelectServing = useCallback(() => {
    onChange(ingredient.key, { process: false, serving: true });
  }, [ingredient.key, onChange]);

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
      return t("cocktailForm.noUnit");
    }

    const category = usePluralUnits ? getPluralCategory(locale, 2) : "one";
    let label = t(`unit.${ingredient.unitId}.${category}`);

    if (label === `unit.${ingredient.unitId}.${category}`) {
      label = t(`unit.${ingredient.unitId}.${usePluralUnits ? "plural" : "singular"}`);
    }

    if (label === `unit.${ingredient.unitId}.${usePluralUnits ? "plural" : "singular"}`) {
      const entry = COCKTAIL_UNIT_DICTIONARY[ingredient.unitId];
      label = usePluralUnits ? (entry?.plural ?? entry?.singular ?? "") : (entry?.singular ?? "");
    }

    return label || "";
  }, [ingredient.unitId, t, usePluralUnits, locale]);

  const getSubstituteUnitLabel = useCallback(
    (substitute: EditableSubstitute) => {
      if (substitute.unitId == null) {
        return "";
      }

      const usePluralSubstituteUnits = shouldUsePluralUnits(substitute.amount);
      const category = usePluralSubstituteUnits
        ? getPluralCategory(locale, 2)
        : "one";
      const form = usePluralSubstituteUnits ? "plural" : "singular";

      let label = t(`unit.${substitute.unitId}.${category}`);
      if (label === `unit.${substitute.unitId}.${category}`) {
        label = t(`unit.${substitute.unitId}.${form}`);
      }

      if (label === `unit.${substitute.unitId}.${form}`) {
        const entry = COCKTAIL_UNIT_DICTIONARY[substitute.unitId];
        label = usePluralSubstituteUnits
          ? (entry?.plural ?? entry?.singular ?? "")
          : (entry?.singular ?? "");
      }

      return label || "";
    },
    [locale, t],
  );

  const toggleSubstituteExpanded = useCallback((substituteKey: string) => {
    setExpandedSubstituteKeys((previous) => {
      const next = new Set(previous);
      if (next.has(substituteKey)) {
        next.delete(substituteKey);
      } else {
        next.add(substituteKey);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isIceIngredient) {
      return;
    }

    const changes: Partial<EditableIngredient> = {};

    if (ingredient.garnish) {
      changes.garnish = false;
    }

    if (ingredient.optional) {
      changes.optional = false;
    }

    if (ingredient.process && ingredient.serving) {
      changes.serving = false;
    } else if (!ingredient.process && !ingredient.serving) {
      changes.process = true;
      changes.serving = false;
    }

    if (Object.keys(changes).length > 0) {
      onChange(ingredient.key, changes);
    }
  }, [
    ingredient.garnish,
    ingredient.key,
    ingredient.optional,
    ingredient.process,
    ingredient.serving,
    isIceIngredient,
    onChange,
  ]);

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
          >{t("cocktailForm.ingredientIndex", { index: index + 1 })}</Text>
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
              accessibilityLabel={t("cocktailForm.moveIngredientUp")}
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
              accessibilityLabel={t("cocktailForm.moveIngredientDown")}
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
          accessibilityLabel={t("cocktailForm.removeIngredient")}
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
          placeholder={t("cocktailForm.ingredientName")}
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
            accessibilityLabel={t("cocktailForm.createNewIngredient")}
            hitSlop={8}
          >
            <Text
              style={[styles.ingredientNameCreateLabel, { color: Colors.tint }]}
            >
              {`+ ${t("common.create")}`}
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
              .map((tag) => tag?.color ?? tagColors.default);
            const subtitle = renderSubtitle(baseGroupId);
            const brandIndicatorColor =
              candidate.styleIngredientId != null
                ? Colors.secondary
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
                        accessibilityLabel={t("cocktailForm.onShoppingList")}
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
            {t("cocktailForm.amount")}
          </Text>
          <TextInput
            value={ingredient.amount}
            onChangeText={(text) => onChange(ingredient.key, { amount: text })}
            placeholder={t("cocktailForm.amountPlaceholder")}
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
            {t("cocktailForm.unit")}
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
            accessibilityLabel={t("cocktailForm.selectUnit")}
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
        {isIceIngredient ? (
          <>
            <OptionChip
              label={t("cocktailForm.process")}
              active={ingredient.process}
              onSelect={handleSelectProcess}
              onInfo={() =>
                onOpenDialog({
                  title: t("cocktailForm.process"),
                  message: t("cocktailForm.processMessage"),
                  actions: [{ label: t("common.ok") }],
                })
              }
            />
            <OptionChip
              label={t("cocktailForm.serving")}
              active={ingredient.serving}
              onSelect={handleSelectServing}
              onInfo={() =>
                onOpenDialog({
                  title: t("cocktailForm.serving"),
                  message: t("cocktailForm.servingMessage"),
                  actions: [{ label: t("common.ok") }],
                })
              }
            />
          </>
        ) : (
          <>
            <ToggleChip
              label={t("cocktailForm.garnish")}
              active={ingredient.garnish}
              onToggle={handleToggleGarnish}
            />
            <ToggleChip
              label={t("cocktailForm.optional")}
              active={ingredient.optional}
              onToggle={handleToggleOptional}
            />
          </>
        )}
      </View>

      {isBrandedIngredient ? (
        <View style={styles.toggleRow}>
          <ToggleChip
            label={t("cocktailForm.allowBaseSubstitute")}
            active={ingredient.allowBaseSubstitution}
            onToggle={handleToggleAllowBase}
            onInfo={() =>
              onOpenDialog({
                title: t("cocktailForm.allowBaseSubstitute"),
                message: t("cocktailForm.allowBaseSubstituteMessage"),
                actions: [{ label: t("common.ok") }],
              })
            }
          />
          <ToggleChip
            label={t("cocktailForm.allowBrandedSubstitute")}
            active={ingredient.allowBrandSubstitution}
            onToggle={handleToggleAllowBrand}
            onInfo={() =>
              onOpenDialog({
                title: t("cocktailForm.allowBrandedSubstitute"),
                message: t("cocktailForm.allowBrandedSubstituteMessage"),
                actions: [{ label: t("common.ok") }],
              })
            }
          />
        </View>
      ) : null}

      {shouldShowStyleSubstitution ? (
        <View style={styles.toggleRow}>
          <ToggleChip
            label={t("cocktailForm.allowStyleSubstitutes")}
            active={ingredient.allowStyleSubstitution}
            onToggle={handleToggleAllowStyle}
            onInfo={() =>
              onOpenDialog({
                title: t("cocktailForm.allowStyleSubstitutes"),
                message: t("cocktailForm.allowStyleSubstitutesMessage"),
                actions: [{ label: t("common.ok") }],
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
          accessibilityLabel={t("cocktailForm.addSubstitute")}
        >
          <MaterialCommunityIcons name="plus" size={16} color={Colors.tint} />
          <Text style={[styles.addSubstituteLabel, { color: Colors.tint }]}>
            {t("cocktailForm.addSubstitute")}
          </Text>
        </Pressable>
        {ingredient.substitutes.length ? (
          <View style={styles.substitutesList}>
            {ingredient.substitutes.map((substitute) => {
              const substituteUnitLabel = getSubstituteUnitLabel(substitute);
              const isSubstituteExpanded = expandedSubstituteKeys.has(substitute.key);

              return <View
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
                <View style={styles.substituteHeaderRow}>
                  <Text
                    style={[styles.substituteLabel, { color: Colors.onSurface }]}
                    numberOfLines={1}
                  >
                    {substitute.name}
                    {substitute.isBrand ? ` • ${t("cocktailForm.brand")}` : ""}
                  </Text>
                  <View style={styles.substituteActionsRow}>
                    <Pressable
                      onPress={() => toggleSubstituteExpanded(substitute.key)}
                      hitSlop={8}
                      accessibilityRole="button"
                    >
                      <MaterialCommunityIcons
                        name={isSubstituteExpanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={Colors.onSurfaceVariant}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        onRemoveSubstitute(ingredient.key, substitute.key)
                      }
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t("cocktailForm.removeNamed", {
                        name: substitute.name,
                      })}
                    >
                      <MaterialCommunityIcons
                        name="close"
                        size={16}
                        color={Colors.onSurfaceVariant}
                      />
                    </Pressable>
                  </View>
                </View>
                {isSubstituteExpanded ? (
                  <View style={styles.substituteMetaRow}>
                    <TextInput
                      value={substitute.amount}
                      onChangeText={(value) =>
                        onChangeSubstitute(ingredient.key, substitute.key, {
                          amount: value,
                        })
                      }
                      placeholder={t("cocktailForm.amount")}
                      keyboardType="decimal-pad"
                      style={[
                        styles.substituteMetaInput,
                        { color: Colors.onSurface, borderColor: Colors.outlineVariant },
                      ]}
                      placeholderTextColor={Colors.onSurfaceVariant}
                    />
                    <Pressable
                      onPress={() =>
                        onRequestSubstituteUnitPicker(ingredient.key, substitute.key)
                      }
                      style={[
                        styles.substituteMetaInput,
                        styles.substituteUnitSelector,
                        {
                          borderColor: Colors.outlineVariant,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={t("cocktailForm.selectUnit")}
                    >
                      <Text
                        style={[
                          styles.substituteUnitLabel,
                          {
                            color: substituteUnitLabel.trim()
                              ? Colors.onSurface
                              : Colors.onSurfaceVariant,
                          },
                        ]}
                      >
                        {substituteUnitLabel.trim() || t("cocktailForm.unit")}
                      </Text>
                      <MaterialIcons
                        name="expand-more"
                        size={18}
                        color={Colors.onSurfaceVariant}
                      />
                    </Pressable>
                  </View>
                ) : null}
              </View>;
            })}
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

type OptionChipProps = {
  label: string;
  active: boolean;
  onSelect: () => void;
  onInfo?: () => void;
};

function OptionChip({ label, active, onSelect, onInfo }: OptionChipProps) {
  const Colors = useAppColors();
  return (
    <View style={styles.toggleChipContainer}>
      <Pressable
        onPress={onSelect}
        style={[
          styles.toggleChip,
          {
            backgroundColor: active ? `${Colors.tint}1A` : "transparent",
          },
        ]}
        accessibilityRole="radio"
        accessibilityState={{ checked: active }}
      >
        <MaterialCommunityIcons
          name={active ? "check-circle" : "checkbox-blank-circle-outline"}
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
  photoPlaceholderHint: {
    textAlign: "center",
    paddingHorizontal: 12,
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
    fontSize: 16,
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
  servingsGrid: {
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
  },
  servingsCell: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  servingsCellLabel: {
    fontSize: 16,
    fontWeight: "400",
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
    minWidth: 175,
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
    minWidth: 160,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  substituteLabel: {
    fontSize: 14,
    fontWeight: "400",
    flex: 1,
  },
  substituteHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  substituteActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  substituteMetaRow: {
    flexDirection: "row",
    gap: 8,
  },
  substituteMetaInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 40,
  },
  substituteUnitSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  substituteUnitLabel: {
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
    paddingHorizontal: 24,
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
    paddingHorizontal: 24,
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
    fontSize: 16,
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
