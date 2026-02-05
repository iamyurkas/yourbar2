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

import { AppImage } from "@/components/AppImage";
import { AppDialog, type DialogOptions } from "@/components/AppDialog";
import { CocktailListRow } from "@/components/CocktailListRow";
import { PresenceCheck } from "@/components/RowParts";
import { TagPill } from "@/components/TagPill";
import { useAppColors } from "@/constants/theme";
import { isCocktailReady } from "@/libs/cocktail-availability";
import { resolveImageSource } from "@/libs/image-source";
import {
  createIngredientLookup,
  getVisibleIngredientIdsForCocktail,
} from "@/libs/ingredient-availability";
import {
  buildReturnToParams,
  getCurrentRouteKey,
  getRouteParam,
  navigateToDetailsWithReturnTo,
  parseReturnToKey,
  parseReturnToParams,
  pruneNavigationHistory,
  returnToSourceOrBack,
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

function resolveIngredientByParam(value: string | undefined, ingredients: Ingredient[]) {
  if (!value) {
    return undefined;
  }

  const numericId = Number(value);
  if (!Number.isNaN(numericId)) {
    const byId = ingredients.find((item) => Number(item.id ?? -1) === numericId);
    if (byId) {
      return byId;
    }
  }

  const normalized = normalizeSearchText(value);
  return ingredients.find(
    (item) => normalizeSearchText(item.name ?? "") === normalized,
  );
}

function resolveCocktailByKey(key: string, cocktails: { id?: number | string; name?: string | null }[]) {
  const numericId = Number(key);
  if (!Number.isNaN(numericId)) {
    const byId = cocktails.find((item) => Number(item.id ?? -1) === numericId);
    if (byId) {
      return byId;
    }
  }

  const normalized = normalizeSearchText(key);
  return cocktails.find((item) => normalizeSearchText(item.name ?? "") === normalized);
}

export default function IngredientDetailsScreen() {
  const params = useLocalSearchParams<{
    ingredientId?: string;
    returnToPath?: string;
    returnToParams?: string;
    returnToKey?: string;
  }>();
  const navigation = useNavigation();
  const Colors = useAppColors();
  const { ingredientId } = params;
  const {
    ingredients,
    cocktails,
    availableIngredientIds,
    toggleIngredientAvailability,
    shoppingIngredientIds,
    toggleIngredientShopping,
    clearBaseIngredient,
    ignoreGarnish,
    allowAllSubstitutes,
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

  const returnToKey = useMemo(
    () => parseReturnToKey(params.returnToKey),
    [params.returnToKey],
  );

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
  const [, startAvailabilityTransition] = useTransition();
  const [, startShoppingTransition] = useTransition();
  const isHandlingBackRef = useRef(false);

  const isRouteValid = useCallback(
    (route: { params?: Record<string, unknown> }) => {
      const ingredientParam = getRouteParam(route, "ingredientId");
      if (ingredientParam && !resolveIngredientByParam(ingredientParam, ingredients)) {
        return false;
      }
      const cocktailParam = getRouteParam(route, "cocktailId");
      if (cocktailParam && !resolveCocktailByKey(cocktailParam, cocktails)) {
        return false;
      }
      return true;
    },
    [cocktails, ingredients],
  );

  useEffect(() => {
    if (!ingredient && ingredientId) {
      pruneNavigationHistory(navigation, {
        isRouteValid,
        preferRouteKey: returnToKey,
      });
    }
  }, [ingredient, ingredientId, isRouteValid, navigation, returnToKey]);

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

  const brandedIngredients = useMemo(() => {
    if (numericIngredientId == null) {
      return [];
    }

    return ingredients.filter(
      (item) => Number(item.baseIngredientId ?? -1) === numericIngredientId,
    );
  }, [ingredients, numericIngredientId]);

  const baseIngredientPhotoSource = useMemo(
    () => resolveImageSource(baseIngredient?.photoUri),
    [baseIngredient?.photoUri],
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
      cocktailsWithIngredient.map((cocktail) => ({
        cocktail,
        isReady: isCocktailReady(
          cocktail,
          availableIngredientIds,
          ingredientLookup,
          undefined,
          { ignoreGarnish, allowAllSubstitutes },
        ),
      })),
    [
      allowAllSubstitutes,
      availableIngredientIds,
      cocktailsWithIngredient,
      ignoreGarnish,
      ingredientLookup,
    ],
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
    const returnToKey = getCurrentRouteKey(navigation);
    if (!ingredient) {
      router.push({
        pathname: "/cocktails/create",
        params: returnToKey ? { returnToKey } : undefined,
      });
      return;
    }

    const targetId = ingredient.id ?? ingredient.name;
    const params: Record<string, string> = { source: "ingredient" };
    if (targetId != null) {
      params.ingredientId = String(targetId);
    }
    if (ingredient.name) {
      params.ingredientName = ingredient.name;
    }

    router.push({
      pathname: "/cocktails/create",
      params: {
        ...params,
        ...(returnToKey ? { returnToKey } : {}),
      },
    });
  }, [ingredient, navigation]);

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
        const returnToKey = getCurrentRouteKey(navigation);
        navigateToDetailsWithReturnTo({
          pathname: "/cocktails/[cocktailId]",
          params: {
            cocktailId: String(cocktailId),
          },
          returnToPath: "/ingredients/[ingredientId]",
          returnToParams: { ingredientId: String(returnIngredientId) },
          returnToKey,
        });
        return;
      }

      router.push({
        pathname: "/cocktails/[cocktailId]",
        params: { cocktailId: String(cocktailId) },
      });
    },
    [ingredient?.id, ingredient?.name, ingredientId, navigation],
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

  const handleShowMoreCocktails = useCallback(() => {
    setVisibleCocktailCount((previous) =>
      Math.min(previous + COCKTAIL_PAGE_SIZE, cocktailEntries.length),
    );
  }, [cocktailEntries.length]);

  const handleReturn = useCallback(() => {
    returnToSourceOrBack(navigation, {
      returnToKey,
      returnToPath,
      returnToParams,
      isRouteValid,
    });
  }, [isRouteValid, navigation, returnToKey, returnToParams, returnToPath]);

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
            fontSize: 16,
            fontWeight: "600",
          },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={handleReturn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.headerButton}
              hitSlop={8}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={22}
                color={Colors.onSurface}
              />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={handleEditPress}
              accessibilityRole="button"
              accessibilityLabel="Edit ingredient"
              style={styles.headerButton}
              hitSlop={8}
            >
              <MaterialCommunityIcons
                name="pencil-outline"
                size={20}
                color={Colors.onSurface}
              />
            </Pressable>
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
                    color={
                      effectiveIsOnShoppingList
                        ? Colors.tint
                        : Colors.onSurfaceVariant
                    }
                  />
                </Pressable>
                <PresenceCheck
                  checked={effectiveIsAvailable}
                  onToggle={handleToggleAvailability}
                />
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
                <View style={styles.instructionsList}>
                  {isDescriptionExpanded
                    ? descriptionParagraphs.map((paragraph, index) => (
                        <Text
                          key={`description-${index}`}
                          style={[
                            styles.instructionsText,
                            { color: Colors.onSurface },
                          ]}
                        >
                          {paragraph}
                        </Text>
                      ))
                    : descriptionParagraphs.slice(0, 1).map((paragraph, index) => (
                        <Text
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
                        </Text>
                      ))}
                </View>
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
                      style={[styles.toggleDescription, { color: Colors.tint }]}
                    >
                      {isDescriptionExpanded ? "Show less" : "Show more"}
                    </Text>
                  </Pressable>
                ) : null}
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
                        ></View>
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
                                <MaterialCommunityIcons
                                  name="image-off"
                                  size={20}
                                  color={Colors.onSurfaceVariant}
                                />
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
                    ({ cocktail, isReady }, index) => {
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
                            availableIngredientIds={availableIngredientIds}
                            ingredientLookup={ingredientLookup}
                            ignoreGarnish={ignoreGarnish}
                            allowAllSubstitutes={allowAllSubstitutes}
                            onPress={() =>
                              handleNavigateToCocktail(
                                cocktail.id ?? cocktail.name,
                              )
                            }
                            highlightColor={
                              isReady ? undefined : Colors.highlightFaint
                            }
                            showMethodIcons
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
                        Show more
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
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  section: {
    gap: 24,
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
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    width: "100%",
    justifyContent: "flex-end",
    gap: 16,
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
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  showMoreLabel: {
    fontSize: 14,
    fontWeight: "600",
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
  toggleDescription: {
    fontSize: 14,
    fontWeight: "500",
  },
  baseIngredientRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
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
  addButton: {
    marginTop: 12,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
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
