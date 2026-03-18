import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  AppState,
  type LayoutChangeEvent,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextLayoutEvent,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { resolveGlasswareUriFromId } from "@/assets/image-manifest";
import { AppDialog } from "@/components/AppDialog";
import { AppImage } from "@/components/AppImage";
import { FormattedText } from "@/components/FormattedText";
import { HeaderIconButton } from "@/components/HeaderIconButton";
import { ListRow, PresenceCheck, Thumb } from "@/components/RowParts";
import { TagPill } from "@/components/TagPill";
import {
  getCocktailMethodById,
  METHOD_ICON_MAP,
  type CocktailMethodId,
} from "@/constants/cocktail-methods";
import { GLASSWARE_NAME_BY_ID, resolveGlasswareId } from "@/constants/glassware";
import { useAppColors } from "@/constants/theme";
import { resolveImageSource } from "@/libs/image-source";
import {
  createIngredientLookup,
  resolveIngredientAvailability,
  type IngredientLookup,
  type IngredientResolution,
} from "@/libs/ingredient-availability";
import { getPluralCategory } from "@/libs/i18n/plural";
import { useI18n } from "@/libs/i18n/use-i18n";
import {
  buildReturnToParams,
  navigateToDetailsWithReturnTo,
  parseReturnToParams,
  returnToSourceOrBack,
  skipDuplicateBack,
} from "@/libs/navigation";
import { normalizeSearchText } from "@/libs/search-normalization";
import { useInventory, type Cocktail } from "@/providers/inventory-provider";
import { tagColors } from "@/theme/theme";

type RecipeIngredient = NonNullable<Cocktail["ingredients"]>[number];
type CocktailTag = NonNullable<Cocktail["tags"]>[number];

const METRIC_UNIT_ID = 11;
const IMPERIAL_UNIT_ID = 12;
const PARTS_UNIT_ID = 13;
const GRAM_UNIT_ID = 8;
const CENTILITER_UNIT_ID = 3;
const UNIT_CONVERSION_RATIO = 30;
type IngredientDisplayMode = "metric" | "imperial" | "parts";

const MAX_RATING = 5;
const MIN_SERVINGS = 0.5;
const SERVINGS_STEP = 0.5;

type VideoService = "youtube" | "instagram" | "tiktok" | "generic";

function resolveVideoService(link?: string | null): VideoService | null {
  const value = link?.trim();
  if (!value) {
    return null;
  }

  try {
    const withProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(value) ? value : `https://${value}`;
    const { hostname } = new URL(withProtocol);
    const domain = hostname.toLowerCase().replace(/^www\./, "");

    if (domain.includes("youtu.be") || domain.includes("youtube.com")) {
      return "youtube";
    }
    if (domain.includes("instagram.com")) {
      return "instagram";
    }
    if (domain.includes("tiktok.com")) {
      return "tiktok";
    }
    return "generic";
  } catch {
    return "generic";
  }
}

function resolveVideoServiceIcon(service: VideoService): "youtube" | "instagram" | "music-note" | "video-outline" {
  switch (service) {
    case "youtube":
      return "youtube";
    case "instagram":
      return "instagram";
    case "tiktok":
      return "music-note";
    default:
      return "video-outline";
  }
}

function resolveProcessBatchMultiplier(servings: number): number {
  const normalizedServings = Math.max(1, Math.ceil(servings));

  if (normalizedServings === 1) {
    return 1;
  }

  const fullCycles = Math.floor((normalizedServings - 1) / 4);
  const cycleOffset = (normalizedServings - 1) % 4;
  const cycleBase = 1 + fullCycles * 3;

  if (cycleOffset <= 1) {
    return cycleBase + 0.5 * cycleOffset;
  }

  return cycleBase + 1 + (cycleOffset - 2);
}

function roundUpToMultiple(value: number, multiple: number): number {
  if (multiple <= 0) {
    return value;
  }

  return Math.ceil(value / multiple) * multiple;
}

function resolveProcessedAmountWithUnitRounding(
  amount: number,
  unitId: number | undefined,
): number {
  if (unitId === GRAM_UNIT_ID || unitId === METRIC_UNIT_ID) {
    return roundUpToMultiple(amount, 30);
  }

  if (unitId === CENTILITER_UNIT_ID) {
    return roundUpToMultiple(amount, 3);
  }

  if (unitId === IMPERIAL_UNIT_ID) {
    return Math.ceil(amount);
  }

  return amount;
}

function resolveScaledIngredient(
  ingredient: RecipeIngredient,
  servings: number,
  defaultServings: number,
): RecipeIngredient {
  const amountRaw = ingredient.amount?.trim();
  if (!amountRaw) {
    return ingredient;
  }

  const parsedAmount = Number(amountRaw);
  if (Number.isNaN(parsedAmount)) {
    return ingredient;
  }

  const hasGarnish = (ingredient as { garnish?: boolean | null }).garnish;
  const scaledServings = hasGarnish
    ? Math.max(1, Math.floor(servings))
    : servings;
  const scaledDefaultServings = hasGarnish
    ? Math.max(1, Math.floor(defaultServings))
    : defaultServings;

  const hasProcess = (ingredient as { process?: boolean | null }).process;
  const scaleFactor = hasProcess
    ? resolveProcessBatchMultiplier(scaledServings) /
      resolveProcessBatchMultiplier(scaledDefaultServings)
    : scaledServings / scaledDefaultServings;

  const scaledAmount = parsedAmount * scaleFactor;
  const roundedScaledAmount = hasProcess
    ? resolveProcessedAmountWithUnitRounding(scaledAmount, ingredient.unitId)
    : scaledAmount;

  return {
    ...ingredient,
    amount: formatAmount(roundedScaledAmount),
  };
}

function resolveCocktail(
  param: string | undefined,
  cocktails: Cocktail[],
): Cocktail | undefined {
  if (!param) {
    return undefined;
  }

  const numericId = Number(param);
  if (!Number.isNaN(numericId)) {
    const byId = cocktails.find((item) => Number(item.id ?? -1) === numericId);
    if (byId) {
      return byId;
    }
  }

  const normalized = normalizeSearchText(param);
  return cocktails.find(
    (item) => normalizeSearchText(item.name ?? "") === normalized,
  );
}

function formatAmount(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }

  return Number(rounded.toFixed(2)).toString();
}

const IMPERIAL_FRACTIONS: { decimal: number; glyph: string }[] = [
  { decimal: 0.1, glyph: "⅒" },
  { decimal: 0.111, glyph: "⅑" },
  { decimal: 0.125, glyph: "⅛" },
  { decimal: 0.143, glyph: "⅐" },
  { decimal: 0.167, glyph: "⅙" },
  { decimal: 0.2, glyph: "⅕" },
  { decimal: 0.25, glyph: "¼" },
  { decimal: 0.333, glyph: "⅓" },
  { decimal: 0.375, glyph: "⅜" },
  { decimal: 0.4, glyph: "⅖" },
  { decimal: 0.5, glyph: "½" },
  { decimal: 0.6, glyph: "⅗" },
  { decimal: 0.625, glyph: "⅝" },
  { decimal: 0.667, glyph: "⅔" },
  { decimal: 0.75, glyph: "¾" },
  { decimal: 0.8, glyph: "⅘" },
  { decimal: 0.833, glyph: "⅚" },
  { decimal: 0.875, glyph: "⅞" },
];

