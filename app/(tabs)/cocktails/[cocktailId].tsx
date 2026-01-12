import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resolveGlasswareUriFromId } from '@/assets/image-manifest';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { ListRow, Thumb } from '@/components/RowParts';
import { TagPill } from '@/components/TagPill';
import { getCocktailMethodById, METHOD_ICON_MAP } from '@/constants/cocktail-methods';
import { COCKTAIL_UNIT_DICTIONARY } from '@/constants/cocktail-units';
import { Colors } from '@/constants/theme';
import { resolveImageSource } from '@/libs/image-source';
import {
  createIngredientLookup,
  resolveIngredientAvailability,
  type IngredientLookup,
} from '@/libs/ingredient-availability';
import {
  useInventory,
  type Cocktail,
} from '@/providers/inventory-provider';
import { palette as appPalette } from '@/theme/theme';

type RecipeIngredient = NonNullable<Cocktail['ingredients']>[number];

const METRIC_UNIT_ID = 11;
const IMPERIAL_UNIT_ID = 12;
const GRAM_UNIT_ID = 8;
const UNIT_CONVERSION_RATIO = 30;

const GLASS_LABELS: Record<string, string> = {
  bowl: 'Punch bowl',
  champagne_flute: 'Champagne flute',
  cocktail_glass: 'Cocktail glass',
  collins_glass: 'Collins glass',
  copper_mug: 'Copper mug',
  coupe: 'Coupe glass',
  cup: 'Cup',
  goblet: 'Goblet',
  highball_glass: 'Highball glass',
  hurricane_glass: 'Hurricane glass',
  irish_coffee_glass: 'Irish coffee glass',
  margarita_glass: 'Margarita glass',
  nick_and_nora: 'Nick & Nora glass',
  pitcher: 'Pitcher',
  pub_glass: 'Pub glass',
  rocks_glass: 'Rocks glass',
  shooter: 'Shooter glass',
  snifter: 'Snifter',
  tiki: 'Tiki mug',
  wine_glass: 'Wine glass',
};

const MAX_RATING = 5;

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

  const normalized = param.toLowerCase();
  return cocktails.find((item) => item.name?.toLowerCase() === normalized);
}

function formatAmount(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }

  return Number(rounded.toFixed(2)).toString();
}

const IMPERIAL_FRACTIONS: { decimal: number; glyph: string }[] = [
  { decimal: 0.1, glyph: '⅒' },
  { decimal: 0.111, glyph: '⅑' },
  { decimal: 0.125, glyph: '⅛' },
  { decimal: 0.143, glyph: '⅐' },
  { decimal: 0.167, glyph: '⅙' },
  { decimal: 0.2, glyph: '⅕' },
  { decimal: 0.25, glyph: '¼' },
  { decimal: 0.333, glyph: '⅓' },
  { decimal: 0.375, glyph: '⅜' },
  { decimal: 0.4, glyph: '⅖' },
  { decimal: 0.5, glyph: '½' },
  { decimal: 0.6, glyph: '⅗' },
  { decimal: 0.625, glyph: '⅝' },
  { decimal: 0.667, glyph: '⅔' },
  { decimal: 0.75, glyph: '¾' },
  { decimal: 0.8, glyph: '⅘' },
  { decimal: 0.833, glyph: '⅚' },
  { decimal: 0.875, glyph: '⅞' },
];

function formatOunceAmount(value: number): string {
  const normalized = Math.round(value * 100) / 100;
  const wholeNumberPortion = Math.trunc(normalized);
  const fractionalPortion = Math.abs(normalized - wholeNumberPortion);

  const matchedFraction = IMPERIAL_FRACTIONS.reduce<
    { fraction: (typeof IMPERIAL_FRACTIONS)[number]; difference: number } | undefined
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

  if (useImperialUnits && (unitId === METRIC_UNIT_ID || unitId === GRAM_UNIT_ID)) {
    return { value: amount / UNIT_CONVERSION_RATIO, unitId: IMPERIAL_UNIT_ID };
  }

  if (!useImperialUnits && unitId === IMPERIAL_UNIT_ID) {
    return { value: amount * UNIT_CONVERSION_RATIO, unitId: METRIC_UNIT_ID };
  }

  return { value: amount, unitId };
}

