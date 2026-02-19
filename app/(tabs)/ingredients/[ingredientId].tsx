import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppDialog, type DialogOptions } from "@/components/AppDialog";
import { AppImage } from "@/components/AppImage";
import { CocktailListRow } from "@/components/CocktailListRow";
import { FormattedText } from "@/components/FormattedText";
import { HeaderIconButton } from "@/components/HeaderIconButton";
import { PresenceCheck } from "@/components/RowParts";
import { TagPill } from "@/components/TagPill";
import { useAppColors } from "@/constants/theme";
import { buildAmazonIngredientUrl } from "@/libs/amazon-links";
import { AMAZON_STORES } from "@/libs/amazon-stores";
import { summariseCocktailAvailability } from "@/libs/cocktail-availability";
import { resolveImageSource } from "@/libs/image-source";
import {
  createIngredientLookup,
  getVisibleIngredientIdsForCocktail,
} from "@/libs/ingredient-availability";
import {
  buildReturnToParams,
  navigateToDetailsWithReturnTo,
  parseReturnToParams,
  returnToSourceOrBack,
  skipDuplicateBack,
} from "@/libs/navigation";
import { normalizeSearchText } from "@/libs/search-normalization";
import { useInventory, type Ingredient } from "@/providers/inventory-provider";

function useResolvedIngredient(
  param: string | undefined,
  ingredients: Ingredient[],
) {
  return useMemo(() => {
    if (!param) {
      return undefined;
    }

    const numericId = Number(param);
    if (!Number.isNaN(numericId)) {
      const byId = ingredients.find(
        (item) => Number(item.id ?? -1) === numericId,
      );
      if (byId) {
        return byId;
      }
    }

    const normalized = normalizeSearchText(param);
    return ingredients.find(
      (item) => normalizeSearchText(item.name ?? "") === normalized,
    );
  }, [ingredients, param]);
}

function buildFallbackText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 2).toUpperCase() : undefined;
}