function formatOunceAmount(value: number): string {
  const normalized = Math.round(value * 100) / 100;
  const wholeNumberPortion = Math.trunc(normalized);
  const fractionalPortion = Math.abs(normalized - wholeNumberPortion);

  const matchedFraction = IMPERIAL_FRACTIONS.reduce<
    | { fraction: (typeof IMPERIAL_FRACTIONS)[number]; difference: number }
    | undefined
  >((closest, fraction) => {
    const difference = Math.abs(fractionalPortion - fraction.decimal);

    if (difference >= 0.02) {
      return closest;
    }

    if (!closest || difference < closest.difference) {
      return { fraction, difference };
    }

    return closest;
  }, undefined)?.fraction;

  if (!matchedFraction) {
    return formatAmount(normalized);
  }

  if (wholeNumberPortion === 0) {
    return matchedFraction.glyph;
  }

  return `${wholeNumberPortion}${matchedFraction.glyph}`;
}

function convertIngredientAmount(
  amount: number,
  unitId: number | undefined,
  useImperialUnits: boolean,
): { value: number; unitId?: number } {
  if (unitId == null) {
    return { value: amount, unitId };
  }

  if (
    useImperialUnits &&
    (unitId === METRIC_UNIT_ID || unitId === GRAM_UNIT_ID)
  ) {
    return { value: amount / UNIT_CONVERSION_RATIO, unitId: IMPERIAL_UNIT_ID };
  }

  if (!useImperialUnits && unitId === IMPERIAL_UNIT_ID) {
    return { value: amount * UNIT_CONVERSION_RATIO, unitId: METRIC_UNIT_ID };
  }

  return { value: amount, unitId };
}

function resolveAmountForParts(
  ingredient: RecipeIngredient,
): number | undefined {
  const amount = ingredient.amount?.trim();
  if (!amount) {
    return undefined;
  }

  const parsedAmount = Number(amount);
  if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    return undefined;
  }

  const unitId =
    typeof ingredient.unitId === "number" ? ingredient.unitId : undefined;
  if (unitId === IMPERIAL_UNIT_ID) {
    return parsedAmount * UNIT_CONVERSION_RATIO;
  }

  if (unitId == null || unitId === METRIC_UNIT_ID || unitId === GRAM_UNIT_ID) {
    return parsedAmount;
  }

  return undefined;
}

function formatIngredientQuantity(
  ingredient: RecipeIngredient,
  displayMode: IngredientDisplayMode,
  smallestPartAmount: number | undefined,
  asNeededLabel: string,
  t: (key: string, params?: Record<string, string | number>) => string,
  locale: string,
): string {
  const amountRaw = ingredient.amount ?? "";
  const amount = amountRaw.trim();
  const hasAmount = amount.length > 0;
  const unitId =
    typeof ingredient.unitId === "number" ? ingredient.unitId : undefined;
  const parsedAmount = Number(amount);
  const isNumeric = hasAmount && !Number.isNaN(parsedAmount);

  let displayAmount = amount;
  let displayUnitId = unitId;
  let numericAmount: number | undefined;

  if (isNumeric) {
    if (displayMode === "parts") {
      const partsAmountRaw = resolveAmountForParts(ingredient);
      const partsAmount =
        partsAmountRaw != null && smallestPartAmount != null
          ? partsAmountRaw / smallestPartAmount
          : undefined;

      if (partsAmount != null && Number.isFinite(partsAmount)) {
        numericAmount = partsAmount;
        displayAmount = formatAmount(partsAmount);
        displayUnitId = PARTS_UNIT_ID;
      } else {
        numericAmount = parsedAmount;
      }
    } else {
      const { value, unitId: nextUnitId } = convertIngredientAmount(
        parsedAmount,
        unitId,
        displayMode === "imperial",
      );
      numericAmount = value;
      displayUnitId = nextUnitId;

      if (displayMode === "imperial" && displayUnitId === IMPERIAL_UNIT_ID) {
        displayAmount = formatOunceAmount(value);
      } else {
        displayAmount = formatAmount(value);
      }
    }
  }

  let unitText = "";
  if (displayUnitId != null) {
    const category = getPluralCategory(locale, numericAmount ?? 1);
    unitText = t(`unit.${displayUnitId}.${category}`);

    if (unitText === `unit.${displayUnitId}.${category}`) {
      // Fallback to singular/plural keys if category key is missing
      const isSingular = numericAmount == null || numericAmount === 1;
      unitText = t(`unit.${displayUnitId}.${isSingular ? "singular" : "plural"}`);
    }
  }

  if (!displayAmount && (!unitText || !unitText.trim())) {
    return asNeededLabel;
  }

  if (!displayAmount && unitText) {
    return unitText.trim();
  }

  if (unitText && unitText.trim()) {
    return `${displayAmount} ${unitText.trim()}`;
  }

  return displayAmount;
}

function getIngredientQualifier(
  ingredient: RecipeIngredient,
  garnishLabel: string,
  optionalLabel: string,
  processLabel: string,
  servingLabel: string,
): string | undefined {
  const qualifiers: string[] = [];

  if ((ingredient as { garnish?: boolean | null }).garnish) {
    qualifiers.push(garnishLabel);
  }

  if ((ingredient as { optional?: boolean | null }).optional) {
    qualifiers.push(optionalLabel);
  }

  if ((ingredient as { process?: boolean | null }).process) {
    qualifiers.push(processLabel);
  }

  if ((ingredient as { serving?: boolean | null }).serving) {
    qualifiers.push(servingLabel);
  }

  return qualifiers.join(", ") || undefined;
}