function formatIngredientQuantity(ingredient: RecipeIngredient, useImperialUnits: boolean): string {
  const amountRaw = ingredient.amount ?? '';
  const amount = amountRaw.trim();
  const hasAmount = amount.length > 0;
  const unitId = typeof ingredient.unitId === 'number' ? ingredient.unitId : undefined;
  const parsedAmount = Number(amount);
  const isNumeric = hasAmount && !Number.isNaN(parsedAmount);

  let displayAmount = amount;
  let displayUnitId = unitId;
  let numericAmount: number | undefined;

  if (isNumeric) {
    const { value, unitId: nextUnitId } = convertIngredientAmount(parsedAmount, unitId, useImperialUnits);
    numericAmount = value;
    displayUnitId = nextUnitId;

    if (useImperialUnits && displayUnitId === IMPERIAL_UNIT_ID) {
      displayAmount = formatOunceAmount(value);
    } else {
      displayAmount = formatAmount(value);
    }
  }

  const unitDetails = displayUnitId != null ? COCKTAIL_UNIT_DICTIONARY[displayUnitId] : undefined;

  let unitText = '';
  if (unitDetails) {
    const isSingular = numericAmount == null || numericAmount === 1;
    unitText = isSingular ? unitDetails.singular : unitDetails.plural ?? unitDetails.singular;
  }

  if (!displayAmount && !unitText) {
    return 'As needed';
  }

  if (!displayAmount && unitText) {
    return unitText;
  }

  if (unitText) {
    return `${displayAmount} ${unitText}`;
  }

  return displayAmount;
}

function getIngredientQualifier(ingredient: RecipeIngredient): string | undefined {
  const qualifiers: string[] = [];

  if (ingredient.garnish) {
    qualifiers.push('garnish');
  }

  if (ingredient.optional) {
    qualifiers.push('optional');
  }

  return qualifiers.join(', ') || undefined;
}