export default function IngredientDetailsScreen() {
  const params = useLocalSearchParams<{
    ingredientId?: string;
    returnToPath?: string;
    returnToParams?: string;
  }>();
  const navigation = useNavigation();
  const Colors = useAppColors();
  const { ingredientId } = params;
  const {
    ingredients,
    cocktails,
    loading,
    availableIngredientIds,
    toggleIngredientAvailability,
    shoppingIngredientIds,
    toggleIngredientShopping,
    clearBaseIngredient,
    ignoreGarnish,
    allowAllSubstitutes,
    getCocktailRating,
    effectiveAmazonStore,
  } = useInventory();

  const ingredient = useResolvedIngredient(
    Array.isArray(ingredientId) ? ingredientId[0] : ingredientId,
    ingredients,
  );

  const returnToPath = useMemo(() => {
    const value = Array.isArray(params.returnToPath)
      ? params.returnToPath[0]
      : params.returnToPath;
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }, [params.returnToPath]);

  const returnToParams = useMemo(() => {
    return parseReturnToParams(params.returnToParams);
  }, [params.returnToParams]);

  const ingredientLookup = useMemo(
    () => createIngredientLookup(ingredients),
    [ingredients],
  );

  const numericIngredientId = useMemo(() => {
    const candidate =
      ingredient?.id ??
      (Array.isArray(ingredientId) ? ingredientId[0] : ingredientId);
    const parsed = Number(candidate);
    return Number.isNaN(parsed) ? undefined : parsed;
  }, [ingredient?.id, ingredientId]);

  const [optimisticAvailability, setOptimisticAvailability] = useState<
    boolean | null
  >(null);
  const [optimisticShopping, setOptimisticShopping] = useState<boolean | null>(
    null,
  );
  const [dialogOptions, setDialogOptions] = useState<DialogOptions | null>(
    null,
  );
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [, startAvailabilityTransition] = useTransition();
  const [, startShoppingTransition] = useTransition();
  const isHandlingBackRef = useRef(false);
  const shouldNavigateAway = !loading && !ingredient;

  const isAvailable = useMemo(() => {
    if (numericIngredientId == null) {
      return false;
    }
    return availableIngredientIds.has(numericIngredientId);
  }, [availableIngredientIds, numericIngredientId]);

  const isOnShoppingList = useMemo(() => {
    if (numericIngredientId == null) {
      return false;
    }
    return shoppingIngredientIds.has(numericIngredientId);
  }, [numericIngredientId, shoppingIngredientIds]);

  const effectiveIsAvailable = optimisticAvailability ?? isAvailable;
  const effectiveIsOnShoppingList = optimisticShopping ?? isOnShoppingList;
  const effectiveAvailableIngredientIds = useMemo(() => {
    const nextIds = new Set(availableIngredientIds);
    if (numericIngredientId == null) {
      return nextIds;
    }

    if (effectiveIsAvailable) {
      nextIds.add(numericIngredientId);
    } else {
      nextIds.delete(numericIngredientId);
    }

    return nextIds;
  }, [availableIngredientIds, effectiveIsAvailable, numericIngredientId]);

  useEffect(() => {
    setOptimisticAvailability((previous) => {
      if (previous == null) {
        return previous;
      }

      return previous === isAvailable ? null : previous;
    });
  }, [isAvailable]);

  useEffect(() => {
    setOptimisticShopping((previous) => {
      if (previous == null) {
        return previous;
      }

      return previous === isOnShoppingList ? null : previous;
    });
  }, [isOnShoppingList]);

  const closeDialog = useCallback(() => {
    setDialogOptions(null);
  }, []);

  const showDialog = useCallback((options: DialogOptions) => {
    setDialogOptions(options);
  }, []);

  const baseIngredient = useMemo(() => {
    if (!ingredient?.baseIngredientId) {
      return undefined;
    }

    const baseId = Number(ingredient.baseIngredientId);
    if (Number.isNaN(baseId)) {
      return undefined;
    }

    return ingredients.find((item) => Number(item.id ?? -1) === baseId);
  }, [ingredient?.baseIngredientId, ingredients]);

  const styleIngredient = useMemo(() => {
    if (!ingredient?.styleIngredientId) {
      return undefined;
    }

    const styleId = Number(ingredient.styleIngredientId);
    if (Number.isNaN(styleId)) {
      return undefined;
    }

    return ingredients.find((item) => Number(item.id ?? -1) === styleId);
  }, [ingredient?.styleIngredientId, ingredients]);

  const isBaseIngredientAvailable = useMemo(() => {
    if (!baseIngredient?.id) {
      return false;
    }

    const baseId = Number(baseIngredient.id);
    if (Number.isNaN(baseId)) {
      return false;
    }

    return availableIngredientIds.has(baseId);
  }, [availableIngredientIds, baseIngredient?.id]);

  const isStyleIngredientAvailable = useMemo(() => {
    if (!styleIngredient?.id) {
      return false;
    }

    const styleId = Number(styleIngredient.id);
    if (Number.isNaN(styleId)) {
      return false;
    }

    return availableIngredientIds.has(styleId);
  }, [availableIngredientIds, styleIngredient?.id]);

  const brandedIngredients = useMemo(() => {
    if (numericIngredientId == null) {
      return [];
    }

    return ingredients.filter(
      (item) => Number(item.baseIngredientId ?? -1) === numericIngredientId,
    );
  }, [ingredients, numericIngredientId]);

  const styledIngredients = useMemo(() => {
    if (numericIngredientId == null) {
      return [];
    }

    return ingredients.filter(
      (item) => Number(item.styleIngredientId ?? -1) === numericIngredientId,
    );
  }, [ingredients, numericIngredientId]);

  const styleBaseIngredientIds = useMemo(() => {
    return new Set(
      ingredients
        .filter((item) => Number(item.styleIngredientId ?? -1) >= 0)
        .map((item) => Number(item.styleIngredientId)),
    );
  }, [ingredients]);

  const brandedBaseIngredientIds = useMemo(() => {
    return new Set(
      ingredients
        .filter((item) => Number(item.baseIngredientId ?? -1) >= 0)
        .map((item) => Number(item.baseIngredientId)),
    );
  }, [ingredients]);

  const baseIngredientPhotoSource = useMemo(
    () => resolveImageSource(baseIngredient?.photoUri),
    [baseIngredient?.photoUri],
  );

  const styleIngredientPhotoSource = useMemo(
    () => resolveImageSource(styleIngredient?.photoUri),
    [styleIngredient?.photoUri],
  );

  const cocktailsWithIngredient = useMemo(() => {
    if (numericIngredientId == null) {
      return [];
    }

    return cocktails.filter((cocktail) => {
      const visibleIds = getVisibleIngredientIdsForCocktail(
        cocktail,
        ingredientLookup,
        {
          allowAllSubstitutes,
        },
      );
      return visibleIds.has(numericIngredientId);
    });
  }, [allowAllSubstitutes, cocktails, ingredientLookup, numericIngredientId]);

  const COCKTAIL_PAGE_SIZE = 20;
  const cocktailEntries = useMemo(
    () =>
      cocktailsWithIngredient.map((cocktail) => {
        const availability = summariseCocktailAvailability(
          cocktail,
          effectiveAvailableIngredientIds,
          ingredientLookup,
          undefined,
          { ignoreGarnish, allowAllSubstitutes },
        );
        const availabilityWithIngredient = summariseCocktailAvailability(
          cocktail,
          numericIngredientId == null
            ? effectiveAvailableIngredientIds
            : new Set([
              ...effectiveAvailableIngredientIds,
              numericIngredientId,
            ]),
          ingredientLookup,
          undefined,
          { ignoreGarnish, allowAllSubstitutes },
        );

        return {
          cocktail,
          isReady: availability.isReady,
          missingCount: availability.missingCount,
          recipeNamesCount: availability.recipeNames.length,
          ingredientLine: availability.ingredientLine,
          hasBrandFallback: availability.hasBrandFallback,
          hasStyleFallback: availability.hasStyleFallback,
          canMakeWithIngredient:
            !availability.isReady && availabilityWithIngredient.isReady,
          ratingValue: getCocktailRating(cocktail),
        };
      }),
    [
      allowAllSubstitutes,
      cocktailsWithIngredient,
      effectiveAvailableIngredientIds,
      getCocktailRating,
      ignoreGarnish,
      ingredientLookup,
      numericIngredientId,
    ],
  );
  const canMakeMoreCocktailsCount = useMemo(
    () => cocktailEntries.filter((entry) => entry.canMakeWithIngredient).length,
    [cocktailEntries],
  );
  const [visibleCocktailCount, setVisibleCocktailCount] =
    useState(COCKTAIL_PAGE_SIZE);

  useEffect(() => {
    setVisibleCocktailCount(COCKTAIL_PAGE_SIZE);
  }, [numericIngredientId]);

  const visibleCocktailEntries = useMemo(
    () => cocktailEntries.slice(0, visibleCocktailCount),
    [cocktailEntries, visibleCocktailCount],
  );

  const hasMoreCocktails = visibleCocktailCount < cocktailEntries.length;

  const handleToggleAvailability = useCallback(() => {
    if (numericIngredientId != null) {
      setOptimisticAvailability((previous) => {
        const current = previous ?? isAvailable;
        return !current;
      });

      startAvailabilityTransition(() => {
        toggleIngredientAvailability(numericIngredientId);
      });
    }
  }, [
    isAvailable,
    numericIngredientId,
    startAvailabilityTransition,
    toggleIngredientAvailability,
  ]);

  const handleToggleShopping = useCallback(() => {
    if (numericIngredientId != null) {
      setOptimisticShopping((previous) => {
        const current = previous ?? isOnShoppingList;
        return !current;
      });

      startShoppingTransition(() => {
        toggleIngredientShopping(numericIngredientId);
      });
    }
  }, [
    isOnShoppingList,
    numericIngredientId,
    startShoppingTransition,
    toggleIngredientShopping,
  ]);

  const amazonLinkLabel = useMemo(() => {
    if (!effectiveAmazonStore) {
      return null;
    }

    return `Buy on ${AMAZON_STORES[effectiveAmazonStore].label}`;
  }, [effectiveAmazonStore]);

  const handleAmazonAffiliateInfoPress = useCallback(() => {
    showDialog({
      title: "Affiliate disclosure",
      message: "Some Amazon links in this app are affiliate links. If you buy something, we may earn a small commission at no extra cost to you.\n\nThis helps support the development of the app.\nThank you for your support!",
      actions: [{ label: "Got it", variant: "primary" }],
    });
  }, [showDialog]);

  const handleBuyOnAmazon = useCallback(() => {
    const ingredientName = ingredient?.name?.trim();
    if (!effectiveAmazonStore || !ingredientName) {
      return;
    }

    const url = buildAmazonIngredientUrl(effectiveAmazonStore, ingredientName);
    void Linking.openURL(url).catch((error) => {
      console.error('Failed to open Amazon link', error);
    });
  }, [effectiveAmazonStore, ingredient?.name]);

  const handleEditPress = useCallback(() => {
    if (!ingredient) {
      return;
    }

    const targetId = ingredient.id ?? ingredient.name;
    if (!targetId) {
      return;
    }

    router.push({
      pathname: "/ingredients/create",
      params: {
        ingredientId: String(targetId),
        mode: "edit",
        ...buildReturnToParams(returnToPath, returnToParams),
      },
    });
  }, [ingredient, returnToParams, returnToPath]);

  const handleAddCocktail = useCallback(() => {
    if (!ingredient) {
      router.push("/cocktails/create");
      return;
    }

    const targetId = ingredient.id ?? ingredient.name;
    const params: Record<string, string> = { source: "ingredient" };
    params.openInstanceId = String(Date.now());
    if (targetId != null) {
      params.ingredientId = String(targetId);
    }
    if (ingredient.name) {
      params.ingredientName = ingredient.name;
    }
    if (targetId != null) {
      Object.assign(
        params,
        buildReturnToParams("/ingredients/[ingredientId]", {
          ingredientId: String(targetId),
        }),
      );
    }

    router.push({ pathname: "/cocktails/create", params });
  }, [ingredient]);

  const descriptionParagraphs = useMemo(() => {
    const description = ingredient?.description?.trim();
    if (!description) {
      return [] as string[];
    }

    return description
      .split(/\n+/)
      .map((segment) => segment.trim())
      .filter(Boolean);
  }, [ingredient?.description]);

  const DESCRIPTION_PREVIEW_LINES = 5;
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [shouldTruncateDescription, setShouldTruncateDescription] =
    useState(false);

  const handleDescriptionLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
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

  const handleToggleDescription = useCallback(() => {
    setIsDescriptionExpanded((previous) => !previous);
  }, []);

  useEffect(() => {
    setIsDescriptionExpanded(false);
    setShouldTruncateDescription(descriptionParagraphs.length > 1);
  }, [descriptionParagraphs.length]);

  const photoSource = useMemo(
    () => resolveImageSource(ingredient?.photoUri),
    [ingredient?.photoUri],
  );

  const handleRemoveBase = useCallback(
    (event?: GestureResponderEvent) => {
      event?.stopPropagation();

      if (
        !ingredient ||
        numericIngredientId == null ||
        !ingredient.baseIngredientId
      ) {
        return;
      }

      showDialog({
        title: "Remove base ingredient",
        message: `Are you sure you want to unlink ${ingredient.name} from its base ingredient?`,
        actions: [
          { label: "Cancel", variant: "secondary" },
          {
            label: "Remove",
            variant: "destructive",
            onPress: () => {
              clearBaseIngredient(numericIngredientId);
            },
          },
        ],
      });
    },
    [clearBaseIngredient, ingredient, numericIngredientId, showDialog],
  );

  const handleNavigateToBase = useCallback(() => {
    if (!baseIngredient?.id) {
      return;
    }

    router.push({
      pathname: "/ingredients/[ingredientId]",
      params: { ingredientId: String(baseIngredient.id) },
    });
  }, [baseIngredient?.id]);


  const handleRemoveStyle = useCallback(
    (event?: GestureResponderEvent) => {
      event?.stopPropagation();

      if (
        !ingredient ||
        numericIngredientId == null ||
        !ingredient.styleIngredientId
      ) {
        return;
      }

      showDialog({
        title: "Remove style ingredient",
        message: `Are you sure you want to unlink ${ingredient.name} from its style ingredient?`,
        actions: [
          { label: "Cancel", variant: "secondary" },
          {
            label: "Remove",
            variant: "destructive",
            onPress: () => {
              clearBaseIngredient(numericIngredientId);
            },
          },
        ],
      });
    },
    [clearBaseIngredient, ingredient, numericIngredientId, showDialog],
  );

  const handleNavigateToStyle = useCallback(() => {
    if (!styleIngredient?.id) {
      return;
    }

    router.push({
      pathname: "/ingredients/[ingredientId]",
      params: { ingredientId: String(styleIngredient.id) },
    });
  }, [styleIngredient?.id]);

  const handleNavigateToIngredient = useCallback(
    (id: number | string | undefined) => {
      if (id == null) {
        return;
      }

      router.push({
        pathname: "/ingredients/[ingredientId]",
        params: { ingredientId: String(id) },
      });
    },
    [],
  );

  const handleNavigateToCocktail = useCallback(
    (cocktailId: number | string | undefined) => {
      if (cocktailId == null) {
        return;
      }

      const returnIngredientId =
        ingredient?.id ?? ingredientId ?? ingredient?.name;
      if (returnIngredientId != null) {
        navigateToDetailsWithReturnTo({
          pathname: "/cocktails/[cocktailId]",
          params: {
            cocktailId: String(cocktailId),
          },
          returnToPath: "/ingredients/[ingredientId]",
          returnToParams: { ingredientId: String(returnIngredientId) },
        });
        return;
      }

      router.push({
        pathname: "/cocktails/[cocktailId]",
        params: { cocktailId: String(cocktailId) },
      });
    },
    [ingredient?.id, ingredient?.name, ingredientId],
  );

  const handleRemoveBranded = useCallback(
    (brandedIngredient: Ingredient) => (event?: GestureResponderEvent) => {
      event?.stopPropagation();

      const brandedId = Number(brandedIngredient.id ?? -1);
      if (Number.isNaN(brandedId)) {
        return;
      }

      showDialog({
        title: "Remove branded ingredient",
        message: `Unlink ${brandedIngredient.name} from ${ingredient?.name}?`,
        actions: [
          { label: "Cancel", variant: "secondary" },
          {
            label: "Remove",
            variant: "destructive",
            onPress: () => {
              clearBaseIngredient(brandedId);
            },
          },
        ],
      });
    },
    [clearBaseIngredient, ingredient?.name, showDialog],
  );


  const handleRemoveStyled = useCallback(
    (styledIngredient: Ingredient) => (event?: GestureResponderEvent) => {
      event?.stopPropagation();

      const styledId = Number(styledIngredient.id ?? -1);
      if (Number.isNaN(styledId)) {
        return;
      }

      showDialog({
        title: "Remove styled ingredient",
        message: `Unlink ${styledIngredient.name} from ${ingredient?.name}?`,
        actions: [
          { label: "Cancel", variant: "secondary" },
          {
            label: "Remove",
            variant: "destructive",
            onPress: () => {
              clearBaseIngredient(styledId);
            },
          },
        ],
      });
    },
    [clearBaseIngredient, ingredient?.name, showDialog],
  );

  const handleShowMoreCocktails = useCallback(() => {
    setVisibleCocktailCount((previous) =>
      Math.min(previous + COCKTAIL_PAGE_SIZE, cocktailEntries.length),
    );
  }, [cocktailEntries.length]);

  const handleReturn = useCallback(() => {
    if (returnToPath === "/ingredients") {
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

      isHandlingBackRef.current = true;
      handleReturn();

      requestAnimationFrame(() => {
        isHandlingBackRef.current = false;
      });
    });

    return unsubscribe;
  }, [handleReturn, navigation]);

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
          title: "Ingredient details",
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
              accessibilityLabel="Go back"
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
              accessibilityLabel="Open screen help"
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
        showsVerticalScrollIndicator={false}
      >
        {ingredient ? (
          <View style={styles.section}>
            <Text style={[styles.name, { color: Colors.onSurface }]}>
              {ingredient.name}
            </Text>

            <View style={styles.mediaSection}>
              <View style={styles.photoWrapper}>
                {photoSource ? (
                  <AppImage
                    source={photoSource}
                    style={[styles.photo, { backgroundColor: Colors.surfaceBright }]}
                    contentFit="contain"
                  />
                ) : (
                  <View
                    style={[
                      styles.photoPlaceholder,
                      {
                        borderColor: Colors.outline,
                        backgroundColor: Colors.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.photoPlaceholderText,
                        { color: Colors.onSurfaceVariant },
                      ]}
                    >
                      No photo
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.statusRow}>
                <View style={styles.statusControls}>
                  <View style={styles.statusControlRow}>
                    <Text
                      style={[styles.statusControlLabel, { color: Colors.onSurfaceVariant }]}
                    >
                      I have it
                    </Text>
                    <PresenceCheck
                      checked={effectiveIsAvailable}
                      onToggle={handleToggleAvailability}
                      color={Colors.tint}
                    />
                  </View>
                  <View style={styles.statusControlRow}>
                    <Text
                      style={[styles.statusControlLabel, { color: Colors.onSurfaceVariant }]}
                    >
                      {effectiveIsOnShoppingList
                        ? "Remove from shopping list"
                        : "Add to shopping list"}
                    </Text>
                    <Pressable
                      onPress={handleToggleShopping}
                      accessibilityRole="button"
                      accessibilityLabel={
                        effectiveIsOnShoppingList
                          ? "Remove ingredient from shopping list"
                          : "Add ingredient to shopping list"
                      }
                      hitSlop={8}
                      style={styles.statusIconButton}
                    >
                      <MaterialIcons
                        name={
                          effectiveIsOnShoppingList
                            ? "shopping-cart"
                            : "add-shopping-cart"
                        }
                        size={24}
                        color={Colors.tint}
                      />
                    </Pressable>
                  </View>

                  {amazonLinkLabel ? (
                    <View style={styles.amazonLinkGroup}>
                      <View style={styles.amazonLinkRow}>
                        <Pressable
                          onPress={handleBuyOnAmazon}
                          accessibilityRole="link"
                          accessibilityLabel={amazonLinkLabel}
                          hitSlop={8}
                          style={styles.amazonLinkButton}
                        >
                          <Text style={[styles.amazonLinkText, { color: Colors.tint }]}>
                            {amazonLinkLabel}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={handleAmazonAffiliateInfoPress}
                          accessibilityRole="button"
                          accessibilityLabel="Amazon affiliate information"
                          hitSlop={8}
                          style={styles.amazonInfoButton}
                        >
                          <MaterialCommunityIcons
                            name="information-outline"
                            size={24}
                            color={Colors.onSurfaceVariant}
                            style={styles.amazonInfoIcon}
                          />
                        </Pressable>
                      </View>
                      {!effectiveIsAvailable && canMakeMoreCocktailsCount > 0 ? (
                        <Text
                          style={[
                            styles.amazonAvailabilityHint,
                            { color: Colors.onSurfaceVariant },
                          ]}
                        >
                          {`to make ${canMakeMoreCocktailsCount} more cocktails`}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {ingredient.tags && ingredient.tags.length ? (
              <View style={styles.tagList}>
                {ingredient.tags.map((tag, index) => {
                  const tagKey =
                    tag.id != null
                      ? `tag-${tag.id}`
                      : tag.name
                        ? `tag-${tag.name}`
                        : `tag-${index}`;

                  return (
                    <TagPill
                      key={tagKey}
                      label={tag.name ?? ""}
                      color={tag.color ?? Colors.tint}
                      selected
                      accessibilityLabel={tag.name ?? "Tag"}
                    />
                  );
                })}
              </View>
            ) : null}

            {descriptionParagraphs.length ? (
              <View style={styles.textBlock}>
                <Pressable
                  onPress={handleToggleDescription}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isDescriptionExpanded
                      ? "Show less description"
                      : "Show full description"
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
                    onPress={handleToggleDescription}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isDescriptionExpanded
                        ? "Show less description"
                        : "Show full description"
                    }
                    hitSlop={8}
                  >
                    <Text
                      style={[styles.descriptionToggleText, { color: Colors.tint }]}
                    >
                      {isDescriptionExpanded ? "Show less" : "Show more"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {styleIngredient ? (
              <View style={styles.textBlock}>
                <Text
                  style={[styles.sectionTitle, { color: Colors.onSurface }]}
                >
                  Style ingredient
                </Text>
                <Pressable
                  onPress={handleNavigateToStyle}
                  accessibilityRole="button"
                  accessibilityLabel="View style ingredient"
                  style={[
                    styles.baseIngredientRow,
                    {
                      borderColor: Colors.outlineVariant,
                      backgroundColor: isStyleIngredientAvailable
                        ? Colors.highlightFaint
                        : Colors.surfaceBright,
                    },
                  ]}
                >
                  {styleIngredient?.id != null && brandedBaseIngredientIds.has(Number(styleIngredient.id)) ? (
                    <View style={[styles.rightIndicator, { backgroundColor: Colors.primary }]} />
                  ) : styleIngredient?.id != null && styleBaseIngredientIds.has(Number(styleIngredient.id)) ? (
                    <View style={[styles.rightIndicator, { backgroundColor: Colors.styledIngredient }]} />
                  ) : null}
                  <View style={styles.baseIngredientInfo}>
                    <View style={[styles.baseIngredientThumb, { backgroundColor: Colors.surfaceBright }]}>
                      {styleIngredientPhotoSource ? (
                        <AppImage
                          source={styleIngredientPhotoSource}
                          style={styles.baseIngredientImage}
                          contentFit="contain"
                        />
                      ) : (
                        <View
                          style={[
                            styles.baseIngredientPlaceholder,
                            { backgroundColor: Colors.surfaceBright },
                          ]}
                        >
                          {buildFallbackText(styleIngredient.name) ? (
                            <Text
                              style={[
                                styles.thumbFallback,
                                { color: Colors.onSurfaceVariant },
                              ]}
                            >
                              {buildFallbackText(styleIngredient.name)}
                            </Text>
                          ) : null}
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.baseIngredientName,
                        { color: Colors.onSurface },
                      ]}
                      numberOfLines={2}
                    >
                      {styleIngredient.name}
                    </Text>
                  </View>
                  <View style={styles.baseIngredientActions}>
                    <Pressable
                      onPress={handleRemoveStyle}
                      style={styles.unlinkButton}
                      accessibilityRole="button"
                      accessibilityLabel="Remove style ingredient"
                      hitSlop={8}
                    >
                      <MaterialCommunityIcons
                        name="link-off"
                        size={20}
                        color={Colors.error}
                      />
                    </Pressable>
                    <MaterialIcons
                      name="chevron-right"
                      size={20}
                      color={Colors.onSurfaceVariant}
                    />
                  </View>
                </Pressable>
              </View>
            ) : null}


            {baseIngredient ? (
              <View style={styles.textBlock}>
                <Text
                  style={[styles.sectionTitle, { color: Colors.onSurface }]}
                >
                  Base ingredient
                </Text>
                <Pressable
                  onPress={handleNavigateToBase}
                  accessibilityRole="button"
                  accessibilityLabel="View base ingredient"
                  style={[
                    styles.baseIngredientRow,
                    {
                      borderColor: Colors.outlineVariant,
                      backgroundColor: isBaseIngredientAvailable
                        ? Colors.highlightFaint
                        : Colors.surfaceBright,
                    },
                  ]}
                >
                  <View style={[styles.rightIndicator, { backgroundColor: Colors.primary }]} />
                  <View style={styles.baseIngredientInfo}>
                    <View style={[styles.baseIngredientThumb, { backgroundColor: Colors.surfaceBright }]}>
                      {baseIngredientPhotoSource ? (
                        <AppImage
                          source={baseIngredientPhotoSource}
                          style={styles.baseIngredientImage}
                          contentFit="contain"
                        />
                      ) : (
                        <View
                          style={[
                            styles.baseIngredientPlaceholder,
                            { backgroundColor: Colors.surfaceBright },
                          ]}
                        >
                          {buildFallbackText(baseIngredient.name) ? (
                            <Text
                              style={[
                                styles.thumbFallback,
                                { color: Colors.onSurfaceVariant },
                              ]}
                            >
                              {buildFallbackText(baseIngredient.name)}
                            </Text>
                          ) : null}
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.baseIngredientName,
                        { color: Colors.onSurface },
                      ]}
                      numberOfLines={2}
                    >
                      {baseIngredient.name}
                    </Text>
                  </View>
                  <View style={styles.baseIngredientActions}>
                    <Pressable
                      onPress={handleRemoveBase}
                      style={styles.unlinkButton}
                      accessibilityRole="button"
                      accessibilityLabel="Remove base ingredient"
                      hitSlop={8}
                    >
                      <MaterialCommunityIcons
                        name="link-off"
                        size={20}
                        color={Colors.error}
                      />
                    </Pressable>
                    <MaterialIcons
                      name="chevron-right"
                      size={20}
                      color={Colors.onSurfaceVariant}
                    />
                  </View>
                </Pressable>
              </View>
            ) : null}



            {styledIngredients.length ? (
              <View style={styles.textBlock}>
                <Text
                  style={[styles.sectionTitle, { color: Colors.onSurface }]}
                >
                  Styled ingredients
                </Text>
                <View style={styles.brandedList}>
                  {styledIngredients.map((styled) => {
                    const styledPhotoSource = resolveImageSource(
                      styled.photoUri,
                    );
                    const styledFallbackText = buildFallbackText(styled.name);

                    return (
                      <Pressable
                        key={styled.id ?? styled.name}
                        onPress={() => handleNavigateToIngredient(styled.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`View ${styled.name}`}
                        style={[
                          styles.baseIngredientRow,
                          {
                            borderColor: Colors.outlineVariant,
                            backgroundColor: availableIngredientIds.has(
                              Number(styled.id ?? -1),
                            )
                              ? Colors.highlightFaint
                              : Colors.surfaceBright,
                          },
                        ]}
                      >
                        <View style={[styles.leftIndicator, { backgroundColor: Colors.styledIngredient }]} />
                        {styled.id != null && brandedBaseIngredientIds.has(Number(styled.id)) ? (
                          <View style={[styles.rightIndicator, { backgroundColor: Colors.primary }]} />
                        ) : styled.id != null && styleBaseIngredientIds.has(Number(styled.id)) ? (
                          <View style={[styles.rightIndicator, { backgroundColor: Colors.styledIngredient }]} />
                        ) : null}
                        <View style={styles.baseIngredientInfo}>
                          <View style={[styles.baseIngredientThumb, { backgroundColor: Colors.surfaceBright }]}>
                            {styledPhotoSource ? (
                              <AppImage
                                source={styledPhotoSource}
                                style={styles.baseIngredientImage}
                                contentFit="contain"
                              />
                            ) : (
                              <View
                                style={[
                                  styles.baseIngredientPlaceholder,
                                  { backgroundColor: Colors.surfaceBright },
                                ]}
                              >
                                {styledFallbackText ? (
                                  <Text style={[styles.thumbFallback, { color: Colors.onSurfaceVariant }]}>
                                    {styledFallbackText}
                                  </Text>
                                ) : null}
                              </View>
                            )}
                          </View>
                          <Text
                            style={[
                              styles.baseIngredientName,
                              { color: Colors.onSurface },
                            ]}
                            numberOfLines={2}
                          >
                            {styled.name}
                          </Text>
                        </View>
                        <View style={styles.baseIngredientActions}>
                          <Pressable
                            onPress={handleRemoveStyled(styled)}
                            style={styles.unlinkButton}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${styled.name} link`}
                            hitSlop={8}
                          >
                            <MaterialCommunityIcons
                              name="link-off"
                              size={20}
                              color={Colors.error}
                            />
                          </Pressable>
                          <MaterialIcons
                            name="chevron-right"
                            size={20}
                            color={Colors.onSurfaceVariant}
                          />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}


            {brandedIngredients.length ? (
              <View style={styles.textBlock}>
                <Text
                  style={[styles.sectionTitle, { color: Colors.onSurface }]}
                >
                  Branded ingredients
                </Text>
                <View style={styles.brandedList}>
                  {brandedIngredients.map((branded) => {
                    const brandedPhotoSource = resolveImageSource(
                      branded.photoUri,
                    );
                    const brandedFallbackText = buildFallbackText(branded.name);

                    return (
                      <Pressable
                        key={branded.id ?? branded.name}
                        onPress={() => handleNavigateToIngredient(branded.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`View ${branded.name}`}
                        style={[
                          styles.baseIngredientRow,
                          {
                            borderColor: Colors.outlineVariant,
                            backgroundColor: availableIngredientIds.has(
                              Number(branded.id ?? -1),
                            )
                              ? Colors.highlightFaint
                              : Colors.surfaceBright,
                          },
                        ]}
                      >
                        <View style={[styles.leftIndicator, { backgroundColor: Colors.primary }]} />
                        {branded.id != null && brandedBaseIngredientIds.has(Number(branded.id)) ? (
                          <View style={[styles.rightIndicator, { backgroundColor: Colors.primary }]} />
                        ) : branded.id != null && styleBaseIngredientIds.has(Number(branded.id)) ? (
                          <View style={[styles.rightIndicator, { backgroundColor: Colors.styledIngredient }]} />
                        ) : null}
                        <View style={styles.baseIngredientInfo}>
                          <View style={[styles.baseIngredientThumb, { backgroundColor: Colors.surfaceBright }]}>
                            {brandedPhotoSource ? (
                              <AppImage
                                source={brandedPhotoSource}
                                style={styles.baseIngredientImage}
                                contentFit="contain"
                              />
                            ) : (
                              <View
                                style={[
                                  styles.baseIngredientPlaceholder,
                                  { backgroundColor: Colors.surfaceBright },
                                ]}
                              >
                                {brandedFallbackText ? (
                                  <Text style={[styles.thumbFallback, { color: Colors.onSurfaceVariant }]}>
                                    {brandedFallbackText}
                                  </Text>
                                ) : null}
                              </View>
                            )}
                          </View>
                          <Text
                            style={[
                              styles.baseIngredientName,
                              { color: Colors.onSurface },
                            ]}
                            numberOfLines={2}
                          >
                            {branded.name}
                          </Text>
                        </View>
                        <View style={styles.baseIngredientActions}>
                          <Pressable
                            onPress={handleRemoveBranded(branded)}
                            style={styles.unlinkButton}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${branded.name} link`}
                            hitSlop={8}
                          >
                            <MaterialCommunityIcons
                              name="link-off"
                              size={20}
                              color={Colors.error}
                            />
                          </Pressable>
                          <MaterialIcons
                            name="chevron-right"
                            size={20}
                            color={Colors.onSurfaceVariant}
                          />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={[styles.textBlock, styles.cocktailBlock]}>
              <Text style={[styles.sectionTitle, { color: Colors.onSurface }]}>
                Cocktails
              </Text>
              {cocktailEntries.length ? (
                <View style={styles.cocktailList}>
                  {visibleCocktailEntries.map(
                    ({ cocktail, isReady, missingCount, recipeNamesCount, ingredientLine, ratingValue, hasBrandFallback, hasStyleFallback, canMakeWithIngredient }, index) => {
                      const shouldHighlightRow = isReady || canMakeWithIngredient;
                      const previousReady =
                        index > 0
                          ? visibleCocktailEntries[index - 1]?.isReady
                          : undefined;
                      const dividerColor = previousReady
                        ? Colors.outline
                        : Colors.outlineVariant;

                      return (
                        <React.Fragment key={cocktail.id ?? cocktail.name}>
                          {index > 0 ? (
                            <View
                              style={[
                                styles.cocktailDivider,
                                { backgroundColor: dividerColor },
                              ]}
                            />
                          ) : null}
                          <CocktailListRow
                            cocktail={cocktail}
                            ingredients={ingredients}
                            onPress={() =>
                              handleNavigateToCocktail(
                                cocktail.id ?? cocktail.name,
                              )
                            }
                            highlightColor={
                              canMakeWithIngredient
                                ? Colors.highlightSubtle
                                : isReady
                                  ? undefined
                                  : Colors.highlightFaint
                            }
                            showMethodIcons
                            isReady={shouldHighlightRow}
                            missingCount={missingCount}
                            recipeNamesCount={recipeNamesCount}
                            ingredientLine={ingredientLine}
                            ratingValue={ratingValue}
                            hasBrandFallback={hasBrandFallback}
                            hasStyleFallback={hasStyleFallback}
                          />
                        </React.Fragment>
                      );
                    },
                  )}
                  {hasMoreCocktails ? (
                    <Pressable
                      style={[
                        styles.showMoreButton,
                        {
                          borderColor: Colors.tint,
                          backgroundColor: Colors.background,
                        },
                      ]}
                      onPress={handleShowMoreCocktails}
                      accessibilityRole="button"
                      accessibilityLabel="Show more cocktails"
                    >
                      <Text
                        style={[styles.showMoreLabel, { color: Colors.tint }]}
                      >
                        Show more cocktails
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <Text
                  style={[
                    styles.placeholderText,
                    { color: Colors.onSurfaceVariant },
                  ]}
                >
                  No cocktails yet
                </Text>
              )}
            </View>
            <View style={styles.buttonsContainer}>
              <Pressable
                style={[styles.addButton, { backgroundColor: Colors.tint }]}
                onPress={handleAddCocktail}
                accessibilityRole="button"
                accessibilityLabel="Add cocktail"
              >
                <Text
                  style={[styles.addButtonLabel, { color: Colors.onPrimary }]}
                >
                  + Add cocktail
                </Text>
              </Pressable>

              <View style={styles.itemActions}>
                <Pressable
                  onPress={handleEditPress}
                  accessibilityRole="button"
                  accessibilityLabel="Edit ingredient"
                  style={[styles.itemActionButton, { borderColor: Colors.primary, backgroundColor: Colors.surfaceBright }]}
                >
                  <MaterialCommunityIcons
                    name="pencil-outline"
                    size={18}
                    color={Colors.primary}
                  />
                  <Text style={[styles.itemActionLabel, { color: Colors.primary }]}>Edit ingredient</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text
              style={[
                styles.placeholderText,
                { color: Colors.onSurfaceVariant },
              ]}
            >
              Ingredient not found
            </Text>
          </View>
        )}
      </ScrollView>

      <AppDialog
        visible={isHelpVisible}
        title="Ingredient details"
        message="This screen shows ingredient details, links, and related cocktails.\n\nUse the button under the ingredient to edit it.\n\n**Cocktail ribbons**\nLeft ribbon shows what's inside:\nblue = has brand ingredients,\nyellow = has style ingredients.\n\nRight ribbon shows fallback:\nblue = brand fallback exists,\nyellow = style fallback exists."
        actions={[{ label: "Got it", variant: "secondary" }]}
        onRequestClose={() => setIsHelpVisible(false)}
      />

      <AppDialog
        visible={dialogOptions != null}
        title={dialogOptions?.title ?? ""}
        message={dialogOptions?.message}
        actions={dialogOptions?.actions ?? []}
        onRequestClose={closeDialog}
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
    width: "100%",
    alignItems: "center",
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
    width: 150,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  photo: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    overflow: "hidden",
  },
  photoPlaceholder: {
    width: 150,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    gap: 8,
  },
  photoPlaceholderText: {
    fontSize: 14,
    fontWeight: "500",
  },
  statusRow: {
    alignSelf: "stretch",
    width: "100%",
  },
  statusControls: {
    alignSelf: "stretch",
    alignItems: "flex-end",
    gap: 10,
  },
  statusControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
  },
  statusControlLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  amazonLinkGroup: {
    alignItems: "flex-end",
    gap: 2,
    alignSelf: "stretch",
  },
  amazonLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  amazonAvailabilityHint: {
    fontSize: 13,
    fontWeight: "500",
  },
  amazonLinkButton: {
    alignSelf: "center",
  },
  amazonInfoButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  amazonInfoIcon: {
    lineHeight: 24,
    marginRight: -2,
  },
  amazonLinkText: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusIconButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  cocktailList: {
    marginHorizontal: -24,
  },
  cocktailDivider: {
    height: StyleSheet.hairlineWidth,
  },
  showMoreButton: {
    alignSelf: "center",
    marginTop: 24,
    height: 56,
    minWidth: 250,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  showMoreLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  descriptionToggleText: {
    alignSelf: "flex-start",
    fontSize: 14,
    fontWeight: "500",
    marginTop: -10,
  },
  placeholderText: {
    fontSize: 14,
    textAlign: "center",
  },
  tagList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-start",
    alignSelf: "stretch",
  },
  textBlock: {
    gap: 12,
  },
  sectionTitle: {
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
  baseIngredientRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    position: "relative",
    overflow: "hidden",
  },
  leftIndicator: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  rightIndicator: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  baseIngredientInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  baseIngredientThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
  },
  baseIngredientImage: {
    width: "100%",
    height: "100%",
  },
  baseIngredientPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  thumbFallback: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  baseIngredientName: {
    fontSize: 16,
    fontWeight: "400",
  },
  baseIngredientActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  unlinkButton: {
    padding: 6,
    borderRadius: 12,
  },
  brandedList: {
    gap: 12,
  },
  cocktailBlock: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
  },
  buttonsContainer: {
    marginTop: -4,
    gap: 24,
  },
  addButton: {
    marginTop: 12,
    alignSelf: "center",
    height: 56,
    minWidth: 250,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  addButtonLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
});