function buildMissingSubstituteLines(
  ingredient: RecipeIngredient,
  resolution: IngredientResolution,
  lookup: IngredientLookup,
  t: (key: string, params?: Record<string, string | number>) => string,
): string[] {
  if (resolution.isAvailable) {
    return [];
  }

  const ingredientId =
    typeof ingredient.ingredientId === "number"
      ? ingredient.ingredientId
      : undefined;
  const requestedIngredient =
    ingredientId != null ? lookup.ingredientById.get(ingredientId) : undefined;
  const isBrandedIngredient = requestedIngredient?.baseIngredientId != null;
  const isStyledIngredient = requestedIngredient?.styleIngredientId != null;

  const orderedSubstitutes = [
    ...resolution.substitutes.declared.map((option) => ({
      option,
      source: "declared" as const,
    })),
    ...(isBrandedIngredient
      ? resolution.substitutes.base.map((option) => ({
        option,
        source: "base" as const,
      }))
      : []),
    ...(!isBrandedIngredient && !isStyledIngredient
      ? resolution.substitutes.branded.map((option) => ({
        option,
        source: "branded" as const,
      }))
      : []),
    ...(!isBrandedIngredient
      ? resolution.substitutes.styled.map((option) => ({
        option,
        source: "styled" as const,
      }))
      : []),
  ];

  const seen = new Set<string>();
  const lines: string[] = [];

  orderedSubstitutes.forEach(({ option, source }) => {
    const name = option.name.trim();
    if (!name) {
      return;
    }

    const key =
      option.id != null ? `id:${option.id}` : `name:${name.toLowerCase()}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    const line =
      source === "base" && isBrandedIngredient
        ? t("cocktailDetails.orAny", { name })
        : t("cocktailDetails.or", { name });
    lines.push(line);
  });

  return lines;
}

export default function CocktailDetailsScreen() {
  const params = useLocalSearchParams<{
    cocktailId?: string;
    returnToPath?: string;
    returnToParams?: string;
  }>();
  const navigation = useNavigation();
  const { t, locale } = useI18n();
  const Colors = useAppColors();
  const { cocktailId } = params;
  const {
    cocktails,
    ingredients,
    loading,
    availableIngredientIds,
    shoppingIngredientIds,
    partySelectedCocktailKeys,
    togglePartyCocktailSelection,
    toggleIngredientShopping,
    setCocktailRating,
    setCocktailComment,
    getCocktailRating,
    getCocktailComment,
    ignoreGarnish,
    allowAllSubstitutes,
    useImperialUnits,
    keepScreenAwake,
  } = useInventory();

  const resolvedParam = Array.isArray(cocktailId) ? cocktailId[0] : cocktailId;
  const cocktail = useMemo(
    () => resolveCocktail(resolvedParam, cocktails),
    [cocktails, resolvedParam],
  );

  const cocktailSelectionKey = useMemo(() => {
    if (!cocktail) {
      return '';
    }

    return String(cocktail.id ?? cocktail.name ?? '');
  }, [cocktail]);

  const isPartySelected = useMemo(() => {
    if (!cocktailSelectionKey) {
      return false;
    }

    return partySelectedCocktailKeys.has(cocktailSelectionKey);
  }, [cocktailSelectionKey, partySelectedCocktailKeys]);

  const cocktailIngredientIds = useMemo(() => {
    if (!cocktail) {
      return [] as number[];
    }

    const ids = new Set<number>();
    (cocktail.ingredients ?? []).forEach((ingredient) => {
      const parsedId = Number(ingredient.ingredientId);
      if (Number.isFinite(parsedId) && parsedId >= 0) {
        ids.add(Math.trunc(parsedId));
      }
    });

    return [...ids];
  }, [cocktail]);

  const areAllCocktailIngredientsOnShoppingList = useMemo(() => {
    if (cocktailIngredientIds.length === 0) {
      return false;
    }

    return cocktailIngredientIds.every((id) => shoppingIngredientIds.has(id));
  }, [cocktailIngredientIds, shoppingIngredientIds]);

  const handlePartySelectionToggle = useCallback(() => {
    if (!cocktailSelectionKey) {
      return;
    }

    togglePartyCocktailSelection(cocktailSelectionKey);
  }, [cocktailSelectionKey, togglePartyCocktailSelection]);

  const handleAddCocktailIngredientsToShopping = useCallback(() => {
    cocktailIngredientIds.forEach((ingredientId) => {
      if (!shoppingIngredientIds.has(ingredientId)) {
        toggleIngredientShopping(ingredientId);
      }
    });
  }, [cocktailIngredientIds, shoppingIngredientIds, toggleIngredientShopping]);

  const returnToPath = useMemo(() => {
    const value = Array.isArray(params.returnToPath)
      ? params.returnToPath[0]
      : params.returnToPath;
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }, [params.returnToPath]);

  const returnToParams = useMemo(() => {
    return parseReturnToParams(params.returnToParams);
  }, [params.returnToParams]);

  const [ingredientDisplayMode, setIngredientDisplayMode] =
    useState<IngredientDisplayMode>(useImperialUnits ? "imperial" : "metric");
  const isHandlingBackRef = useRef(false);
  const persistCommentDraftRef = useRef<() => void>(() => {});
  const shouldNavigateAway = !loading && !cocktail;

  useEffect(() => {
    setIngredientDisplayMode((current) =>
      current === "parts" ? current : useImperialUnits ? "imperial" : "metric",
    );
  }, [useImperialUnits]);

  const handleReturn = useCallback(() => {
    persistCommentDraftRef.current();

    if (returnToPath === "/cocktails" && !returnToParams) {
      skipDuplicateBack(navigation);
      return;
    }

    returnToSourceOrBack(navigation, { returnToPath, returnToParams });
  }, [navigation, returnToParams, returnToPath]);

  useEffect(() => {
    if (!shouldNavigateAway || isHandlingBackRef.current) {
      return;
    }

    isHandlingBackRef.current = true;
    handleReturn();

    requestAnimationFrame(() => {
      isHandlingBackRef.current = false;
    });
  }, [handleReturn, shouldNavigateAway]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (isHandlingBackRef.current) {
        return;
      }

      if (event.data.action.type !== "GO_BACK") {
        return;
      }

      event.preventDefault();
      persistCommentDraftRef.current();

      isHandlingBackRef.current = true;
      handleReturn();

      requestAnimationFrame(() => {
        isHandlingBackRef.current = false;
      });
    });

    return unsubscribe;
  }, [handleReturn, navigation]);

  useEffect(() => {
    const keepAwakeTag = "cocktail-details";

    if (keepScreenAwake) {
      void activateKeepAwakeAsync(keepAwakeTag);

      return () => {
        void deactivateKeepAwake(keepAwakeTag);
      };
    }

    void deactivateKeepAwake(keepAwakeTag);

    return undefined;
  }, [keepScreenAwake]);

  const ingredientLookup: IngredientLookup = useMemo(
    () => createIngredientLookup(ingredients),
    [ingredients],
  );

  const sortedIngredients = useMemo(() => {
    const recipe = cocktail?.ingredients ?? [];
    return [...recipe].sort((a, b) => a.order - b.order);
  }, [cocktail?.ingredients]);

  const normalizedDefaultServings = useMemo(() => {
    const parsedDefault = Number(cocktail?.defaultServings ?? 1);
    if (!Number.isFinite(parsedDefault) || parsedDefault <= 0) {
      return 1;
    }

    return Math.round(parsedDefault / SERVINGS_STEP) * SERVINGS_STEP;
  }, [cocktail?.defaultServings]);

  const [servings, setServings] = useState<number>(normalizedDefaultServings);

  useEffect(() => {
    setServings(normalizedDefaultServings);
  }, [normalizedDefaultServings]);

  const scaledIngredients = useMemo(
    () =>
      sortedIngredients.map((ingredient) =>
        resolveScaledIngredient(ingredient, servings, normalizedDefaultServings),
      ),
    [normalizedDefaultServings, servings, sortedIngredients],
  );

  const resolvedIngredients = useMemo(
    () =>
      sortedIngredients.map((ingredient) =>
        resolveIngredientAvailability(
          ingredient,
          availableIngredientIds,
          ingredientLookup,
          {
            ignoreGarnish,
            allowAllSubstitutes,
          },
        ),
      ),
    [
      allowAllSubstitutes,
      availableIngredientIds,
      ignoreGarnish,
      ingredientLookup,
      sortedIngredients,
    ],
  );

  const parseIngredientId = useCallback((ingredient: RecipeIngredient) => {
    const ingredientIdRaw = ingredient.ingredientId;
    if (typeof ingredientIdRaw === "number") {
      return ingredientIdRaw;
    }

    if (typeof ingredientIdRaw === "string") {
      const parsed = Number(ingredientIdRaw);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    return -1;
  }, []);

  const userRating = useMemo(() => {
    if (!cocktail) {
      return 0;
    }

    return getCocktailRating(cocktail);
  }, [cocktail, getCocktailRating]);

  const [optimisticRating, setOptimisticRating] = useState<number | null>(null);
  const [, startRatingTransition] = useTransition();
  const displayedRating = optimisticRating ?? userRating;

  const userComment = useMemo(() => {
    if (!cocktail) {
      return "";
    }

    return getCocktailComment(cocktail);
  }, [cocktail, getCocktailComment]);

  const [isCommentFieldVisible, setIsCommentFieldVisible] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const hasComment = commentDraft.trim().length > 0 || userComment.trim().length > 0;

  useEffect(() => {
    setOptimisticRating((previous) => {
      if (previous == null) {
        return previous;
      }

      return previous === userRating ? null : previous;
    });
  }, [userRating]);

  useEffect(() => {
    setCommentDraft(userComment);
    setIsCommentFieldVisible((current) => current || userComment.length > 0);
  }, [userComment]);

  const persistCommentDraft = useCallback(() => {
    if (!cocktail) {
      return;
    }

    const trimmedDraft = commentDraft.trim();
    if (trimmedDraft === userComment) {
      return;
    }

    setCocktailComment(cocktail, trimmedDraft);
  }, [cocktail, commentDraft, setCocktailComment, userComment]);

  useEffect(() => {
    persistCommentDraftRef.current = persistCommentDraft;
  }, [persistCommentDraft]);

  useEffect(() => {
    return () => {
      persistCommentDraftRef.current();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        persistCommentDraftRef.current();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleToggleCommentField = useCallback(() => {
    setIsCommentFieldVisible((current) => {
      if (current) {
        persistCommentDraftRef.current();
      }

      return !current;
    });
  }, []);

  const handleRatingSelect = useCallback(
    (value: number) => {
      if (!cocktail) {
        return;
      }

      const nextRating = displayedRating === value ? 0 : value;
      setOptimisticRating(nextRating);

      startRatingTransition(() => {
        setCocktailRating(cocktail, nextRating);
      });
    },
    [cocktail, displayedRating, setCocktailRating, startRatingTransition],
  );

  const instructionsParagraphs = useMemo(() => {
    const instructions = cocktail?.instructions?.trim();
    if (!instructions) {
      return [] as string[];
    }

    return instructions
      .split(/\n+/)
      .map((segment) => segment.trim())
      .filter(Boolean);
  }, [cocktail?.instructions]);

  const videoInstructionUrl = cocktail?.video?.trim() || "";
  const videoService = useMemo(() => resolveVideoService(videoInstructionUrl), [videoInstructionUrl]);

  const handleOpenVideoInstructions = useCallback(async () => {
    if (!videoInstructionUrl) {
      return;
    }

    const url = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(videoInstructionUrl)
      ? videoInstructionUrl
      : `https://${videoInstructionUrl}`;

    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    }
  }, [videoInstructionUrl]);

  const descriptionParagraphs = useMemo(() => {
    const description = cocktail?.description?.trim();
    if (!description) {
      return [] as string[];
    }

    return description
      .split(/\n+/)
      .map((segment) => segment.trim())
      .filter(Boolean);
  }, [cocktail?.description]);

  const DESCRIPTION_PREVIEW_LINES = 5;
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [shouldTruncateDescription, setShouldTruncateDescription] =
    useState(false);

  const handleDescriptionLayout = useCallback(
    (event: TextLayoutEvent) => {
      if (shouldTruncateDescription) {
        return;
      }

      const totalLines = event.nativeEvent?.lines?.length ?? 0;
      if (totalLines > DESCRIPTION_PREVIEW_LINES) {
        setShouldTruncateDescription(true);
      }
    },
    [DESCRIPTION_PREVIEW_LINES, shouldTruncateDescription],
  );

  const toggleDescription = useCallback(() => {
    setIsDescriptionExpanded((current) => !current);
  }, []);

  useEffect(() => {
    setIsDescriptionExpanded(false);
    setShouldTruncateDescription(descriptionParagraphs.length > 1);
  }, [descriptionParagraphs.length]);

  const ingredientHighlightColor = Colors.highlightFaint;

  const photoSource = useMemo(
    () => resolveImageSource(cocktail?.photoUri),
    [cocktail?.photoUri],
  );

  const glassUri = useMemo(
    () => resolveGlasswareUriFromId(cocktail?.glassId),
    [cocktail?.glassId],
  );

  const glassSource = useMemo(() => resolveImageSource(glassUri), [glassUri]);

  const displayedImageSource = photoSource ?? glassSource;
  const glassLabel = useMemo(() => {
    const resolvedGlassId = resolveGlasswareId(cocktail?.glassId);
    if (!resolvedGlassId) {
      return undefined;
    }
    const translationKey = `glassware.${resolvedGlassId}`;
    const translated = t(translationKey);
    if (translated !== translationKey) {
      return translated;
    }

    return GLASSWARE_NAME_BY_ID[resolvedGlassId];
  }, [cocktail?.glassId, t]);

  const methodDetails = useMemo((): { id: CocktailMethodId }[] => {
    if (!cocktail) {
      return [];
    }

    const legacyMethodId =
      (cocktail as { methodId?: string | null }).methodId ?? null;
    const nextMethodIds =
      cocktail.methodIds && cocktail.methodIds.length > 0
        ? cocktail.methodIds
        : legacyMethodId
          ? [legacyMethodId]
          : [];
    return nextMethodIds.flatMap((id) => {
      const method = getCocktailMethodById(id);
      return method ? [method] : [];
    });
  }, [cocktail]);

  const [expandedMethodIds, setExpandedMethodIds] = useState<string[]>([]);
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [nameLayout, setNameLayout] = useState<{ y: number; height: number } | null>(null);
  const [isNameInHeader, setIsNameInHeader] = useState(false);

  const smallestPartAmount = useMemo(() => {
    const convertibleAmounts = scaledIngredients
      .map((ingredient) => resolveAmountForParts(ingredient))
      .filter((amount): amount is number => amount != null && amount > 0);

    if (!convertibleAmounts.length) {
      return undefined;
    }

    return Math.min(...convertibleAmounts);
  }, [scaledIngredients]);

  const canDecreaseServings = servings > MIN_SERVINGS;
  const handleDecreaseServings = useCallback(() => {
    setServings((current) =>
      Math.max(MIN_SERVINGS, Math.round((current - SERVINGS_STEP) * 2) / 2),
    );
  }, []);
  const handleIncreaseServings = useCallback(() => {
    setServings((current) => Math.round((current + SERVINGS_STEP) * 2) / 2);
  }, []);

  const handleSelectDisplayMode = useCallback((mode: IngredientDisplayMode) => {
    setIngredientDisplayMode(mode);
  }, []);

  const toggleMethodDescription = useCallback((methodId: string) => {
    setExpandedMethodIds((current) =>
      current.includes(methodId)
        ? current.filter((id) => id !== methodId)
        : [...current, methodId],
    );
  }, []);

  const handleEditPress = useCallback(() => {
    if (!cocktail) {
      return;
    }

    const targetId = cocktail.id ?? cocktail.name;
    if (!targetId) {
      return;
    }

    router.push({
      pathname: "/cocktails/create",
      params: {
        cocktailId: String(targetId),
        cocktailName: cocktail.name ?? undefined,
        mode: "edit",
        source: "cocktails",
        ...buildReturnToParams(returnToPath, returnToParams),
      },
    });
  }, [cocktail, returnToParams, returnToPath]);

  const handleCopyPress = useCallback(() => {
    if (!cocktail) {
      return;
    }

    const targetId = cocktail.id ?? cocktail.name;
    if (!targetId) {
      return;
    }

    router.push({
      pathname: "/cocktails/create",
      params: {
        cocktailId: String(targetId),
        cocktailName: cocktail.name ?? undefined,
        source: "cocktails",
        ...buildReturnToParams(returnToPath, returnToParams),
      },
    });
  }, [cocktail, returnToParams, returnToPath]);

  const handleNameLayout = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setNameLayout({ y, height });
  }, []);

  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      if (!nameLayout) {
        return;
      }

      const nameBottom = nameLayout.y + nameLayout.height;
      const shouldShowNameInHeader = event.nativeEvent.contentOffset.y > nameBottom;

      setIsNameInHeader((current) =>
        current === shouldShowNameInHeader ? current : shouldShowNameInHeader,
      );
    },
    [nameLayout],
  );

  if (shouldNavigateAway) {
    return null;
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors.background }]}
      edges={["left", "right"]}
    >
      <Stack.Screen
        options={{
          title:
            isNameInHeader && cocktail?.name
              ? cocktail.name
              : t("cocktailDetails.title"),
          headerTitleAlign: "center",
          headerStyle: { backgroundColor: Colors.surface },
          headerTitleStyle: {
            color: Colors.onSurface,
            fontSize: 17,
            fontWeight: "600",
          },
          headerShadowVisible: false,
          headerLeft: () => (
            <HeaderIconButton
              onPress={handleReturn}
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

      <ScrollView
        contentContainerStyle={styles.content}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {cocktail ? (
          <View style={styles.section}>
            <Text
              style={[styles.name, { color: Colors.onSurface }]}
              onLayout={handleNameLayout}
            >
              {cocktail.name}
            </Text>

            <View style={styles.mediaSection}>
              <View style={styles.photoWrapper}>
                {displayedImageSource ? (
                  <AppImage
                    source={displayedImageSource}
                    style={[styles.photo, { backgroundColor: Colors.surfaceBright }]}
                    contentFit="contain"
                  />
                ) : (
                  <View
                    style={[
                      styles.photoPlaceholder,
                      { borderColor: Colors.outline, backgroundColor: Colors.surfaceBright },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="image-off"
                      size={36}
                      color={Colors.onSurfaceVariant}
                    />
                    <Text
                      style={[
                        styles.photoPlaceholderText,
                        { color: Colors.onSurfaceVariant },
                      ]}
                    >
                      {t("cocktailDetails.noPhoto")}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.ratingRow}>
                <View style={styles.ratingStarsRow}>
                  {Array.from({ length: MAX_RATING }).map((_, index) => {
                    const starValue = index + 1;
                    const isActive = displayedRating >= starValue;
                    const icon = isActive ? "star" : "star-outline";

                    return (
                      <Pressable
                        key={`rating-star-${starValue}`}
                        onPress={() => handleRatingSelect(starValue)}
                        accessibilityRole="button"
                        accessibilityLabel={
                          displayedRating === starValue
                            ? t("cocktailDetails.clearRating")
                            : t("cocktailDetails.setRatingTo", { value: starValue })
                        }
                        style={styles.ratingStar}
                        hitSlop={8}
                      >
                        <MaterialCommunityIcons
                          name={icon}
                          size={32}
                          color={Colors.tint}
                        />
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.partyControlsColumn}>
                  <PresenceCheck checked={isPartySelected} onToggle={handlePartySelectionToggle} />
                  <Pressable
                    onPress={handleAddCocktailIngredientsToShopping}
                    accessibilityRole="button"
                    accessibilityLabel={t('cocktailDetails.addCocktailIngredientsToShopping')}
                    style={styles.partyShoppingButton}
                    hitSlop={8}>
                    <MaterialIcons
                      name={areAllCocktailIngredientsOnShoppingList ? 'shopping-cart' : 'add-shopping-cart'}
                      size={22}
                      color={Colors.tint}
                    />
                  </Pressable>
                </View>
              </View>

              {photoSource && glassSource && glassLabel ? (
                <View style={styles.glassInfo}>
                  <View style={styles.glassInfoLeft}>
                    <View style={styles.glassImageWrapper}>
                      <AppImage
                        source={glassSource}
                        style={styles.glassImage}
                        contentFit="contain"
                      />
                    </View>
                    <Text
                      style={[styles.glassLabel, { color: Colors.onSurface }]}
                    >
                      {glassLabel}
                    </Text>
                  </View>

                  {videoService ? (
                    <Pressable
                      onPress={handleOpenVideoInstructions}
                      accessibilityRole="button"
                      accessibilityLabel={t("cocktailDetails.openVideoInstructions")}
                      style={styles.videoInstructionButton}
                      hitSlop={8}
                    >
                      <MaterialCommunityIcons
                        name={resolveVideoServiceIcon(videoService)}
                        size={28}
                        color={Colors.tint}
                      />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

            </View>

            <View style={styles.methodsAndCommentRow}>
              {methodDetails.length ? (
                <View style={styles.methodList}>
                  {methodDetails.map((method) => {
                    const icon = METHOD_ICON_MAP[method.id];
                    const isExpanded = expandedMethodIds.includes(method.id);
                    return (
                      <View key={method.id} style={styles.methodEntry}>
                        <View style={styles.methodHeader}>
                          <View style={styles.methodIconWrapper}>
                            {icon?.type === "asset" ? (
                              <Image
                                source={icon.source}
                                style={[
                                  styles.methodIcon,
                                  { tintColor: Colors.onSurfaceVariant },
                                ]}
                                contentFit="contain"
                              />
                            ) : (
                              <MaterialCommunityIcons
                                name={
                                  icon?.type === "icon"
                                    ? icon.name
                                    : "information-outline"
                                }
                                size={18}
                                color={Colors.onSurfaceVariant}
                                style={method.id === "muddle" ? styles.muddleIcon : undefined}
                              />
                            )}
                          </View>
                          <Text
                            style={[
                              styles.methodLabel,
                              { color: Colors.onSurface },
                            ]}
                          >
                            {t(`cocktailMethod.${method.id}.label`)}
                          </Text>
                          <Pressable
                            onPress={() => toggleMethodDescription(method.id)}
                            accessibilityRole="button"
                            accessibilityLabel={
                              isExpanded
                                ? t("cocktailDetails.hideMethodDescription", {
                                  method: t(`cocktailMethod.${method.id}.label`),
                                })
                                : t("cocktailDetails.showMethodDescription", {
                                  method: t(`cocktailMethod.${method.id}.label`),
                                })
                            }
                            hitSlop={8}
                          >
                            <MaterialCommunityIcons
                              name="information-outline"
                              size={16}
                              color={Colors.primary}
                            />
                          </Pressable>
                        </View>
                        {isExpanded ? (
                          <Text
                            style={[
                              styles.methodDescription,
                              { color: Colors.onSurfaceVariant },
                            ]}
                          >
                            {t(`cocktailMethod.${method.id}.description`)}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.methodListFiller} />
              )}

              <Pressable
                onPress={handleToggleCommentField}
                accessibilityRole="button"
                accessibilityLabel={t("cocktailDetails.toggleComment")}
                style={styles.commentToggleButton}
                hitSlop={8}
              >
                <MaterialCommunityIcons
                  name={isCommentFieldVisible ? "comment-edit" : hasComment ? "comment" : "comment-plus-outline"}
                  size={28}
                  color={Colors.tint}
                />
              </Pressable>
            </View>

            {isCommentFieldVisible ? (
              <TextInput
                value={commentDraft}
                onChangeText={setCommentDraft}
                onBlur={persistCommentDraft}
                placeholder={t("cocktailDetails.commentPlaceholder")}
                placeholderTextColor={Colors.onSurfaceVariant}
                multiline
                textAlignVertical="top"
                style={[
                  styles.commentInput,
                  {
                    color: Colors.text,
                    borderColor: Colors.outlineVariant,
                    backgroundColor: Colors.background,
                  },
                ]}
              />
            ) : null}

            {cocktail.tags && cocktail.tags.length ? (
              <View style={styles.tagList}>
                {(cocktail.tags as unknown[]).map((rawTag, index) => {
                  if (typeof rawTag === "number") {
                    const fallbackName = t(`cocktailTag.${rawTag}`);
                    const finalName =
                      fallbackName !== `cocktailTag.${rawTag}`
                        ? fallbackName
                        : t("cocktailDetails.tag");
                    return (
                      <TagPill
                        key={`tag-${rawTag}-${index}`}
                        label={finalName}
                        color={Colors.tint}
                        selected
                        accessibilityLabel={finalName}
                      />
                    );
                  }

                  const tag = (rawTag ?? {}) as Partial<CocktailTag>;
                  const tagKey =
                    tag.id != null
                      ? `tag-${tag.id}`
                      : tag.name
                        ? `tag-${tag.name}`
                        : `tag-${index}`;

                  const tagName = tag.id != null ? t(`cocktailTag.${tag.id}`) : tag.name;
                  const finalName =
                    tagName && tag.id != null && tagName !== `cocktailTag.${tag.id}`
                      ? tagName
                      : (tag.name ?? t("cocktailDetails.tag"));

                  return (
                    <TagPill
                      key={tagKey}
                      label={finalName}
                      color={tag.color ?? Colors.tint}
                      selected
                      accessibilityLabel={finalName}
                    />
                  );
                })}
              </View>
            ) : null}

            {descriptionParagraphs.length ? (
              <View style={styles.textBlock}>
                <Pressable
                  onPress={toggleDescription}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isDescriptionExpanded
                      ? t("cocktailDetails.showLessDescription")
                      : t("cocktailDetails.showFullDescription")
                  }
                  hitSlop={8}
                >
                  <View style={styles.instructionsList}>
                    {isDescriptionExpanded
                      ? descriptionParagraphs.map((paragraph, index) => (
                        <FormattedText
                          key={`description-${index}`}
                          style={[
                            styles.instructionsText,
                            { color: Colors.onSurface },
                          ]}
                        >
                          {paragraph}
                        </FormattedText>
                      ))
                      : descriptionParagraphs.slice(0, 1).map((paragraph, index) => (
                        <FormattedText
                          key={`description-${index}`}
                          style={[
                            styles.instructionsText,
                            { color: Colors.onSurfaceVariant },
                          ]}
                          numberOfLines={
                            shouldTruncateDescription
                              ? DESCRIPTION_PREVIEW_LINES
                              : undefined
                          }
                          onTextLayout={handleDescriptionLayout}
                        >
                          {paragraph}
                        </FormattedText>
                      ))}
                  </View>
                </Pressable>
                {shouldTruncateDescription ? (
                  <Pressable
                    onPress={toggleDescription}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isDescriptionExpanded
                        ? t("cocktailDetails.showLessDescription")
                        : t("cocktailDetails.showFullDescription")
                    }
                    hitSlop={8}
                  >
                    <Text
                      style={[styles.descriptionToggleText, { color: Colors.tint }]}
                    >
                      {isDescriptionExpanded
                        ? t("cocktailDetails.showLess")
                        : t("cocktailDetails.showMore")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {instructionsParagraphs.length ? (
              <View style={styles.textBlock}>
                <Text
                  style={[
                    styles.instructionsTitle,
                    { color: Colors.onSurface },
                  ]}
                >
                  {t("cocktailDetails.instructions")}
                </Text>
                <View style={styles.instructionsList}>
                  {instructionsParagraphs.map((paragraph, index) => (
                    <FormattedText
                      key={`instruction-${index}`}
                      style={[
                        styles.instructionsText,
                        { color: Colors.onSurface },
                      ]}
                    >
                      {paragraph}
                    </FormattedText>
                  ))}
                </View>
              </View>
            ) : null}

            {sortedIngredients.length ? (
              <View style={styles.textBlock}>
                <View style={styles.ingredientsHeaderRow}>
                  <Text
                    style={[styles.sectionTitle, { color: Colors.onSurface }]}
                  >
                    {t("cocktailDetails.ingredients")}
                  </Text>
                  <View
                    style={[
                      styles.displayModeSwitcher,
                      {
                        borderColor: Colors.primary,
                        backgroundColor: Colors.surfaceBright,
                      },
                    ]}
                  >
                    {(["imperial", "metric", "parts"] as const).map((mode) => {
                      const isActive = ingredientDisplayMode === mode;
                      return (
                        <Pressable
                          key={mode}
                          onPress={() => handleSelectDisplayMode(mode)}
                          style={[
                            styles.displayModeOption,
                            isActive
                              ? { backgroundColor: Colors.primary }
                              : undefined,
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isActive }}
                          accessibilityLabel={t(`cocktailDetails.displayMode.${mode}`)}
                        >
                          <Text
                            style={[
                              styles.displayModeOptionLabel,
                              { color: isActive ? Colors.onPrimary : Colors.primary },
                            ]}
                          >
                            {t(`cocktailDetails.displayMode.${mode}`)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <View style={styles.servingsControl}>
                  <Text
                    style={[styles.servingsLabel, { color: Colors.onSurfaceVariant }]}
                  >
                    {t("cocktailDetails.servings")}
                  </Text>
                  <View
                    style={[
                      styles.servingsStepper,
                      { borderColor: Colors.outline, backgroundColor: Colors.surfaceBright },
                    ]}
                  >
                    <Pressable
                      onPress={handleDecreaseServings}
                      disabled={!canDecreaseServings}
                      style={styles.servingsButton}
                      accessibilityRole="button"
                      accessibilityLabel={t("cocktailDetails.decreaseServings")}
                    >
                      <MaterialCommunityIcons
                        name="minus"
                        size={18}
                        color={canDecreaseServings ? Colors.primary : Colors.onSurfaceDisabled}
                      />
                    </Pressable>
                    <Text style={[styles.servingsValue, { color: Colors.onSurface }]}>
                      {formatAmount(servings)}
                    </Text>
                    <Pressable
                      onPress={handleIncreaseServings}
                      style={styles.servingsButton}
                      accessibilityRole="button"
                      accessibilityLabel={t("cocktailDetails.increaseServings")}
                    >
                      <MaterialCommunityIcons
                        name="plus"
                        size={18}
                        color={Colors.primary}
                      />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.ingredientsList}>
                  {sortedIngredients.map((ingredient, index) => {
                    const resolution = resolvedIngredients[index];
                    const ingredientId = parseIngredientId(ingredient);
                    const resolvedId = resolution.resolvedId ?? ingredientId;
                    const resolvedDeclaredSubstitute =
                      resolution.substituteFor && resolvedId != null
                        ? (ingredient.substitutes ?? []).find(
                          (substitute) =>
                            typeof substitute.ingredientId === "number" &&
                            substitute.ingredientId === resolvedId,
                        )
                        : undefined;
                    const quantityIngredient =
                      resolvedDeclaredSubstitute?.amount?.trim()
                        ? resolveScaledIngredient(
                          {
                            ...ingredient,
                            amount: resolvedDeclaredSubstitute.amount,
                            unitId:
                              typeof resolvedDeclaredSubstitute.unitId === "number"
                                ? resolvedDeclaredSubstitute.unitId
                                : undefined,
                          },
                          servings,
                          normalizedDefaultServings,
                        )
                        : (scaledIngredients[index] ?? ingredient);
                    const quantityBase = formatIngredientQuantity(
                      quantityIngredient,
                      ingredientDisplayMode,
                      smallestPartAmount,
                      t("cocktailDetails.asNeeded"),
                      t,
                      locale,
                    );
                    const substituteUnit =
                      typeof resolvedDeclaredSubstitute?.unitId === "number"
                        ? ""
                        : (resolvedDeclaredSubstitute?.unit?.trim() ?? "");
                    const quantity = substituteUnit
                      ? `${quantityBase} ${substituteUnit}`
                      : quantityBase;
                    const qualifier = getIngredientQualifier(
                      ingredient,
                      t("cocktailDetails.garnish"),
                      t("cocktailDetails.optional"),
                      t("cocktailDetails.process"),
                      t("cocktailDetails.serving"),
                    );
                    const key = `${ingredient.ingredientId ?? ingredient.name}-${ingredient.order}`;
                    const resolvedIngredient =
                      resolvedId != null && resolvedId >= 0
                        ? ingredientLookup.ingredientById.get(resolvedId)
                        : undefined;
                    const catalogEntry =
                      ingredientId >= 0
                        ? ingredientLookup.ingredientById.get(ingredientId)
                        : undefined;
                    const photoUri =
                      ingredient.photoUri ??
                      resolvedIngredient?.photoUri ??
                      catalogEntry?.photoUri;
                    const previousIngredient = sortedIngredients[index - 1];
                    const previousResolution = previousIngredient
                      ? resolvedIngredients[index - 1]
                      : undefined;
                    const dividerColor = previousResolution?.isAvailable
                      ? Colors.outline
                      : Colors.outlineVariant;
                    const ingredientTagColors = (
                      resolvedIngredient?.tags ??
                      ingredient.tags ??
                      catalogEntry?.tags ??
                      []
                    )
                      .map((tag) => tag?.color ?? tagColors.yellow)
                      .filter(Boolean);
                    const brandIndicatorColor =
                      resolvedIngredient?.styleIngredientId != null ||
                        catalogEntry?.styleIngredientId != null
                        ? Colors.styledIngredient
                        : resolvedIngredient?.baseIngredientId != null ||
                          catalogEntry?.baseIngredientId != null
                          ? Colors.primary
                          : undefined;
                    const isStyleBaseIngredient =
                      (resolvedId != null &&
                        (ingredientLookup.stylesByBaseId.get(resolvedId)?.length ?? 0) > 0) ||
                      (ingredientId >= 0 &&
                        (ingredientLookup.stylesByBaseId.get(ingredientId)?.length ?? 0) > 0);
                    const isBrandBaseIngredient =
                      (resolvedId != null &&
                        (ingredientLookup.brandsByBaseId.get(resolvedId)?.length ?? 0) > 0) ||
                      (ingredientId >= 0 &&
                        (ingredientLookup.brandsByBaseId.get(ingredientId)?.length ?? 0) > 0);
                    const rightIndicatorColor = isBrandBaseIngredient
                      ? Colors.primary
                      : isStyleBaseIngredient
                        ? Colors.styledIngredient
                        : undefined;
                    const rightIndicatorBottomColor = isBrandBaseIngredient && isStyleBaseIngredient
                      ? Colors.styledIngredient
                      : undefined;
                    const isOnShoppingList =
                      ingredientId >= 0 &&
                      shoppingIngredientIds.has(ingredientId);
                    const handlePress = () => {
                      const routeParam =
                        resolvedId != null && resolvedId >= 0
                          ? resolvedId
                          : (catalogEntry?.id ?? ingredient.name);
                      if (routeParam == null) {
                        return;
                      }

                      const returnToParam =
                        cocktail?.id != null
                          ? String(cocktail.id)
                          : resolvedParam
                            ? String(resolvedParam)
                            : undefined;
                      navigateToDetailsWithReturnTo({
                        pathname: "/ingredients/[ingredientId]",
                        params: {
                          ingredientId: String(routeParam),
                        },
                        returnToPath: returnToParam
                          ? "/cocktails/[cocktailId]"
                          : undefined,
                        returnToParams: returnToParam
                          ? { cocktailId: returnToParam }
                          : undefined,
                      });
                    };

                    const subtitleLines: string[] = [];
                    const isBaseToBrandSubstitution =
                      Boolean(resolution.substituteFor) &&
                      ingredientId >= 0 &&
                      resolvedIngredient?.baseIngredientId != null &&
                      resolvedIngredient.baseIngredientId === ingredientId;

                    if (resolution.substituteFor) {
                      subtitleLines.push(
                        isBaseToBrandSubstitution
                          ? t("cocktailDetails.orAny", { name: resolution.substituteFor })
                          : t("cocktailDetails.substituteFor", {
                            name: resolution.substituteFor,
                          }),
                      );
                    }

                    const missingSubstituteLines = buildMissingSubstituteLines(
                      ingredient,
                      resolution,
                      ingredientLookup,
                      t,
                    );

                    if (
                      !resolution.isAvailable &&
                      missingSubstituteLines.length
                    ) {
                      subtitleLines.push(...missingSubstituteLines);
                    }

                    const qualifierLine = qualifier
                      ? qualifier.charAt(0).toUpperCase() + qualifier.slice(1)
                      : undefined;
                    const subtitle = subtitleLines.length
                      ? subtitleLines.join("\n")
                      : undefined;
                    const subtitleContent =
                      subtitle || qualifierLine ? (
                        <View>
                          {subtitle ? (
                            <Text
                              style={[
                                styles.ingredientSubtitle,
                                { color: Colors.onSurfaceVariant },
                              ]}
                            >
                              {subtitle}
                            </Text>
                          ) : null}
                          {qualifierLine ? (
                            <Text
                              style={[
                                styles.ingredientSubtitle,
                                subtitle
                                  ? styles.ingredientQualifier
                                  : undefined,
                                { color: Colors.onSurfaceVariant },
                              ]}
                            >
                              {qualifierLine}
                            </Text>
                          ) : null}
                        </View>
                      ) : undefined;

                    return (
                      <View key={key}>
                        {index > 0 ? (
                          <View
                            style={[
                              styles.ingredientDivider,
                              { backgroundColor: dividerColor },
                            ]}
                          />
                        ) : null}
                        <ListRow
                          title={
                            resolution.resolvedName || ingredient.name || ""
                          }
                          subtitleContent={subtitleContent}
                          thumbnail={
                            <Thumb
                              label={
                                resolution.resolvedName ??
                                ingredient.name ??
                                undefined
                              }
                              uri={photoUri}
                              fallbackUri={catalogEntry?.photoUri}
                            />
                          }
                          control={
                            <View style={styles.quantityContainer}>
                              <Text
                                style={[
                                  styles.quantityLabel,
                                  { color: Colors.onSurfaceVariant },
                                ]}
                                numberOfLines={1}
                              >
                                {quantity}
                              </Text>
                            </View>
                          }
                          metaFooter={
                            isOnShoppingList ? (
                              <MaterialIcons
                                name="shopping-cart"
                                size={16}
                                color={Colors.tint}
                                style={styles.shoppingIcon}
                                accessibilityRole="image"
                                accessibilityLabel={t("cocktailDetails.onShoppingList")}
                              />
                            ) : (
                              <View style={styles.shoppingIconPlaceholder} />
                            )
                          }
                          onPress={handlePress}
                          selected={resolution.isAvailable}
                          highlightColor={ingredientHighlightColor}
                          tagColors={ingredientTagColors}
                          brandIndicatorColor={brandIndicatorColor}
                          rightIndicatorColor={rightIndicatorColor}
                          rightIndicatorBottomColor={rightIndicatorBottomColor}
                          accessibilityRole="button"
                          accessibilityState={
                            resolution.isAvailable
                              ? { selected: true }
                              : undefined
                          }
                          metaAlignment="center"
                        />
                      </View>
                    );
                  })}
                </View>

                <View style={styles.itemActions}>
                  <Pressable
                    onPress={handleCopyPress}
                    accessibilityRole="button"
                    accessibilityLabel={t("cocktailDetails.copyCocktail")}
                    style={[styles.itemActionButton, { borderColor: Colors.primary, backgroundColor: Colors.surfaceBright }]}
                  >
                    <MaterialCommunityIcons
                      name="content-copy"
                      size={18}
                      color={Colors.primary}
                    />
                    <Text style={[styles.itemActionLabel, { color: Colors.primary }]}>{t("cocktailDetails.copyCocktail")}</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleEditPress}
                    accessibilityRole="button"
                    accessibilityLabel={t("cocktailDetails.editCocktail")}
                    style={[styles.itemActionButton, { borderColor: Colors.primary, backgroundColor: Colors.surfaceBright }]}
                  >
                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={18}
                      color={Colors.primary}
                    />
                    <Text style={[styles.itemActionLabel, { color: Colors.primary }]}>{t("cocktailDetails.editCocktail")}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="glass-cocktail"
              size={42}
              color={Colors.onSurfaceVariant}
            />
            <Text
              style={[styles.emptyText, { color: Colors.onSurfaceVariant }]}
            >
              {t("cocktailDetails.notFound")}
            </Text>
          </View>
        )}
      </ScrollView>

      <AppDialog
        visible={isHelpVisible}
        title={t("cocktailDetails.title")}
        message={t("cocktailDetails.helpMessage")}
        actions={[{ label: t("common.gotIt"), variant: "secondary" }]}
        onRequestClose={() => setIsHelpVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  section: {
    gap: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  mediaSection: {
    gap: 16,
    alignItems: "center",
  },
  itemActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
    gap: 24,
    flexWrap: "wrap",
  },
  itemActionButton: {
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
  itemActionLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  photoWrapper: {
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  photo: {
    width: 150,
    height: 150,
    borderRadius: 12,
    overflow: "hidden",
  },
  photoPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  photoPlaceholderText: {
    fontSize: 14,
  },
  ratingRow: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
    position: "relative",
  },
  ratingStarsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  partyControlsColumn: {
    position: 'absolute',
    right: 0,
    top: 0,
    alignItems: 'flex-end',
    gap: 8,
  },
  partyShoppingButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoInstructionButton: {
    width: 32,
    height: 32,
    marginLeft: "auto",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingStar: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  methodsAndCommentRow: {
    flexDirection: "row",
    alignSelf: "stretch",
    alignItems: "flex-end",
    gap: 8,
  },
  commentToggleButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  commentInput: {
    width: "100%",
    minHeight: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 14, default: 12 }),
    fontSize: 16,
    marginTop: 12,
  },
  displayModeSwitcher: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignSelf: "flex-end",
    overflow: "hidden",
  },
  displayModeOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  displayModeOptionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  glassInfo: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
  },
  glassInfoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  glassImageWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: "hidden",
  },
  glassImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  glassLabel: {
    fontSize: 16,
  },
  tagList: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 8,
    alignSelf: "stretch",
  },
  methodList: {
    gap: 12,
    alignSelf: "stretch",
    flex: 1,
  },
  methodListFiller: {
    flex: 1,
  },
  textBlock: {
    gap: 12,
  },
  methodEntry: {
    gap: 6,
  },
  methodHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  methodIconWrapper: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  methodIcon: {
    width: 18,
    height: 18,
  },
  muddleIcon: {
    transform: [{ scaleX: 2 }],
  },
  methodLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  methodDescription: {
    fontSize: 13,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  ingredientsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 22,
  },
  instructionsList: {
    gap: 8,
  },
  descriptionToggleText: {
    alignSelf: "flex-start",
    fontSize: 14,
    fontWeight: "500",
    marginTop: -10,
  },
  ingredientsList: {
    marginHorizontal: -24,
  },
  servingsControl: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  servingsLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  servingsStepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    gap: 4,
  },
  servingsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  servingsValue: {
    minWidth: 40,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },
  ingredientDivider: {
    height: StyleSheet.hairlineWidth,
  },
  quantityContainer: {
    minWidth: 8,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  quantityLabel: {
    fontSize: 14,
    textAlign: "right",
  },
  ingredientSubtitle: {
    fontSize: 12,
  },
  ingredientQualifier: {
    marginTop: 4,
  },
  shoppingIcon: {
    width: 16,
    height: 16,
    alignSelf: "flex-end",
  },
  shoppingIconPlaceholder: {
    width: 16,
    height: 16,
    alignSelf: "flex-end",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 80,
  },
  emptyText: {
    fontSize: 14,
  },
});