function formatGlassLabel(glassId?: string | null) {
  if (!glassId) {
    return undefined;
  }

  return (
    GLASS_LABELS[glassId] ??
    glassId
      .split(/[_\s]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );
}

export default function CocktailDetailsScreen() {
  const palette = Colors;
  const params = useLocalSearchParams<{
    cocktailId?: string;
    returnToPath?: string;
    returnToParams?: string;
  }>();
  const navigation = useNavigation();
  const { cocktailId } = params;
  const {
    cocktails,
    ingredients,
    availableIngredientIds,
    shoppingIngredientIds,
    setCocktailRating,
    getCocktailRating,
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

  const returnToPath = useMemo(() => {
    const value = Array.isArray(params.returnToPath) ? params.returnToPath[0] : params.returnToPath;
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }, [params.returnToPath]);

  const returnToParams = useMemo(() => {
    const value = Array.isArray(params.returnToParams) ? params.returnToParams[0] : params.returnToParams;
    if (typeof value !== 'string' || value.length === 0) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return undefined;
      }

      const entries = Object.entries(parsed).filter(([, entryValue]) => typeof entryValue === 'string');
      return entries.length ? Object.fromEntries(entries) : undefined;
    } catch (error) {
      console.warn('Failed to parse return params', error);
      return undefined;
    }
  }, [params.returnToParams]);

  const [showImperialUnits, setShowImperialUnits] = useState(useImperialUnits);

  useEffect(() => {
    setShowImperialUnits(useImperialUnits);
  }, [useImperialUnits]);

  const handleReturn = useCallback(() => {
    if (returnToPath) {
      router.navigate({ pathname: returnToPath, params: returnToParams });
      return;
    }

    router.back();
  }, [returnToParams, returnToPath]);

  useEffect(() => {
    if (!returnToPath) {
      return undefined;
    }

    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      event.preventDefault();
      handleReturn();
    });

    return unsubscribe;
  }, [handleReturn, navigation, returnToPath]);

  useEffect(() => {
    const keepAwakeTag = 'cocktail-details';

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
    return [...recipe].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
  }, [cocktail?.ingredients]);

  const resolvedIngredients = useMemo(
    () =>
      sortedIngredients.map((ingredient) =>
        resolveIngredientAvailability(ingredient, availableIngredientIds, ingredientLookup, {
          ignoreGarnish,
          allowAllSubstitutes,
        }),
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
    if (typeof ingredientIdRaw === 'number') {
      return ingredientIdRaw;
    }

    if (typeof ingredientIdRaw === 'string') {
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

  useEffect(() => {
    setOptimisticRating((previous) => {
      if (previous == null) {
        return previous;
      }

      return previous === userRating ? null : previous;
    });
  }, [userRating]);

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

  const ingredientHighlightColor = appPalette.highlightFaint;

  const photoSource = useMemo(
    () => resolveImageSource(cocktail?.photoUri),
    [cocktail?.photoUri],
  );

  const glassUri = useMemo(() => resolveGlasswareUriFromId(cocktail?.glassId), [cocktail?.glassId]);

  const glassSource = useMemo(() => resolveImageSource(glassUri), [glassUri]);

  const displayedImageSource = photoSource ?? glassSource;
  const glassLabel = useMemo(() => formatGlassLabel(cocktail?.glassId), [cocktail?.glassId]);
  const methodDetails = useMemo(() => {
    if (!cocktail) {
      return [];
    }

    const legacyMethodId = (cocktail as { methodId?: string | null }).methodId ?? null;
    const nextMethodIds =
      cocktail.methodIds && cocktail.methodIds.length > 0
        ? cocktail.methodIds
        : legacyMethodId
          ? [legacyMethodId]
          : [];
    return nextMethodIds.map((id) => getCocktailMethodById(id)).filter(Boolean);
  }, [cocktail]);

  const [expandedMethodIds, setExpandedMethodIds] = useState<string[]>([]);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [shouldTruncateDescription, setShouldTruncateDescription] = useState(false);

  const handleDescriptionLayout = useCallback(
    (event: { nativeEvent: { lines: { length: number }[] } }) => {
      if (shouldTruncateDescription) {
        return;
      }

      if (event.nativeEvent.lines.length > 5) {
        setShouldTruncateDescription(true);
      }
    },
    [shouldTruncateDescription],
  );

  const toggleDescription = useCallback(() => {
    setIsDescriptionExpanded((current) => !current);
  }, []);

  const handleToggleUnits = useCallback(() => {
    setShowImperialUnits((current) => !current);
  }, []);

  const toggleMethodDescription = useCallback((methodId: string) => {
    setExpandedMethodIds((current) =>
      current.includes(methodId) ? current.filter((id) => id !== methodId) : [...current, methodId],
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
      pathname: '/cocktails/create',
      params: {
        cocktailId: String(targetId),
        cocktailName: cocktail.name ?? undefined,
        mode: 'edit',
        source: 'cocktails',
      },
    });
  }, [cocktail]);

  const handleCopyPress = useCallback(() => {
    if (!cocktail) {
      return;
    }

    const targetId = cocktail.id ?? cocktail.name;
    if (!targetId) {
      return;
    }

    router.push({
      pathname: '/cocktails/create',
      params: {
        cocktailId: String(targetId),
        cocktailName: cocktail.name ?? undefined,
        source: 'cocktails',
      },
    });
  }, [cocktail]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
      edges={['left', 'right']}>
      <Stack.Screen
        options={{
          title: 'Cocktail details',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: palette.surface },
          headerTitleStyle: { color: palette.onSurface, fontSize: 16, fontWeight: '600' },
          headerShadowVisible: false,
          headerLeft: () => (
            <HeaderIconButton onPress={() => router.back()} accessibilityLabel="Go back">
              <MaterialCommunityIcons name="arrow-left" size={22} color={palette.onSurface} />
            </HeaderIconButton>
          ),
          headerRight: () => (
            <View style={styles.headerActions}>
              <HeaderIconButton onPress={handleCopyPress} accessibilityLabel="Copy cocktail">
                <MaterialCommunityIcons name="content-copy" size={20} color={palette.onSurface} />
              </HeaderIconButton>
              <HeaderIconButton onPress={handleEditPress} accessibilityLabel="Edit cocktail">
                <MaterialCommunityIcons name="pencil-outline" size={20} color={palette.onSurface} />
              </HeaderIconButton>
            </View>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {cocktail ? (
          <View style={styles.section}>
            <Text style={[styles.name, { color: palette.onSurface }]}>{cocktail.name}</Text>

            <View style={styles.mediaSection}>
              <View style={styles.photoWrapper}>
                {displayedImageSource ? (
                  <Image
                    source={displayedImageSource}
                    style={styles.photo}
                    contentFit="contain"
                  />
                ) : (
                  <View
                    style={[
                      styles.photoPlaceholder,
                      { borderColor: palette.outline },
                    ]}>
                    <MaterialCommunityIcons name="image-off" size={36} color={palette.onSurfaceVariant} />
                    <Text style={[styles.photoPlaceholderText, { color: palette.onSurfaceVariant }]}>No photo</Text>
                  </View>
                )}
              </View>

              <View style={styles.ratingRow}>
                {Array.from({ length: MAX_RATING }).map((_, index) => {
                  const starValue = index + 1;
                  const isActive = displayedRating >= starValue;
                  const icon = isActive ? 'star' : 'star-outline';

                  return (
                    <Pressable
                      key={`rating-star-${starValue}`}
                      onPress={() => handleRatingSelect(starValue)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        displayedRating === starValue
                          ? 'Clear rating'
                          : `Set rating to ${starValue}`
                      }
                      style={styles.ratingStar}
                      hitSlop={8}>
                      <MaterialCommunityIcons name={icon} size={32} color={palette.tint} />
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={handleToggleUnits}
                style={[
                  styles.toggleUnitsButton,
                  { borderColor: palette.primary, backgroundColor: palette.surfaceBright },
                ]}
                accessibilityRole="button"
                accessibilityLabel={showImperialUnits ? 'Show in metric' : 'Show in imperial'}
              >
                <Text style={[styles.toggleUnitsLabel, { color: palette.primary }]}>
                  {showImperialUnits ? 'Show in metric' : 'Show in imperial'}
                </Text>
              </Pressable>

              {photoSource && glassSource && glassLabel ? (
                <View style={styles.glassInfo}>
                  <View style={styles.glassImageWrapper}>
                    <Image source={glassSource} style={styles.glassImage} contentFit="contain" />
                  </View>
                  <Text style={[styles.glassLabel, { color: palette.onSurface }]}>{glassLabel}</Text>
                </View>
              ) : null}
            </View>

            {methodDetails.length ? (
              <View style={styles.methodList}>
                {methodDetails.map((method) => {
                  const icon = METHOD_ICON_MAP[method.id];
                  const isExpanded = expandedMethodIds.includes(method.id);
                  return (
                    <View key={method.id} style={styles.methodEntry}>
                      <View style={styles.methodHeader}>
                        <View style={styles.methodIconWrapper}>
                          {icon?.type === 'asset' ? (
                            <Image source={icon.source} style={styles.methodIcon} contentFit="contain" />
                          ) : (
                            <MaterialCommunityIcons
                              name={icon?.type === 'icon' ? icon.name : 'information-outline'}
                              size={18}
                              color={palette.onSurfaceVariant}
                            />
                          )}
                        </View>
                        <Text style={[styles.methodLabel, { color: palette.onSurface }]}>
                          {method.label}
                        </Text>
                        <Pressable
                          onPress={() => toggleMethodDescription(method.id)}
                          accessibilityRole="button"
                          accessibilityLabel={
                            isExpanded
                              ? `Hide ${method.label} description`
                              : `Show ${method.label} description`
                          }
                          hitSlop={8}
                        >
                          <Text style={[styles.methodInfoIcon, { color: palette.primary }]}>ⓘ</Text>
                        </Pressable>
                      </View>
                      {isExpanded ? (
                        <Text style={[styles.methodDescription, { color: palette.onSurfaceVariant }]}>
                          {method.description}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}

            {cocktail.tags && cocktail.tags.length ? (
              <View style={styles.tagList}>
                {cocktail.tags.map((tag) => (
                  <TagPill
                    key={tag.id ?? tag.name}
                    label={tag.name ?? 'Tag'}
                    color={tag.color ?? palette.tint}
                    selected
                    accessibilityLabel={tag.name ?? 'Tag'}
                  />
                ))}
              </View>
            ) : null}

            {cocktail.description ? (
              <View style={styles.textBlock}>
                <Text
                  style={[styles.bodyText, styles.descriptionText, { color: palette.onSurfaceVariant }]}
                  numberOfLines={!isDescriptionExpanded && shouldTruncateDescription ? 5 : undefined}
                  onTextLayout={handleDescriptionLayout}
                >
                  {cocktail.description}
                </Text>
                {shouldTruncateDescription ? (
                  <Pressable onPress={toggleDescription} accessibilityRole="button">
                    <Text style={[styles.toggleDescription, { color: palette.tint }]}>
                      {isDescriptionExpanded ? 'Show less' : 'Show more'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {instructionsParagraphs.length ? (
              <View style={styles.textBlock}>
                <Text style={[styles.instructionsTitle, { color: palette.onSurface }]}>Instructions</Text>
                <View style={styles.instructionsList}>
                  {instructionsParagraphs.map((paragraph, index) => (
                    <Text
                      key={`instruction-${index}`}
                      style={[styles.instructionsText, { color: palette.onSurface }]}
                    >
                      {paragraph}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}

            {sortedIngredients.length ? (
              <View style={styles.textBlock}>
                <Text style={[styles.sectionTitle, { color: palette.onSurface }]}>Ingredients</Text>
                <View style={styles.ingredientsList}>
                  {sortedIngredients.map((ingredient, index) => {
                    const quantity = formatIngredientQuantity(ingredient, showImperialUnits);
                    const qualifier = getIngredientQualifier(ingredient);
                    const key = `${ingredient.ingredientId ?? ingredient.name}-${ingredient.order}`;
                    const resolution = resolvedIngredients[index];
                    const ingredientId = parseIngredientId(ingredient);
                    const resolvedId = resolution.resolvedId ?? ingredientId;
                    const resolvedIngredient =
                      resolvedId != null && resolvedId >= 0
                        ? ingredientLookup.ingredientById.get(resolvedId)
                        : undefined;
                    const catalogEntry = ingredientId >= 0 ? ingredientLookup.ingredientById.get(ingredientId) : undefined;
                    const photoUri = ingredient.photoUri ?? resolvedIngredient?.photoUri ?? catalogEntry?.photoUri;
                    const previousIngredient = sortedIngredients[index - 1];
                    const previousResolution = previousIngredient ? resolvedIngredients[index - 1] : undefined;
                    const dividerColor = previousResolution?.isAvailable
                      ? palette.outline
                      : palette.outlineVariant;
                    const tagColor =
                      resolvedIngredient?.tags?.[0]?.color ??
                      ingredient.tags?.[0]?.color ??
                      catalogEntry?.tags?.[0]?.color ??
                      appPalette.tagYellow;
                    const brandIndicatorColor =
                      resolvedIngredient?.baseIngredientId != null || catalogEntry?.baseIngredientId != null
                        ? Colors.primary
                        : undefined;
                    const isOnShoppingList = ingredientId >= 0 && shoppingIngredientIds.has(ingredientId);
                    const handlePress = () => {
                      const routeParam =
                        resolvedId != null && resolvedId >= 0
                          ? resolvedId
                          : catalogEntry?.id ?? ingredient.name;
                      if (routeParam == null) {
                        return;
                      }

                      const returnToParam =
                        cocktail?.id != null ? String(cocktail.id) : resolvedParam ? String(resolvedParam) : undefined;
                      const returnToParams = returnToParam
                        ? JSON.stringify({ cocktailId: returnToParam })
                        : undefined;

                      router.push({
                        pathname: '/ingredients/[ingredientId]',
                        params: {
                          ingredientId: String(routeParam),
                          ...(returnToParams
                            ? {
                                returnToPath: '/cocktails/[cocktailId]',
                                returnToParams,
                              }
                            : {}),
                        },
                      });
                    };

                    const subtitleParts: string[] = [];

                    if (qualifier) {
                      subtitleParts.push(qualifier.charAt(0).toUpperCase() + qualifier.slice(1));
                    }

                    if (resolution.substituteFor) {
                      subtitleParts.push(`Substitute for ${resolution.substituteFor}`);
                    }

                    const subtitle = subtitleParts.length ? subtitleParts.join(' • ') : undefined;

                    return (
                      <View key={key}>
                        {index > 0 ? (
                          <View style={[styles.ingredientDivider, { backgroundColor: dividerColor }]} />
                        ) : null}
                        <ListRow
                          title={resolution.resolvedName || ingredient.name || ''}
                          subtitle={subtitle}
                          subtitleStyle={
                            subtitle
                              ? [styles.ingredientSubtitle, { color: palette.onSurfaceVariant }]
                              : undefined
                          }
                          thumbnail={
                            <Thumb
                              label={resolution.resolvedName ?? ingredient.name ?? undefined}
                              uri={photoUri}
                              fallbackUri={catalogEntry?.photoUri}
                            />
                          }
                          control={
                            <View style={styles.quantityContainer}>
                              <Text
                                style={[styles.quantityLabel, { color: palette.onSurfaceVariant }]}
                                numberOfLines={1}>
                                {quantity}
                              </Text>
                            </View>
                          }
                          metaFooter={
                            isOnShoppingList ? (
                              <MaterialIcons
                                name="shopping-cart"
                                size={16}
                                color={palette.tint}
                                style={styles.shoppingIcon}
                                accessibilityRole="image"
                                accessibilityLabel="On shopping list"
                              />
                            ) : (
                              <View style={styles.shoppingIconPlaceholder} />
                            )
                          }
                          onPress={handlePress}
                          selected={resolution.isAvailable}
                          highlightColor={ingredientHighlightColor}
                          tagColor={tagColor}
                          brandIndicatorColor={brandIndicatorColor}
                          accessibilityRole="button"
                          accessibilityState={resolution.isAvailable ? { selected: true } : undefined}
                          metaAlignment="center"
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="glass-cocktail" size={42} color={palette.onSurfaceVariant} />
            <Text style={[styles.emptyText, { color: palette.onSurfaceVariant }]}>Cocktail not found</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    fontWeight: '700',
    textAlign: 'center',
  },
  mediaSection: {
    gap: 16,
    alignItems: 'center',
  },
  photoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  photo: {
    width: 150,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceBright,
  },
  photoPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceBright,
  },
  photoPlaceholderText: {
    fontSize: 14,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  ratingStar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleUnitsButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
  },
  toggleUnitsLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  glassInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'flex-start',
  },
  glassImageWrapper: {
    width: 48,
    height: 48,
  },
  glassImage: {
    width: '100%',
    height: '100%',
  },
  glassLabel: {
    fontSize: 16,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 8,
    alignSelf: 'stretch',
  },
  methodList: {
    gap: 12,
    alignSelf: 'stretch',
  },
  textBlock: {
    gap: 12,
  },
  methodEntry: {
    gap: 6,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  methodIconWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodIcon: {
    width: 18,
    height: 18,
  },
  methodLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  methodInfoIcon: {
    fontSize: 16,
    fontWeight: '600',
  },
  methodDescription: {
    fontSize: 13,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
  },
  descriptionText: {
    color: Colors.onSurfaceMuted,
  },
  toggleDescription: {
    fontSize: 14,
    fontWeight: '500',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 22,
  },
  instructionsList: {
    gap: 8,
  },
  ingredientsList: {
    marginHorizontal: -24,
  },
  ingredientDivider: {
    height: StyleSheet.hairlineWidth,
  },
  quantityContainer: {
    minWidth: 88,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  quantityLabel: {
    fontSize: 14,
    textAlign: 'right',
  },
  ingredientSubtitle: {
    fontSize: 12,
  },
  shoppingIcon: {
    width: 16,
    height: 16,
    alignSelf: 'flex-end',
  },
  shoppingIconPlaceholder: {
    width: 16,
    height: 16,
    alignSelf: 'flex-end',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 80,
  },
  emptyText: {
    fontSize: 14,
  },
});
