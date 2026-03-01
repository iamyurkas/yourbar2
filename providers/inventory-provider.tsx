import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BUILTIN_COCKTAIL_TAGS } from '@/constants/cocktail-tags';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import { TAG_COLORS } from '@/constants/tag-colors';
import { AMAZON_STORES, detectAmazonStoreFromStoreOrLocale, detectUsStorefrontOrLocale, getEffectiveAmazonStore, type AmazonStoreKey, type AmazonStoreOverride } from '@/libs/amazon-stores';
import { DEFAULT_LOCALE, isSupportedLocale } from '@/libs/i18n';
import type { SupportedLocale } from '@/libs/i18n/types';
import { localizeCocktails, localizeIngredients } from '@/libs/i18n/catalog-overlay';
import { loadInventoryData, reloadInventoryData } from '@/libs/inventory-data';
import {
  loadInventorySnapshot,
  persistInventorySnapshot,
} from '@/libs/inventory-storage';
import {
  areStorageRecordsEqual,
  hydrateInventoryTagsFromCode,
  normalizePhotoUriForBackup,
  normalizeSearchFields,
  normalizeSynonyms,
  normalizeTagIds,
  toCocktailStorageRecord,
  toIngredientStorageRecord,
} from '@/libs/inventory-utils';
import { normalizeSearchText } from '@/libs/search-normalization';
import { compareGlobalAlphabet, compareOptionalGlobalAlphabet } from '@/libs/global-sort';
import {
  type AppLocale,
  type AppTheme,
  type BaseCocktailRecord,
  type Cocktail,
  type CocktailIngredient,
  type CocktailStorageRecord,
  type CocktailSubstitute,
  type CocktailTag,
  type CocktailTranslationOverride,
  type CreateCocktailInput,
  type CreateIngredientInput,
  type Ingredient,
  type IngredientStorageRecord,
  type IngredientTag,
  type IngredientTranslationOverride,
  type InventoryBaseExportFile,
  type InventoryExportData,
  type InventoryExportFile,
  type InventoryLocaleTranslationOverrides,
  type InventoryTranslationOverrides,
  type InventoryTranslationsExportFile,
  type PhotoBackupEntry,
  type ImportedPhotoEntry,
  type StartScreen,
} from '@/providers/inventory-types';
import {
  InventoryActionsContext,
  useInventoryActions,
} from '@/providers/inventory/inventory-actions-context';
import {
  InventoryDataContext,
  useInventoryData,
} from '@/providers/inventory/inventory-data-context';
import {
  InventorySettingsContext,
  useInventorySettings,
} from '@/providers/inventory/inventory-settings-context';
import {
  createInventoryStateFromData,
  createInventoryStateFromSnapshot,
  type InventoryState,
} from '@/providers/inventory/model/inventory-state';
import {
  buildInventoryDelta,
  buildInventorySnapshot,
  createInventoryBaseMaps,
  INVENTORY_SNAPSHOT_VERSION,
  sanitizeCocktailRatings,
} from '@/providers/inventory/persistence/inventory-snapshot';

const DEFAULT_START_SCREEN: StartScreen = 'cocktails_all';
const DEFAULT_APP_THEME: AppTheme = 'light';
const DEFAULT_APP_LOCALE: AppLocale = DEFAULT_LOCALE;

declare global {
  // eslint-disable-next-line no-var
  var __yourbarInventory: InventoryState | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryAvailableIngredientIds: Set<number> | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryShoppingIngredientIds: Set<number> | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryCocktailRatings: Record<string, number> | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryIgnoreGarnish: boolean | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryAllowAllSubstitutes: boolean | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryUseImperialUnits: boolean | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryKeepScreenAwake: boolean | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryShakerSmartFilteringEnabled: boolean | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryRatingFilterThreshold: number | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryStartScreen: StartScreen | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryAppTheme: AppTheme | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryAppLocale: AppLocale | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryAmazonStoreOverride: AmazonStoreOverride | null | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryCustomCocktailTags: CocktailTag[] | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryCustomIngredientTags: IngredientTag[] | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryOnboardingStep: number | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryOnboardingCompleted: boolean | undefined;
}

function createIngredientIdSet(values?: readonly number[] | null): Set<number> {
  if (!values || values.length === 0) {
    return new Set<number>();
  }

  const sanitized = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.trunc(value));

  return new Set(sanitized);
}

function sanitizeStartScreen(value?: string | null): StartScreen {
  switch (value) {
    case 'cocktails_all':
    case 'cocktails_my':
    case 'cocktails_favorites':
    case 'shaker':
    case 'ingredients_all':
    case 'ingredients_my':
    case 'ingredients_shopping':
      return value;
    default:
      return DEFAULT_START_SCREEN;
  }
}

const BUILTIN_COCKTAIL_TAGS_BY_ID = new Map<number, (typeof BUILTIN_COCKTAIL_TAGS)[number]>(BUILTIN_COCKTAIL_TAGS.map((tag) => [tag.id, tag]));
const BUILTIN_INGREDIENT_TAGS_BY_ID = new Map<number, (typeof BUILTIN_INGREDIENT_TAGS)[number]>(BUILTIN_INGREDIENT_TAGS.map((tag) => [tag.id, tag]));

function rehydrateBuiltInTags(state: InventoryState): InventoryState {
  const withHydratedCocktailTags = state.cocktails.map((cocktail) => ({
    ...cocktail,
    tags: cocktail.tags?.map((tag) => {
      const builtinTag = BUILTIN_COCKTAIL_TAGS_BY_ID.get(Number(tag.id ?? -1));
      return builtinTag
        ? {
            ...tag,
            id: builtinTag.id,
            name: builtinTag.name,
            color: builtinTag.color,
          }
        : tag;
    }),
  }));

  const withHydratedIngredientTags = state.ingredients.map((ingredient) => ({
    ...ingredient,
    tags: ingredient.tags?.map((tag) => {
      const builtinTag = BUILTIN_INGREDIENT_TAGS_BY_ID.get(Number(tag.id ?? -1));
      return builtinTag
        ? {
            ...tag,
            id: builtinTag.id,
            name: builtinTag.name,
            color: builtinTag.color,
          }
        : tag;
    }),
  }));

  return {
    ...state,
    cocktails: withHydratedCocktailTags,
    ingredients: withHydratedIngredientTags,
  };
}

function sanitizeAppTheme(value?: string | null): AppTheme {
  switch (value) {
    case 'light':
    case 'dark':
    case 'system':
      return value;
    default:
      return DEFAULT_APP_THEME;
  }
}



function sanitizeAppLocale(value?: string | null): AppLocale {
  return isSupportedLocale(value) ? value : DEFAULT_APP_LOCALE;
}

function sanitizeAmazonStoreOverride(value?: string | null): AmazonStoreOverride | null {
  if (!value) {
    return null;
  }

  const normalized = value.toUpperCase();
  if (normalized === 'DISABLED') {
    return 'DISABLED';
  }

  return normalized in AMAZON_STORES ? (normalized as AmazonStoreKey) : null;
}

const DEFAULT_TAG_COLOR = TAG_COLORS[0];
const BUILTIN_COCKTAIL_TAG_MAX = BUILTIN_COCKTAIL_TAGS.reduce((max, tag) => Math.max(max, tag.id), 0);
const BUILTIN_INGREDIENT_TAG_MAX = BUILTIN_INGREDIENT_TAGS.reduce((max, tag) => Math.max(max, tag.id), 0);
const USER_CREATED_ID_START = 10000;

function sanitizeCustomTags<TTag extends { id?: number | null; name?: string | null; color?: string | null }>(
  tags: readonly TTag[] | null | undefined,
  fallbackColor: string,
): Array<{ id: number; name: string; color: string }> {
  if (!tags || tags.length === 0) {
    return [];
  }

  const map = new Map<number, { id: number; name: string; color: string }>();

  tags.forEach((tag) => {
    const rawId = Number(tag.id ?? -1);
    if (!Number.isFinite(rawId) || rawId < 0) {
      return;
    }

    const name = tag.name?.trim();
    if (!name) {
      return;
    }

    const color = typeof tag.color === 'string' && tag.color.trim() ? tag.color : fallbackColor;
    map.set(rawId, { id: Math.trunc(rawId), name, color });
  });

  return Array.from(map.values()).sort((a, b) => compareGlobalAlphabet(a.name, b.name));
}


function sanitizeTranslationOverrides(value: unknown): InventoryTranslationOverrides {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const result: InventoryTranslationOverrides = {};
  (Object.entries(value as Record<string, unknown>)).forEach(([locale, localeValue]) => {
    if (!isSupportedLocale(locale) || !localeValue || typeof localeValue !== 'object') {
      return;
    }

    const localeRecord = localeValue as Record<string, unknown>;
    const cocktails = localeRecord.cocktails;
    const ingredients = localeRecord.ingredients;
    const nextLocale: InventoryLocaleTranslationOverrides = {};
    if (cocktails && typeof cocktails === 'object') {
      nextLocale.cocktails = cocktails as Record<string, any>;
    }
    if (ingredients && typeof ingredients === 'object') {
      nextLocale.ingredients = ingredients as Record<string, any>;
    }

    result[locale] = nextLocale;
  });

  return result;
}

function getNextCustomTagId(tags: readonly { id?: number | null }[], minimum: number): number {
  const maxId = tags.reduce((max, tag) => {
    const id = Number(tag.id ?? -1);
    if (!Number.isFinite(id) || id < 0) {
      return max;
    }
    return Math.max(max, Math.trunc(id));
  }, minimum);

  return maxId + 1;
}

type InventoryProviderProps = {
  children: React.ReactNode;
};

export function InventoryProvider({ children }: InventoryProviderProps) {
  const baseMaps = useMemo(() => createInventoryBaseMaps(loadInventoryData()), []);
  const baseInventoryData = baseMaps.baseData;
  const [inventoryState, setInventoryState] = useState<InventoryState | undefined>(
    () => globalThis.__yourbarInventory,
  );
  const [loading, setLoading] = useState<boolean>(() => !globalThis.__yourbarInventory);
  const [availableIngredientIds, setAvailableIngredientIds] = useState<Set<number>>(() =>
    globalThis.__yourbarInventoryAvailableIngredientIds
      ? new Set(globalThis.__yourbarInventoryAvailableIngredientIds)
      : new Set(),
  );
  const [shoppingIngredientIds, setShoppingIngredientIds] = useState<Set<number>>(() =>
    globalThis.__yourbarInventoryShoppingIngredientIds
      ? new Set(globalThis.__yourbarInventoryShoppingIngredientIds)
      : new Set(),
  );
  const [ratingsByCocktailId, setRatingsByCocktailId] = useState<Record<string, number>>(() =>
    sanitizeCocktailRatings(globalThis.__yourbarInventoryCocktailRatings),
  );
  const [ignoreGarnish, setIgnoreGarnish] = useState<boolean>(
    () => globalThis.__yourbarInventoryIgnoreGarnish ?? true,
  );
  const [allowAllSubstitutes, setAllowAllSubstitutes] = useState<boolean>(
    () => globalThis.__yourbarInventoryAllowAllSubstitutes ?? true,
  );
  const shouldDefaultToImperialUnits = useMemo(() => detectUsStorefrontOrLocale(), []);
  const [useImperialUnits, setUseImperialUnits] = useState<boolean>(
    () => (globalThis.__yourbarInventoryUseImperialUnits ?? false) || shouldDefaultToImperialUnits,
  );
  const [keepScreenAwake, setKeepScreenAwake] = useState<boolean>(
    () => globalThis.__yourbarInventoryKeepScreenAwake ?? true,
  );
  const [shakerSmartFilteringEnabled, setShakerSmartFilteringEnabled] = useState<boolean>(
    () => globalThis.__yourbarInventoryShakerSmartFilteringEnabled ?? false,
  );
  const [ratingFilterThreshold, setRatingFilterThreshold] = useState<number>(() =>
    typeof globalThis.__yourbarInventoryRatingFilterThreshold === 'number'
      ? Math.min(5, Math.max(1, Math.round(globalThis.__yourbarInventoryRatingFilterThreshold)))
      : 1,
  );
  const [startScreen, setStartScreen] = useState<StartScreen>(
    () => globalThis.__yourbarInventoryStartScreen ?? DEFAULT_START_SCREEN,
  );
  const [appTheme, setAppTheme] = useState<AppTheme>(
    () => globalThis.__yourbarInventoryAppTheme ?? DEFAULT_APP_THEME,
  );
  const [amazonStoreOverride, setAmazonStoreOverride] = useState<AmazonStoreOverride | null>(
    () => sanitizeAmazonStoreOverride(globalThis.__yourbarInventoryAmazonStoreOverride),
  );
  const [appLocale, setAppLocale] = useState<AppLocale>(
    () => sanitizeAppLocale(globalThis.__yourbarInventoryAppLocale),
  );
  const [translationOverrides, setTranslationOverrides] = useState<InventoryTranslationOverrides>({});
  const [customCocktailTags, setCustomCocktailTags] = useState<CocktailTag[]>(() =>
    sanitizeCustomTags(globalThis.__yourbarInventoryCustomCocktailTags, DEFAULT_TAG_COLOR),
  );
  const [customIngredientTags, setCustomIngredientTags] = useState<IngredientTag[]>(() =>
    sanitizeCustomTags(globalThis.__yourbarInventoryCustomIngredientTags, DEFAULT_TAG_COLOR),
  );
  const [onboardingStep, setOnboardingStep] = useState<number>(
    () => globalThis.__yourbarInventoryOnboardingStep ?? 0,
  );
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(
    () => globalThis.__yourbarInventoryOnboardingCompleted ?? false,
  );
  const detectedAmazonStore = useMemo(() => detectAmazonStoreFromStoreOrLocale(), []);
  const effectiveAmazonStore = useMemo(
    () => getEffectiveAmazonStore(amazonStoreOverride, detectedAmazonStore),
    [amazonStoreOverride, detectedAmazonStore],
  );
  const lastPersistedSnapshot = useRef<string | undefined>(undefined);
  const inventoryDelta = useMemo(
    () => (inventoryState ? buildInventoryDelta(inventoryState, baseMaps) : null),
    [inventoryState, baseMaps],
  );
  const applyInventoryBootstrap = useCallback(
    (bootstrap: {
      inventoryState: InventoryState;
      availableIngredientIds: Set<number>;
      shoppingIngredientIds: Set<number>;
      ratingsByCocktailId: Record<string, number>;
      ignoreGarnish: boolean;
      allowAllSubstitutes: boolean;
      useImperialUnits: boolean;
      keepScreenAwake: boolean;
      shakerSmartFilteringEnabled: boolean;
      ratingFilterThreshold: number;
      startScreen: StartScreen;
      appTheme: AppTheme;
      appLocale: AppLocale;
      translationOverrides: InventoryTranslationOverrides;
      amazonStoreOverride: AmazonStoreOverride | null;
      customCocktailTags: CocktailTag[];
      customIngredientTags: IngredientTag[];
      onboardingStep: number;
      onboardingCompleted: boolean;
    }) => {
      setInventoryState(bootstrap.inventoryState);
      setAvailableIngredientIds(bootstrap.availableIngredientIds);
      setShoppingIngredientIds(bootstrap.shoppingIngredientIds);
      setRatingsByCocktailId(bootstrap.ratingsByCocktailId);
      setIgnoreGarnish(bootstrap.ignoreGarnish);
      setAllowAllSubstitutes(bootstrap.allowAllSubstitutes);
      setUseImperialUnits(bootstrap.useImperialUnits);
      setKeepScreenAwake(bootstrap.keepScreenAwake);
      setShakerSmartFilteringEnabled(bootstrap.shakerSmartFilteringEnabled);
      setRatingFilterThreshold(bootstrap.ratingFilterThreshold);
      setStartScreen(bootstrap.startScreen);
      setAppTheme(bootstrap.appTheme);
      setAppLocale(bootstrap.appLocale);
      setTranslationOverrides(bootstrap.translationOverrides);
      setAmazonStoreOverride(bootstrap.amazonStoreOverride);
      setCustomCocktailTags(bootstrap.customCocktailTags);
      setCustomIngredientTags(bootstrap.customIngredientTags);
      setOnboardingStep(bootstrap.onboardingStep);
      setOnboardingCompleted(bootstrap.onboardingCompleted);
    },
    [],
  );

  useEffect(() => {
    if (inventoryState) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const stored = await loadInventorySnapshot<CocktailStorageRecord, IngredientStorageRecord>();
        if (stored && (stored.version === INVENTORY_SNAPSHOT_VERSION || stored.version === 2 || stored.version === 1) && !cancelled) {
          const nextInventoryState = rehydrateBuiltInTags(createInventoryStateFromSnapshot(stored, baseInventoryData));
          const nextAvailableIds = createIngredientIdSet(stored.availableIngredientIds);
          const nextShoppingIds = createIngredientIdSet(stored.shoppingIngredientIds);
          const nextRatings = sanitizeCocktailRatings(stored.cocktailRatings);
          const nextIgnoreGarnish = stored.ignoreGarnish ?? true;
          const nextAllowAllSubstitutes = stored.allowAllSubstitutes ?? true;
          const nextUseImperialUnits = (stored.useImperialUnits ?? false) || shouldDefaultToImperialUnits;
          const nextKeepScreenAwake = stored.keepScreenAwake ?? true;
          const nextShakerSmartFilteringEnabled = stored.shakerSmartFilteringEnabled ?? false;
          const nextRatingFilterThreshold = Math.min(
            5,
            Math.max(1, Math.round(stored.ratingFilterThreshold ?? 1)),
          );
          const nextStartScreen = sanitizeStartScreen(stored.startScreen);
          const nextAppTheme = sanitizeAppTheme(stored.appTheme);
          const nextAmazonStoreOverride = sanitizeAmazonStoreOverride(stored.amazonStoreOverride);
          const nextAppLocale = sanitizeAppLocale(stored.appLocale);
          const nextCustomCocktailTags = sanitizeCustomTags(stored.customCocktailTags, DEFAULT_TAG_COLOR);
          const nextCustomIngredientTags = sanitizeCustomTags(stored.customIngredientTags, DEFAULT_TAG_COLOR);
          const nextOnboardingStep = 0;
          const nextOnboardingCompleted = stored.onboardingCompleted ?? false;
          const nextTranslationOverrides = sanitizeTranslationOverrides((stored as { translationOverrides?: unknown }).translationOverrides);

          applyInventoryBootstrap({
            inventoryState: nextInventoryState,
            availableIngredientIds: nextAvailableIds,
            shoppingIngredientIds: nextShoppingIds,
            ratingsByCocktailId: nextRatings,
            ignoreGarnish: nextIgnoreGarnish,
            allowAllSubstitutes: nextAllowAllSubstitutes,
            useImperialUnits: nextUseImperialUnits,
            keepScreenAwake: nextKeepScreenAwake,
            shakerSmartFilteringEnabled: nextShakerSmartFilteringEnabled,
            ratingFilterThreshold: nextRatingFilterThreshold,
            startScreen: nextStartScreen,
            appTheme: nextAppTheme,
            appLocale: nextAppLocale,
            translationOverrides: nextTranslationOverrides,
            amazonStoreOverride: nextAmazonStoreOverride,
            customCocktailTags: nextCustomCocktailTags,
            customIngredientTags: nextCustomIngredientTags,
            onboardingStep: nextOnboardingStep,
            onboardingCompleted: nextOnboardingCompleted,
          });
          return;
        }
      } catch (error) {
        console.error('Failed to load inventory snapshot', error);
      }

      try {
        const data = baseInventoryData;
        if (!cancelled) {
          applyInventoryBootstrap({
            inventoryState: createInventoryStateFromData(data, true),
            availableIngredientIds: new Set(),
            shoppingIngredientIds: new Set(),
            ratingsByCocktailId: {},
            ignoreGarnish: true,
            allowAllSubstitutes: true,
            useImperialUnits: shouldDefaultToImperialUnits,
            keepScreenAwake: true,
            shakerSmartFilteringEnabled: false,
            ratingFilterThreshold: 1,
            startScreen: DEFAULT_START_SCREEN,
            appTheme: DEFAULT_APP_THEME,
            appLocale: DEFAULT_APP_LOCALE,
            translationOverrides: {},
            amazonStoreOverride: null,
            customCocktailTags: [],
            customIngredientTags: [],
            onboardingStep: 1,
            onboardingCompleted: false,
          });
        }
      } catch (error) {
        console.error('Failed to import bundled inventory', error);
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyInventoryBootstrap, baseInventoryData, inventoryState, shouldDefaultToImperialUnits]);

  useEffect(() => {
    if (!inventoryState || !inventoryDelta) {
      return;
    }

    setLoading(false);
    globalThis.__yourbarInventory = inventoryState;
    globalThis.__yourbarInventoryAvailableIngredientIds = availableIngredientIds;
    globalThis.__yourbarInventoryShoppingIngredientIds = shoppingIngredientIds;
    globalThis.__yourbarInventoryCocktailRatings = ratingsByCocktailId;
    globalThis.__yourbarInventoryIgnoreGarnish = ignoreGarnish;
    globalThis.__yourbarInventoryAllowAllSubstitutes = allowAllSubstitutes;
    globalThis.__yourbarInventoryUseImperialUnits = useImperialUnits;
    globalThis.__yourbarInventoryKeepScreenAwake = keepScreenAwake;
    globalThis.__yourbarInventoryShakerSmartFilteringEnabled = shakerSmartFilteringEnabled;
    globalThis.__yourbarInventoryRatingFilterThreshold = ratingFilterThreshold;
    globalThis.__yourbarInventoryStartScreen = startScreen;
    globalThis.__yourbarInventoryAppTheme = appTheme;
    globalThis.__yourbarInventoryAppLocale = appLocale;
    globalThis.__yourbarInventoryAmazonStoreOverride = amazonStoreOverride;
    globalThis.__yourbarInventoryCustomCocktailTags = customCocktailTags;
    globalThis.__yourbarInventoryCustomIngredientTags = customIngredientTags;
    globalThis.__yourbarInventoryOnboardingStep = onboardingStep;
    globalThis.__yourbarInventoryOnboardingCompleted = onboardingCompleted;

    const snapshot = buildInventorySnapshot(inventoryDelta, {
      availableIngredientIds,
      shoppingIngredientIds,
      ratingsByCocktailId,
      ignoreGarnish,
      allowAllSubstitutes,
      useImperialUnits,
      keepScreenAwake,
      shakerSmartFilteringEnabled,
      ratingFilterThreshold,
      startScreen,
      appTheme,
      appLocale,
      translationOverrides,
      amazonStoreOverride,
      customCocktailTags,
      customIngredientTags,
      onboardingStep,
      onboardingCompleted,
    });
    const serialized = JSON.stringify(snapshot);

    if (lastPersistedSnapshot.current === serialized) {
      return;
    }

    lastPersistedSnapshot.current = serialized;

    void persistInventorySnapshot(snapshot).catch((error) => {
      console.error('Failed to persist inventory snapshot', error);
    });
  }, [
    inventoryState,
    inventoryDelta,
    availableIngredientIds,
    shoppingIngredientIds,
    ratingsByCocktailId,
    ignoreGarnish,
    allowAllSubstitutes,
    useImperialUnits,
    keepScreenAwake,
    shakerSmartFilteringEnabled,
    ratingFilterThreshold,
    startScreen,
    appTheme,
    appLocale,
    translationOverrides,
    amazonStoreOverride,
    customCocktailTags,
    customIngredientTags,
    onboardingStep,
    onboardingCompleted,
  ]);

  const cocktails = useMemo(
    () => [...(inventoryState?.cocktails ?? [])].sort((a, b) => compareOptionalGlobalAlphabet(a.name, b.name)),
    [inventoryState?.cocktails],
  );
  const ingredients = useMemo(
    () => [...(inventoryState?.ingredients ?? [])].sort((a, b) => compareOptionalGlobalAlphabet(a.name, b.name)),
    [inventoryState?.ingredients],
  );
  const localizedCocktails = useMemo(() => localizeCocktails(cocktails, appLocale, translationOverrides), [appLocale, cocktails, translationOverrides]);
  const localizedIngredients = useMemo(() => localizeIngredients(ingredients, appLocale, translationOverrides), [appLocale, ingredients, translationOverrides]);

  const resolveCocktailKey = useCallback((cocktail: Cocktail) => {
    const id = cocktail.id;
    if (id != null) {
      return String(id);
    }

    if (cocktail.name) {
      return normalizeSearchText(cocktail.name);
    }

    return undefined;
  }, []);

  const setCocktailRating = useCallback(
    (cocktail: Cocktail, rating: number) => {
      const key = resolveCocktailKey(cocktail);
      if (!key) {
        return;
      }

      setRatingsByCocktailId((prev) => {
        const normalizedRating = Math.max(0, Math.min(5, Math.round(rating)));

        if (normalizedRating <= 0) {
          if (!(key in prev)) {
            return prev;
          }

          const next = { ...prev };
          delete next[key];
          return next;
        }

        if (prev[key] === normalizedRating) {
          return prev;
        }

        return { ...prev, [key]: normalizedRating };
      });
    },
    [resolveCocktailKey],
  );

  const getCocktailRating = useCallback(
    (cocktail: Cocktail) => {
      const key = resolveCocktailKey(cocktail);
      if (!key) {
        return 0;
      }

      const rating = ratingsByCocktailId[key];
      if (rating == null) {
        return 0;
      }

      return Math.max(0, Math.min(5, Number(rating) || 0));
    },
    [ratingsByCocktailId, resolveCocktailKey],
  );

  const setIngredientAvailability = useCallback((id: number, available: boolean) => {
    setAvailableIngredientIds((prev) => {
      const next = new Set(prev);
      if (available) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const createCocktail = useCallback(
    (input: CreateCocktailInput) => {
      let created: Cocktail | undefined;

      setInventoryState((prev) => {
        if (!prev) {
          return prev;
        }

        const trimmedName = input.name?.trim();
        if (!trimmedName) {
          return prev;
        }

        const sanitizedIngredients = (input.ingredients ?? [])
          .map((ingredient, index) => {
            const trimmedIngredientName = ingredient.name?.trim();
            if (!trimmedIngredientName) {
              return undefined;
            }

            const normalizedIngredientId =
              ingredient.ingredientId != null ? Number(ingredient.ingredientId) : undefined;
            const ingredientId =
              normalizedIngredientId != null &&
                Number.isFinite(normalizedIngredientId) &&
                normalizedIngredientId >= 0
                ? Math.trunc(normalizedIngredientId)
                : undefined;

            const normalizedUnitId = ingredient.unitId != null ? Number(ingredient.unitId) : undefined;
            const unitId =
              normalizedUnitId != null && Number.isFinite(normalizedUnitId) && normalizedUnitId >= 0
                ? Math.trunc(normalizedUnitId)
                : undefined;

            const amount = ingredient.amount?.trim() || undefined;
            const optional = ingredient.optional ? true : undefined;
            const garnish = ingredient.garnish ? true : undefined;
            const allowBase = ingredient.allowBaseSubstitution ? true : undefined;
            const allowBrand = ingredient.allowBrandSubstitution ? true : undefined;
            const allowStyle = ingredient.allowStyleSubstitution ? true : undefined;

            const substituteInputs = ingredient.substitutes ?? [];
            const substitutes: CocktailSubstitute[] = [];
            const seenKeys = new Set<string>();

            substituteInputs.forEach((candidate) => {
              const substituteName = candidate?.name?.trim();
              if (!substituteName) {
                return;
              }

              const rawIngredientLink =
                candidate.ingredientId != null ? Number(candidate.ingredientId) : undefined;
              const substituteIngredientId =
                rawIngredientLink != null && Number.isFinite(rawIngredientLink) && rawIngredientLink >= 0
                  ? Math.trunc(rawIngredientLink)
                  : undefined;

              const key =
                substituteIngredientId != null
                  ? `id:${substituteIngredientId}`
                  : `name:${substituteName.toLowerCase()}`;
              if (seenKeys.has(key)) {
                return;
              }
              seenKeys.add(key);

              const brand = candidate.brand ? true : undefined;

              substitutes.push({
                ingredientId: substituteIngredientId,
                name: substituteName,
                brand,
              });
            });

            return {
              order: index + 1,
              ingredientId,
              name: trimmedIngredientName,
              amount,
              unitId,
              optional,
              garnish,
              allowBaseSubstitution: allowBase,
              allowBrandSubstitution: allowBrand,
              allowStyleSubstitution: allowStyle,
              substitutes: substitutes.length > 0 ? substitutes : undefined,
            } satisfies CocktailIngredient;
          })
          .filter((value): value is CocktailIngredient => Boolean(value));

        if (sanitizedIngredients.length === 0) {
          return prev;
        }

        const nextId =
          prev.cocktails.reduce((maxId, cocktail) => {
            const id = Number(cocktail.id ?? -1);
            if (!Number.isFinite(id) || id < 0) {
              return maxId;
            }

            return Math.max(maxId, id);
          }, USER_CREATED_ID_START - 1) + 1;

        const description = input.description?.trim() || undefined;
        const instructions = input.instructions?.trim() || undefined;
        const synonyms = normalizeSynonyms(input.synonyms);
        const photoUri = input.photoUri?.trim() || undefined;
        const glassId = input.glassId?.trim() || undefined;
        const methodIds = input.methodIds
          ? Array.from(new Set(input.methodIds)).filter(Boolean)
          : undefined;

        const tagMap = new Map<number, CocktailTag>();
        (input.tags ?? []).forEach((tag) => {
          const id = Number(tag.id ?? -1);
          if (!Number.isFinite(id) || id < 0) {
            return;
          }

          if (!tagMap.has(id)) {
            tagMap.set(id, { id, name: tag.name, color: tag.color });
          }
        });
        const tags = tagMap.size > 0 ? Array.from(tagMap.values()) : undefined;

        const candidateRecord = {
          id: nextId,
          name: trimmedName,
          description,
          instructions,
          synonyms,
          photoUri,
          glassId,
          methodIds: methodIds && methodIds.length > 0 ? methodIds : undefined,
          tags,
          ingredients: sanitizedIngredients.map((ingredient, index) => ({
            ...ingredient,
            order: index + 1,
          })),
        } as unknown as BaseCocktailRecord;

        const [normalized] = normalizeSearchFields([candidateRecord]);
        if (!normalized) {
          return prev;
        }

        created = normalized as Cocktail;

        const nextCocktails = [...prev.cocktails, created].sort((a, b) =>
          compareGlobalAlphabet(a.searchNameNormalized, b.searchNameNormalized),
        );

        return {
          ...prev,
          cocktails: nextCocktails,
        } satisfies InventoryState;
      });

      if (created?.id != null) {
        const key = String(created.id);
        const nextName = input.name?.trim() || created.name || '';
        const nextDescription = input.description?.trim();
        const nextInstructions = input.instructions?.trim();
        const nextSynonyms = normalizeSynonyms(input.synonyms);
        const patch: CocktailTranslationOverride = {
          name: nextName,
          ...(nextDescription ? { description: nextDescription } : {}),
          ...(nextInstructions ? { instructions: nextInstructions } : {}),
          ...(((nextSynonyms ?? []).length > 0) ? { synonyms: nextSynonyms } : {}),
        };
        setTranslationOverrides((prev) => ({
          ...prev,
          [appLocale]: {
            ...(prev[appLocale] ?? {}),
            cocktails: {
              ...((prev[appLocale]?.cocktails as Record<string, any> | undefined) ?? {}),
              [key]: {
                ...(prev[appLocale]?.cocktails?.[key] ?? {}),
                ...patch,
              },
            },
          },
        }));
      }

      return created;
    },
    [appLocale],
  );

  const createIngredient = useCallback(
    (input: CreateIngredientInput) => {
      let created: Ingredient | undefined;

      setInventoryState((prev) => {
        if (!prev) {
          return prev;
        }

        const trimmedName = input.name?.trim();
        if (!trimmedName) {
          return prev;
        }

        const nextId =
          prev.ingredients.reduce((maxId, ingredient) => {
            const id = Number(ingredient.id ?? -1);
            if (!Number.isFinite(id) || id < 0) {
              return maxId;
            }

            return Math.max(maxId, id);
          }, USER_CREATED_ID_START - 1) + 1;

        const normalizedBaseId =
          input.baseIngredientId != null ? Number(input.baseIngredientId) : undefined;
        const baseIngredientId =
          normalizedBaseId != null && Number.isFinite(normalizedBaseId) && normalizedBaseId >= 0
            ? Math.trunc(normalizedBaseId)
            : undefined;
        const normalizedStyleId =
          input.styleIngredientId != null ? Number(input.styleIngredientId) : undefined;
        const styleIngredientId =
          normalizedStyleId != null && Number.isFinite(normalizedStyleId) && normalizedStyleId >= 0
            ? Math.trunc(normalizedStyleId)
            : undefined;

        const hasBaseLink = baseIngredientId != null;
        const hasStyleLink = styleIngredientId != null;
        if (hasBaseLink && hasStyleLink) {
          return prev;
        }

        if (hasStyleLink) {
          const styleRecord = prev.ingredients.find((item) => Number(item.id ?? -1) === styleIngredientId);
          if (!styleRecord || styleRecord.baseIngredientId != null || styleRecord.styleIngredientId != null) {
            return prev;
          }
        }

        const description = input.description?.trim() || undefined;
        const synonyms = normalizeSynonyms(input.synonyms);
        const photoUri = input.photoUri?.trim() || undefined;

        const tagMap = new Map<number, IngredientTag>();
        (input.tags ?? []).forEach((tag) => {
          const id = Number(tag.id ?? -1);
          if (!Number.isFinite(id) || id < 0) {
            return;
          }

          if (!tagMap.has(id)) {
            tagMap.set(id, {
              id,
              name: tag.name,
              color: tag.color,
            });
          }
        });
        const tags = tagMap.size > 0 ? Array.from(tagMap.values()) : undefined;

        const candidateRecord = {
          id: nextId,
          name: trimmedName,
          description,
          synonyms,
          tags,
          baseIngredientId,
          styleIngredientId,
          photoUri,
        };

        const [normalized] = normalizeSearchFields([candidateRecord]);
        if (!normalized) {
          return prev;
        }

        created = normalized as Ingredient;

        const nextIngredients = [...prev.ingredients, created].sort((a, b) =>
          compareGlobalAlphabet(a.searchNameNormalized, b.searchNameNormalized),
        );

        return {
          ...prev,
          ingredients: nextIngredients,
        } satisfies InventoryState;
      });

      if (created?.id != null) {
        const id = Number(created.id);
        if (Number.isFinite(id) && id >= 0) {
          setAvailableIngredientIds((prev) => {
            if (prev.has(id)) {
              return prev;
            }

            const next = new Set(prev);
            next.add(id);
            return next;
          });

          setShoppingIngredientIds((prev) => {
            if (!prev.has(id)) {
              return prev;
            }

            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      }

      if (created?.id != null) {
        const key = String(created.id);
        const nextName = input.name?.trim() || created.name || '';
        const nextDescription = input.description?.trim();
        const patch: IngredientTranslationOverride = {
          name: nextName,
          ...(nextDescription ? { description: nextDescription } : {}),
        };
        setTranslationOverrides((prev) => ({
          ...prev,
          [appLocale]: {
            ...(prev[appLocale] ?? {}),
            ingredients: {
              ...((prev[appLocale]?.ingredients as Record<string, any> | undefined) ?? {}),
              [key]: {
                ...(prev[appLocale]?.ingredients?.[key] ?? {}),
                ...patch,
              },
            },
          },
        }));
      }

      return created;
    },
    [appLocale],
  );

  const resetInventoryFromBundle = useCallback(async () => {
    const data = reloadInventoryData();
    setInventoryState((prev) => {
      const baseState = createInventoryStateFromData(data, prev?.imported ?? false);
      if (!prev) {
        return baseState;
      }

      const userCocktails = prev.cocktails.filter((cocktail) => {
        const id = Number(cocktail.id ?? -1);
        return Number.isFinite(id) && id >= USER_CREATED_ID_START;
      });
      const userIngredients = prev.ingredients.filter((ingredient) => {
        const id = Number(ingredient.id ?? -1);
        return Number.isFinite(id) && id >= USER_CREATED_ID_START;
      });

      const cocktails = [...baseState.cocktails, ...userCocktails].sort((a, b) =>
        compareGlobalAlphabet(a.searchNameNormalized, b.searchNameNormalized),
      );
      const ingredients = [...baseState.ingredients, ...userIngredients].sort((a, b) =>
        compareGlobalAlphabet(a.searchNameNormalized, b.searchNameNormalized),
      );

      return {
        ...baseState,
        imported: prev.imported,
        cocktails,
        ingredients,
      } satisfies InventoryState;
    });

    setTranslationOverrides((prev) => {
      const next: InventoryTranslationOverrides = {};

      (Object.entries(prev) as Array<[SupportedLocale, InventoryLocaleTranslationOverrides | undefined]>).forEach(([locale, localeOverrides]) => {
        if (!localeOverrides) {
          return;
        }

        const preservedCocktails = Object.entries(localeOverrides.cocktails ?? {}).reduce<NonNullable<InventoryLocaleTranslationOverrides['cocktails']>>((acc, [id, value]) => {
          const numericId = Number(id);
          if (Number.isFinite(numericId) && numericId >= USER_CREATED_ID_START) {
            acc[id] = value;
          }
          return acc;
        }, {});

        const hasCocktails = Object.keys(preservedCocktails).length > 0;
        const hasIngredients = Boolean(localeOverrides.ingredients && Object.keys(localeOverrides.ingredients).length > 0);

        if (!hasCocktails && !hasIngredients) {
          return;
        }

        next[locale] = {
          ...(hasCocktails ? { cocktails: preservedCocktails } : {}),
          ...(hasIngredients ? { ingredients: localeOverrides.ingredients } : {}),
        };
      });

      return next;
    });
  }, []);

  const exportInventoryData = useCallback((): InventoryExportFile[] | null => {
    if (!inventoryState) {
      return null;
    }

    const baseCocktails = baseMaps.baseCocktails;
    const baseIngredients = baseMaps.baseIngredients;

    const cocktails = inventoryState.cocktails.reduce<InventoryExportData['cocktails']>((acc, cocktail) => {
      const record = toCocktailStorageRecord(cocktail);
      const id = Number(record.id ?? -1);
      const normalizedId = Number.isFinite(id) && id >= 0 ? Math.trunc(id) : undefined;
      const baseRecord = normalizedId != null ? baseCocktails.get(normalizedId) : undefined;

      if (baseRecord && areStorageRecordsEqual(record, baseRecord)) {
        return acc;
      }

      const tags = normalizeTagIds(cocktail.tags);
      acc.push({
        ...record,
        tags,
        photoUri: normalizePhotoUriForBackup({
          uri: record.photoUri,
          category: 'cocktails',
          id: record.id,
          name: record.name,
        }),
      });
      return acc;
    }, []);
    const ingredients = inventoryState.ingredients.reduce<InventoryExportData['ingredients']>((acc, ingredient) => {
      const record = toIngredientStorageRecord(ingredient);
      const id = Number(record.id ?? -1);
      const normalizedId = Number.isFinite(id) && id >= 0 ? Math.trunc(id) : undefined;
      const baseRecord = normalizedId != null ? baseIngredients.get(normalizedId) : undefined;

      if (baseRecord && areStorageRecordsEqual(record, baseRecord)) {
        return acc;
      }

      const tags = normalizeTagIds(ingredient.tags);
      acc.push({
        ...record,
        tags,
        photoUri: normalizePhotoUriForBackup({
          uri: record.photoUri,
          category: 'ingredients',
          id: record.id,
          name: record.name,
        }),
      });
      return acc;
    }, []);

    const files: InventoryExportFile[] = [{
      schemaVersion: 1,
      kind: 'base',
      data: { cocktails, ingredients },
    } satisfies InventoryBaseExportFile];

    (Object.entries(translationOverrides) as Array<[SupportedLocale, InventoryLocaleTranslationOverrides | undefined]>).forEach(([locale, localeData]) => {
      if (!localeData) {
        return;
      }

      const hasCocktails = Boolean(localeData.cocktails && Object.keys(localeData.cocktails).length > 0);
      const hasIngredients = Boolean(localeData.ingredients && Object.keys(localeData.ingredients).length > 0);
      if (!hasCocktails && !hasIngredients) {
        return;
      }

      files.push({
        schemaVersion: 1,
        kind: 'translations',
        locale,
        data: {
          ...(hasCocktails ? { cocktails: localeData.cocktails } : {}),
          ...(hasIngredients ? { ingredients: localeData.ingredients } : {}),
        },
      } satisfies InventoryTranslationsExportFile);
    });

    files.sort((a, b) => (a.kind === 'base' ? -1 : a.kind.localeCompare(b.kind)));
    return files;
  }, [baseMaps, inventoryState, translationOverrides]);

  const exportInventoryPhotoEntries = useCallback((): PhotoBackupEntry[] | null => {
    if (!inventoryState) {
      return null;
    }

    const baseCocktails = baseMaps.baseCocktails;
    const baseIngredients = baseMaps.baseIngredients;

    return [
      ...inventoryState.cocktails.reduce<PhotoBackupEntry[]>((acc, cocktail) => {
        const record = toCocktailStorageRecord(cocktail);
        const id = Number(record.id ?? -1);
        const normalizedId = Number.isFinite(id) && id >= 0 ? Math.trunc(id) : undefined;
        const baseRecord = normalizedId != null ? baseCocktails.get(normalizedId) : undefined;

        if (baseRecord && areStorageRecordsEqual(record, baseRecord)) {
          return acc;
        }

        acc.push({
          type: 'cocktails' as const,
          id: cocktail.id ?? '',
          name: cocktail.name ?? 'cocktail',
          uri: cocktail.photoUri ?? undefined,
        });
        return acc;
      }, []),
      ...inventoryState.ingredients.reduce<PhotoBackupEntry[]>((acc, ingredient) => {
        const record = toIngredientStorageRecord(ingredient);
        const id = Number(record.id ?? -1);
        const normalizedId = Number.isFinite(id) && id >= 0 ? Math.trunc(id) : undefined;
        const baseRecord = normalizedId != null ? baseIngredients.get(normalizedId) : undefined;

        if (baseRecord && areStorageRecordsEqual(record, baseRecord)) {
          return acc;
        }

        acc.push({
          type: 'ingredients' as const,
          id: ingredient.id ?? '',
          name: ingredient.name ?? 'ingredient',
          uri: ingredient.photoUri ?? undefined,
        });
        return acc;
      }, []),
    ];
  }, [baseMaps, inventoryState]);

  const importInventoryData = useCallback((input: InventoryExportData | InventoryExportFile | InventoryExportFile[]) => {
    const files = Array.isArray(input)
      ? input
      : (input && typeof input === 'object' && 'kind' in input
        ? [input as InventoryExportFile]
        : [{ schemaVersion: 1, kind: 'base', data: input as InventoryExportData } satisfies InventoryBaseExportFile]);

    const baseFile = files.find((file) => file.kind === 'base') as InventoryBaseExportFile | undefined;
    const translationFiles = files.filter((file): file is InventoryTranslationsExportFile => file.kind === 'translations');

    const incomingState = baseFile
      ? createInventoryStateFromData(hydrateInventoryTagsFromCode(baseFile.data), true)
      : undefined;

    const mergeById = <TItem extends { id?: number | null; searchNameNormalized: string }>(
      currentItems: readonly TItem[],
      incomingItems: readonly TItem[],
    ): TItem[] => {
      const incomingMap = new Map<number, TItem>();
      incomingItems.forEach((item) => {
        const id = Number(item.id ?? -1);
        if (!Number.isFinite(id) || id < 0) {
          return;
        }
        incomingMap.set(Math.trunc(id), item);
      });

      const merged: TItem[] = [];
      const seen = new Set<number>();

      currentItems.forEach((item) => {
        const id = Number(item.id ?? -1);
        if (!Number.isFinite(id) || id < 0) {
          merged.push(item);
          return;
        }

        const normalizedId = Math.trunc(id);
        const replacement = incomingMap.get(normalizedId);
        merged.push(replacement ?? item);
        seen.add(normalizedId);
      });

      incomingMap.forEach((item, id) => {
        if (seen.has(id)) {
          return;
        }
        merged.push(item);
      });

      merged.sort((a, b) => compareGlobalAlphabet(a.searchNameNormalized, b.searchNameNormalized));
      return merged;
    };

    if (incomingState) {
      setInventoryState((prev) => {
        if (!prev) {
          return incomingState;
        }

        return {
          ...prev,
          imported: true,
          cocktails: mergeById(prev.cocktails, incomingState.cocktails),
          ingredients: mergeById(prev.ingredients, incomingState.ingredients),
        } satisfies InventoryState;
      });
    }

    if (translationFiles.length > 0) {
      setTranslationOverrides((prev) => {
        const next: InventoryTranslationOverrides = { ...prev };
        translationFiles.forEach((file) => {
          const locale = file.locale;
          const prevLocale = next[locale] ?? {};
          next[locale] = {
            ...prevLocale,
            cocktails: {
              ...(prevLocale.cocktails ?? {}),
              ...(file.data.cocktails ?? {}),
            },
            ingredients: {
              ...(prevLocale.ingredients ?? {}),
              ...(file.data.ingredients ?? {}),
            },
          };
        });
        return next;
      });
    }
  }, []);

  const importInventoryPhotos = useCallback((entries: ImportedPhotoEntry[]) => {
    let importedCount = 0;

    setInventoryState((prev) => {
      if (!prev || entries.length === 0) {
        return prev;
      }

      const cocktailPhotoById = new Map<number, string>();
      const ingredientPhotoById = new Map<number, string>();

      entries.forEach((entry) => {
        const id = Number(entry.id ?? -1);
        if (!Number.isFinite(id) || id < 0 || !entry.photoUri?.trim()) {
          return;
        }

        const normalizedId = Math.trunc(id);
        const uri = entry.photoUri.trim();
        if (entry.type === 'cocktails') {
          cocktailPhotoById.set(normalizedId, uri);
        } else {
          ingredientPhotoById.set(normalizedId, uri);
        }
      });

      if (cocktailPhotoById.size === 0 && ingredientPhotoById.size === 0) {
        return prev;
      }

      const cocktails = prev.cocktails.map((cocktail) => {
        const id = Number(cocktail.id ?? -1);
        if (!Number.isFinite(id) || id < 0) {
          return cocktail;
        }

        const importedUri = cocktailPhotoById.get(Math.trunc(id));
        if (!importedUri || importedUri === cocktail.photoUri) {
          return cocktail;
        }

        importedCount += 1;
        return {
          ...cocktail,
          photoUri: importedUri,
        } satisfies Cocktail;
      });

      const ingredients = prev.ingredients.map((ingredient) => {
        const id = Number(ingredient.id ?? -1);
        if (!Number.isFinite(id) || id < 0) {
          return ingredient;
        }

        const importedUri = ingredientPhotoById.get(Math.trunc(id));
        if (!importedUri || importedUri === ingredient.photoUri) {
          return ingredient;
        }

        importedCount += 1;
        return {
          ...ingredient,
          photoUri: importedUri,
        } satisfies Ingredient;
      });

      return {
        ...prev,
        imported: true,
        cocktails,
        ingredients,
      } satisfies InventoryState;
    });

    return importedCount;
  }, []);


  const updateIngredient = useCallback(
    (id: number, input: CreateIngredientInput) => {
      let updated: Ingredient | undefined;

      setInventoryState((prev) => {
        if (!prev) {
          return prev;
        }

        const normalizedId = Number(id);
        if (!Number.isFinite(normalizedId) || normalizedId < 0) {
          return prev;
        }

        const ingredientIndex = prev.ingredients.findIndex(
          (item) => Number(item.id ?? -1) === normalizedId,
        );

        if (ingredientIndex === -1) {
          return prev;
        }

        const trimmedName = input.name?.trim();
        if (!trimmedName) {
          return prev;
        }

        const normalizedBaseId =
          input.baseIngredientId != null ? Number(input.baseIngredientId) : undefined;
        const baseIngredientId =
          normalizedBaseId != null && Number.isFinite(normalizedBaseId) && normalizedBaseId >= 0
            ? Math.trunc(normalizedBaseId)
            : undefined;
        const normalizedStyleId =
          input.styleIngredientId != null ? Number(input.styleIngredientId) : undefined;
        const styleIngredientId =
          normalizedStyleId != null && Number.isFinite(normalizedStyleId) && normalizedStyleId >= 0
            ? Math.trunc(normalizedStyleId)
            : undefined;

        const hasBaseLink = baseIngredientId != null;
        const hasStyleLink = styleIngredientId != null;
        if (hasBaseLink && hasStyleLink) {
          return prev;
        }

        if (hasStyleLink) {
          const styleRecord = prev.ingredients.find((item) => Number(item.id ?? -1) === styleIngredientId);
          if (!styleRecord || styleRecord.baseIngredientId != null || styleRecord.styleIngredientId != null || Number(styleRecord.id ?? -1) === normalizedId) {
            return prev;
          }
        }

        const description = input.description?.trim() || undefined;
        const synonyms =
          input.synonyms !== undefined
            ? normalizeSynonyms(input.synonyms)
            : prev.ingredients[ingredientIndex]?.synonyms ?? undefined;
        const photoUri = input.photoUri?.trim() || undefined;

        const tagMap = new Map<number, IngredientTag>();
        (input.tags ?? []).forEach((tag) => {
          const tagId = Number(tag.id ?? -1);
          if (!Number.isFinite(tagId) || tagId < 0) {
            return;
          }

          if (!tagMap.has(tagId)) {
            tagMap.set(tagId, {
              id: tagId,
              name: tag.name,
              color: tag.color,
            });
          }
        });
        const tags = tagMap.size > 0 ? Array.from(tagMap.values()) : undefined;

        const previous = prev.ingredients[ingredientIndex];
        const candidateRecord = {
          ...previous,
          id: previous.id,
          name: previous.name,
          description: previous.description,
          tags,
          baseIngredientId,
          styleIngredientId,
          photoUri,
        };

        const [normalized] = normalizeSearchFields([candidateRecord]);
        if (!normalized) {
          return prev;
        }

        updated = normalized as Ingredient;

        const nextIngredients = [...prev.ingredients];
        nextIngredients[ingredientIndex] = updated;
        nextIngredients.sort((a, b) =>
          compareGlobalAlphabet(a.searchNameNormalized, b.searchNameNormalized),
        );

        return {
          ...prev,
          ingredients: nextIngredients,
        } satisfies InventoryState;
      });

      if (updated?.id != null) {
        const key = String(updated.id);
        const nextName = input.name?.trim();
        const nextDescription = input.description?.trim();
        const patch: IngredientTranslationOverride = {
          ...(nextName ? { name: nextName } : {}),
          ...(nextDescription ? { description: nextDescription } : {}),
        };
        setTranslationOverrides((prev) => ({
          ...prev,
          [appLocale]: {
            ...(prev[appLocale] ?? {}),
            ingredients: {
              ...((prev[appLocale]?.ingredients as Record<string, any> | undefined) ?? {}),
              [key]: {
                ...(prev[appLocale]?.ingredients?.[key] ?? {}),
                ...patch,
              },
            },
          },
        }));
      }

      return updated;
    },
    [appLocale],
  );

  const updateCocktail = useCallback((id: number, input: CreateCocktailInput) => {
    let updated: Cocktail | undefined;

    setInventoryState((prev) => {
      if (!prev) {
        return prev;
      }

      const trimmedName = input.name?.trim();
      if (!trimmedName) {
        return prev;
      }

      const targetId = Number(id);
      if (!Number.isFinite(targetId) || targetId < 0) {
        return prev;
      }

      const existingIndex = prev.cocktails.findIndex(
        (cocktail) => Number(cocktail.id ?? -1) === Math.trunc(targetId),
      );
      if (existingIndex < 0) {
        return prev;
      }

      const sanitizedIngredients = (input.ingredients ?? [])
        .map((ingredient, index) => {
          const trimmedIngredientName = ingredient.name?.trim();
          if (!trimmedIngredientName) {
            return undefined;
          }

          const normalizedIngredientId = ingredient.ingredientId != null ? Number(ingredient.ingredientId) : undefined;
          const ingredientId =
            normalizedIngredientId != null && Number.isFinite(normalizedIngredientId) && normalizedIngredientId >= 0
              ? Math.trunc(normalizedIngredientId)
              : undefined;

          const normalizedUnitId = ingredient.unitId != null ? Number(ingredient.unitId) : undefined;
          const unitId =
            normalizedUnitId != null && Number.isFinite(normalizedUnitId) && normalizedUnitId >= 0
              ? Math.trunc(normalizedUnitId)
              : undefined;

          const amount = ingredient.amount?.trim() || undefined;
          const optional = ingredient.optional ? true : undefined;
          const garnish = ingredient.garnish ? true : undefined;
          const allowBase = ingredient.allowBaseSubstitution ? true : undefined;
          const allowBrand = ingredient.allowBrandSubstitution ? true : undefined;
          const allowStyle = ingredient.allowStyleSubstitution ? true : undefined;

          const substituteInputs = ingredient.substitutes ?? [];
          const substitutes: CocktailSubstitute[] = [];
          const seenKeys = new Set<string>();

          substituteInputs.forEach((candidate) => {
            const substituteName = candidate?.name?.trim();
            if (!substituteName) {
              return;
            }

            const rawIngredientLink = candidate.ingredientId != null ? Number(candidate.ingredientId) : undefined;
            const substituteIngredientId =
              rawIngredientLink != null && Number.isFinite(rawIngredientLink) && rawIngredientLink >= 0
                ? Math.trunc(rawIngredientLink)
                : undefined;

            const key =
              substituteIngredientId != null
                ? `id:${substituteIngredientId}`
                : `name:${substituteName.toLowerCase()}`;
            if (seenKeys.has(key)) {
              return;
            }
            seenKeys.add(key);

            const brand = candidate.brand ? true : undefined;

            substitutes.push({
              ingredientId: substituteIngredientId,
              name: substituteName,
              brand,
            });
          });

          return {
            order: index + 1,
            ingredientId,
            name: trimmedIngredientName,
            amount,
            unitId,
            optional,
            garnish,
            allowBaseSubstitution: allowBase,
            allowBrandSubstitution: allowBrand,
            allowStyleSubstitution: allowStyle,
            substitutes: substitutes.length > 0 ? substitutes : undefined,
          } satisfies CocktailIngredient;
        })
        .filter((value): value is CocktailIngredient => Boolean(value));

      if (sanitizedIngredients.length === 0) {
        return prev;
      }

      const existing = prev.cocktails[existingIndex];
      const description = input.description?.trim() || undefined;
      const instructions = input.instructions?.trim() || undefined;
      const synonyms =
        input.synonyms !== undefined
          ? normalizeSynonyms(input.synonyms)
          : existing.synonyms ?? undefined;
      const photoUri = input.photoUri?.trim() || undefined;
      const glassId = input.glassId?.trim() || undefined;
      const methodIds = input.methodIds
        ? Array.from(new Set(input.methodIds)).filter(Boolean)
        : undefined;

      const tagMap = new Map<number, CocktailTag>();
      (input.tags ?? []).forEach((tag) => {
        const tagId = Number(tag.id ?? -1);
        if (!Number.isFinite(tagId) || tagId < 0) {
          return;
        }

        if (!tagMap.has(tagId)) {
          tagMap.set(tagId, { id: tagId, name: tag.name, color: tag.color });
        }
      });
      const tags = tagMap.size > 0 ? Array.from(tagMap.values()) : undefined;

      const candidateRecord = {
        ...existing,
        id: existing.id,
        name: existing.name,
        description: existing.description,
        instructions: existing.instructions,
        synonyms: existing.synonyms,
        photoUri,
        glassId,
        methodIds: methodIds && methodIds.length > 0 ? methodIds : undefined,
        tags,
        ingredients: sanitizedIngredients.map((ingredient, index) => ({
          ...ingredient,
          order: index + 1,
        })),
      } as unknown as BaseCocktailRecord;

      const [normalized] = normalizeSearchFields([candidateRecord]);
      if (!normalized) {
        return prev;
      }

      updated = normalized as Cocktail;

      const nextCocktails = [...prev.cocktails];
      nextCocktails.splice(existingIndex, 1, updated);

      const sortedCocktails = nextCocktails.sort((a, b) =>
        compareGlobalAlphabet(a.searchNameNormalized, b.searchNameNormalized),
      );

      return {
        ...prev,
        cocktails: sortedCocktails,
      } satisfies InventoryState;
    });

    if (updated?.id != null) {
      const key = String(updated.id);
      const nextName = input.name?.trim();
      const nextDescription = input.description?.trim();
      const nextInstructions = input.instructions?.trim();
      const nextSynonyms = normalizeSynonyms(input.synonyms);
      const patch: CocktailTranslationOverride = {
        ...(nextName ? { name: nextName } : {}),
        ...(nextDescription ? { description: nextDescription } : {}),
        ...(nextInstructions ? { instructions: nextInstructions } : {}),
        ...(((nextSynonyms ?? []).length > 0) ? { synonyms: nextSynonyms } : {}),
      };
      setTranslationOverrides((prev) => ({
        ...prev,
        [appLocale]: {
          ...(prev[appLocale] ?? {}),
          cocktails: {
            ...((prev[appLocale]?.cocktails as Record<string, any> | undefined) ?? {}),
            [key]: {
              ...(prev[appLocale]?.cocktails?.[key] ?? {}),
              ...patch,
            },
          },
        },
      }));
    }

    return updated;
  }, [appLocale]);

  const deleteIngredient = useCallback((id: number) => {
    const normalizedId = Number(id);
    if (!Number.isFinite(normalizedId) || normalizedId < 0) {
      return false;
    }

    let wasRemoved = false;

    setInventoryState((prev) => {
      if (!prev) {
        return prev;
      }

      let didUpdateDependents = false;

      const nextIngredients = prev.ingredients.reduce<Ingredient[]>((acc, ingredient) => {
        const ingredientId = Number(ingredient.id ?? -1);
        if (ingredientId === normalizedId) {
          wasRemoved = true;
          return acc;
        }

        if (
          (ingredient.baseIngredientId != null &&
            Number(ingredient.baseIngredientId) === normalizedId) ||
          (ingredient.styleIngredientId != null &&
            Number(ingredient.styleIngredientId) === normalizedId)
        ) {
          didUpdateDependents = true;
          acc.push({ ...ingredient, baseIngredientId: undefined, styleIngredientId: undefined } satisfies Ingredient);
          return acc;
        }

        acc.push(ingredient);
        return acc;
      }, []);

      if (!wasRemoved) {
        return prev;
      }

      if (didUpdateDependents) {
        nextIngredients.sort((a, b) =>
          compareGlobalAlphabet(a.searchNameNormalized, b.searchNameNormalized),
        );
      }

      return {
        ...prev,
        ingredients: nextIngredients,
      } satisfies InventoryState;
    });

    if (!wasRemoved) {
      return false;
    }

    setAvailableIngredientIds((prev) => {
      if (!prev.has(normalizedId)) {
        return prev;
      }

      const next = new Set(prev);
      next.delete(normalizedId);
      return next;
    });

    setShoppingIngredientIds((prev) => {
      if (!prev.has(normalizedId)) {
        return prev;
      }

      const next = new Set(prev);
      next.delete(normalizedId);
      return next;
    });

    return true;
  }, []);

  const deleteCocktail = useCallback(
    (id: number) => {
      const normalizedId = Number(id);
      if (!Number.isFinite(normalizedId) || normalizedId < 0) {
        return false;
      }

      let targetCocktail: Cocktail | undefined;

      setInventoryState((prev) => {
        if (!prev) {
          return prev;
        }

        let wasRemoved = false;

        const nextCocktails = prev.cocktails.filter((cocktail) => {
          const cocktailId = Number(cocktail.id ?? -1);
          if (cocktailId === normalizedId) {
            wasRemoved = true;
            targetCocktail = cocktail;
            return false;
          }

          return true;
        });

        if (!wasRemoved) {
          return prev;
        }

        return {
          ...prev,
          cocktails: nextCocktails,
        } satisfies InventoryState;
      });

      if (!targetCocktail) {
        return false;
      }

      setRatingsByCocktailId((prev) => {
        const next = { ...prev };
        let didChange = false;

        const keyFromId = resolveCocktailKey(targetCocktail!);
        if (keyFromId && keyFromId in next) {
          delete next[keyFromId];
          didChange = true;
        }

        const nameKey = targetCocktail!.name ? normalizeSearchText(targetCocktail!.name) : undefined;
        if (nameKey && nameKey in next) {
          delete next[nameKey];
          didChange = true;
        }

        return didChange ? next : prev;
      });

      return true;
    },
    [resolveCocktailKey],
  );

  const toggleIngredientAvailability = useCallback((id: number) => {
    setAvailableIngredientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleIngredientShopping = useCallback((id: number) => {
    setShoppingIngredientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSetIgnoreGarnish = useCallback((value: boolean) => {
    setIgnoreGarnish(Boolean(value));
  }, []);

  const handleSetAllowAllSubstitutes = useCallback((value: boolean) => {
    setAllowAllSubstitutes(Boolean(value));
  }, []);

  const handleSetUseImperialUnits = useCallback((value: boolean) => {
    setUseImperialUnits(Boolean(value));
  }, []);

  const handleSetKeepScreenAwake = useCallback((value: boolean) => {
    setKeepScreenAwake(Boolean(value));
  }, []);

  const handleSetShakerSmartFilteringEnabled = useCallback((value: boolean) => {
    setShakerSmartFilteringEnabled(Boolean(value));
  }, []);

  const handleSetRatingFilterThreshold = useCallback((value: number) => {
    const normalized = Math.min(5, Math.max(1, Math.round(value)));
    setRatingFilterThreshold(normalized);
  }, []);

  const handleSetStartScreen = useCallback((value: StartScreen) => {
    setStartScreen(sanitizeStartScreen(value));
  }, []);

  const handleSetAppTheme = useCallback((value: AppTheme) => {
    setAppTheme(sanitizeAppTheme(value));
  }, []);

  const handleSetAmazonStoreOverride = useCallback((value: AmazonStoreOverride | null) => {
    setAmazonStoreOverride(value == null ? null : sanitizeAmazonStoreOverride(value));
  }, []);

  const completeOnboarding = useCallback(() => {
    setOnboardingCompleted(true);
    setOnboardingStep(0);
  }, []);

  const restartOnboarding = useCallback(() => {
    setOnboardingCompleted(false);
    setOnboardingStep(1);
    setStartScreen('ingredients_all');
  }, []);

  const createCustomCocktailTag = useCallback((input: { name: string; color?: string | null }) => {
    const trimmedName = input.name?.trim();
    if (!trimmedName) {
      return undefined;
    }

    const color = input.color?.trim() || DEFAULT_TAG_COLOR;
    let created: CocktailTag | undefined;

    setCustomCocktailTags((prev) => {
      const nextId = getNextCustomTagId(prev, BUILTIN_COCKTAIL_TAG_MAX);
      created = { id: nextId, name: trimmedName, color };
      return [...prev, created].sort((a, b) => compareOptionalGlobalAlphabet(a.name, b.name));
    });

    return created;
  }, []);

  const updateCustomCocktailTag = useCallback(
    (id: number, input: { name: string; color?: string | null }) => {
      const tagId = Number(id);
      if (!Number.isFinite(tagId) || tagId < 0) {
        return undefined;
      }

      const trimmedName = input.name?.trim();
      if (!trimmedName) {
        return undefined;
      }

      const color = input.color?.trim() || DEFAULT_TAG_COLOR;
      let updated: CocktailTag | undefined;

      setCustomCocktailTags((prev) => {
        const index = prev.findIndex((tag) => Number(tag.id ?? -1) === Math.trunc(tagId));
        if (index < 0) {
          return prev;
        }

        updated = { id: prev[index].id, name: trimmedName, color };
        const next = [...prev];
        next[index] = updated;
        next.sort((a, b) => compareOptionalGlobalAlphabet(a.name, b.name));
        return next;
      });

      if (updated) {
        setInventoryState((prev) => {
          if (!prev) {
            return prev;
          }

          let didChange = false;
          const nextCocktails = prev.cocktails.map((cocktail) => {
            if (!cocktail.tags?.length) {
              return cocktail;
            }

            let didUpdateTag = false;
            const nextTags = cocktail.tags.map((tag) => {
              if (Number(tag.id ?? -1) === updated!.id) {
                didUpdateTag = true;
                return { ...tag, name: updated!.name, color: updated!.color };
              }
              return tag;
            });

            if (!didUpdateTag) {
              return cocktail;
            }

            didChange = true;
            return { ...cocktail, tags: nextTags } satisfies Cocktail;
          });

          return didChange
            ? ({
              ...prev,
              cocktails: nextCocktails,
            } satisfies InventoryState)
            : prev;
        });
      }

      return updated;
    },
    [],
  );

  const deleteCustomCocktailTag = useCallback((id: number) => {
    const tagId = Number(id);
    if (!Number.isFinite(tagId) || tagId < 0) {
      return false;
    }

    let didRemove = false;
    setCustomCocktailTags((prev) => {
      const next = prev.filter((tag) => Number(tag.id ?? -1) !== Math.trunc(tagId));
      didRemove = next.length !== prev.length;
      return didRemove ? next : prev;
    });

    if (didRemove) {
      setInventoryState((prev) => {
        if (!prev) {
          return prev;
        }

        let didChange = false;
        const nextCocktails = prev.cocktails.map((cocktail) => {
          if (!cocktail.tags?.length) {
            return cocktail;
          }

          const nextTags = cocktail.tags.filter((tag) => Number(tag.id ?? -1) !== Math.trunc(tagId));
          if (nextTags.length !== cocktail.tags.length) {
            didChange = true;
            return { ...cocktail, tags: nextTags.length ? nextTags : undefined } satisfies Cocktail;
          }
          return cocktail;
        });

        return didChange
          ? ({
            ...prev,
            cocktails: nextCocktails,
          } satisfies InventoryState)
          : prev;
      });
    }

    return didRemove;
  }, []);

  const createCustomIngredientTag = useCallback((input: { name: string; color?: string | null }) => {
    const trimmedName = input.name?.trim();
    if (!trimmedName) {
      return undefined;
    }

    const color = input.color?.trim() || DEFAULT_TAG_COLOR;
    let created: IngredientTag | undefined;

    setCustomIngredientTags((prev) => {
      const nextId = getNextCustomTagId(prev, BUILTIN_INGREDIENT_TAG_MAX);
      created = { id: nextId, name: trimmedName, color };
      return [...prev, created].sort((a, b) => compareOptionalGlobalAlphabet(a.name, b.name));
    });

    return created;
  }, []);

  const updateCustomIngredientTag = useCallback(
    (id: number, input: { name: string; color?: string | null }) => {
      const tagId = Number(id);
      if (!Number.isFinite(tagId) || tagId < 0) {
        return undefined;
      }

      const trimmedName = input.name?.trim();
      if (!trimmedName) {
        return undefined;
      }

      const color = input.color?.trim() || DEFAULT_TAG_COLOR;
      let updated: IngredientTag | undefined;

      setCustomIngredientTags((prev) => {
        const index = prev.findIndex((tag) => Number(tag.id ?? -1) === Math.trunc(tagId));
        if (index < 0) {
          return prev;
        }

        updated = { id: prev[index].id, name: trimmedName, color };
        const next = [...prev];
        next[index] = updated;
        next.sort((a, b) => compareOptionalGlobalAlphabet(a.name, b.name));
        return next;
      });

      if (updated) {
        setInventoryState((prev) => {
          if (!prev) {
            return prev;
          }

          let didChange = false;
          const nextIngredients = prev.ingredients.map((ingredient) => {
            if (!ingredient.tags?.length) {
              return ingredient;
            }

            let didUpdateTag = false;
            const nextTags = ingredient.tags.map((tag) => {
              if (Number(tag.id ?? -1) === updated!.id) {
                didUpdateTag = true;
                return { ...tag, name: updated!.name, color: updated!.color };
              }
              return tag;
            });

            if (!didUpdateTag) {
              return ingredient;
            }

            didChange = true;
            return { ...ingredient, tags: nextTags } satisfies Ingredient;
          });

          return didChange
            ? ({
              ...prev,
              ingredients: nextIngredients,
            } satisfies InventoryState)
            : prev;
        });
      }

      return updated;
    },
    [],
  );

  const deleteCustomIngredientTag = useCallback((id: number) => {
    const tagId = Number(id);
    if (!Number.isFinite(tagId) || tagId < 0) {
      return false;
    }

    let didRemove = false;
    setCustomIngredientTags((prev) => {
      const next = prev.filter((tag) => Number(tag.id ?? -1) !== Math.trunc(tagId));
      didRemove = next.length !== prev.length;
      return didRemove ? next : prev;
    });

    if (didRemove) {
      setInventoryState((prev) => {
        if (!prev) {
          return prev;
        }

        let didChange = false;
        const nextIngredients = prev.ingredients.map((ingredient) => {
          if (!ingredient.tags?.length) {
            return ingredient;
          }

          const nextTags = ingredient.tags.filter((tag) => Number(tag.id ?? -1) !== Math.trunc(tagId));
          if (nextTags.length !== ingredient.tags.length) {
            didChange = true;
            return { ...ingredient, tags: nextTags.length ? nextTags : undefined } satisfies Ingredient;
          }
          return ingredient;
        });

        return didChange
          ? ({
            ...prev,
            ingredients: nextIngredients,
          } satisfies InventoryState)
          : prev;
      });
    }

    return didRemove;
  }, []);

  const clearBaseIngredient = useCallback((id: number) => {
    setInventoryState((prev) => {
      if (!prev) {
        return prev;
      }

      let didChange = false;
      const nextIngredients = prev.ingredients.map((ingredient) => {
        if (
          Number(ingredient.id ?? -1) === id &&
          (ingredient.baseIngredientId != null || ingredient.styleIngredientId != null)
        ) {
          didChange = true;
          return { ...ingredient, baseIngredientId: undefined, styleIngredientId: undefined } satisfies Ingredient;
        }
        return ingredient;
      });

      if (!didChange) {
        return prev;
      }

      return {
        ...prev,
        ingredients: nextIngredients,
      } satisfies InventoryState;
    });
  }, []);

  const dataValue = useMemo(
    () => ({
      cocktails: localizedCocktails,
      ingredients: localizedIngredients,
      loading,
      availableIngredientIds,
      shoppingIngredientIds,
      customCocktailTags,
      customIngredientTags,
      ratingsByCocktailId,
      getCocktailRating,
    }),
    [
      localizedCocktails,
      localizedIngredients,
      loading,
      availableIngredientIds,
      shoppingIngredientIds,
      customCocktailTags,
      customIngredientTags,
      ratingsByCocktailId,
      getCocktailRating,
    ],
  );

  const settingsValue = useMemo(
    () => ({
      ignoreGarnish,
      allowAllSubstitutes,
      useImperialUnits,
      keepScreenAwake,
      shakerSmartFilteringEnabled,
      ratingFilterThreshold,
      startScreen,
      appTheme,
      appLocale,
      translationOverrides,
      amazonStoreOverride,
      detectedAmazonStore,
      effectiveAmazonStore,
      onboardingStep,
      onboardingCompleted,
    }),
    [
      ignoreGarnish,
      allowAllSubstitutes,
      useImperialUnits,
      keepScreenAwake,
      shakerSmartFilteringEnabled,
      ratingFilterThreshold,
      startScreen,
      appTheme,
      appLocale,
      translationOverrides,
      amazonStoreOverride,
      detectedAmazonStore,
      effectiveAmazonStore,
      onboardingStep,
      onboardingCompleted,
    ],
  );

  const actionsValue = useMemo(
    () => ({
      setIngredientAvailability,
      toggleIngredientAvailability,
      toggleIngredientShopping,
      clearBaseIngredient,
      createCocktail,
      createIngredient,
      resetInventoryFromBundle,
      exportInventoryData,
      exportInventoryPhotoEntries,
      importInventoryData,
      importInventoryPhotos,
      updateCocktail,
      updateIngredient,
      deleteCocktail,
      deleteIngredient,
      createCustomCocktailTag,
      updateCustomCocktailTag,
      deleteCustomCocktailTag,
      createCustomIngredientTag,
      updateCustomIngredientTag,
      deleteCustomIngredientTag,
      setCocktailRating,
      setIgnoreGarnish: handleSetIgnoreGarnish,
      setAllowAllSubstitutes: handleSetAllowAllSubstitutes,
      setUseImperialUnits: handleSetUseImperialUnits,
      setKeepScreenAwake: handleSetKeepScreenAwake,
      setShakerSmartFilteringEnabled: handleSetShakerSmartFilteringEnabled,
      setRatingFilterThreshold: handleSetRatingFilterThreshold,
      setStartScreen: handleSetStartScreen,
      setAppTheme: handleSetAppTheme,
      setAppLocale,
      setAmazonStoreOverride: handleSetAmazonStoreOverride,
      setOnboardingStep,
      completeOnboarding,
      restartOnboarding,
    }),
    [
      setIngredientAvailability,
      toggleIngredientAvailability,
      toggleIngredientShopping,
      clearBaseIngredient,
      createCocktail,
      createIngredient,
      resetInventoryFromBundle,
      exportInventoryData,
      exportInventoryPhotoEntries,
      importInventoryData,
      importInventoryPhotos,
      updateCocktail,
      updateIngredient,
      deleteCocktail,
      deleteIngredient,
      createCustomCocktailTag,
      updateCustomCocktailTag,
      deleteCustomCocktailTag,
      createCustomIngredientTag,
      updateCustomIngredientTag,
      deleteCustomIngredientTag,
      setCocktailRating,
      handleSetIgnoreGarnish,
      handleSetAllowAllSubstitutes,
      handleSetUseImperialUnits,
      handleSetKeepScreenAwake,
      handleSetShakerSmartFilteringEnabled,
      handleSetRatingFilterThreshold,
      handleSetStartScreen,
      handleSetAppTheme,
      setAppLocale,
      handleSetAmazonStoreOverride,
      setOnboardingStep,
      completeOnboarding,
      restartOnboarding,
    ],
  );

  return (
    <InventoryDataContext.Provider value={dataValue}>
      <InventorySettingsContext.Provider value={settingsValue}>
        <InventoryActionsContext.Provider value={actionsValue}>
          {children}
        </InventoryActionsContext.Provider>
      </InventorySettingsContext.Provider>
    </InventoryDataContext.Provider>
  );
}

export function useInventory() {
  const data = useInventoryData();
  const settings = useInventorySettings();
  const actions = useInventoryActions();

  return useMemo(() => ({ ...data, ...settings, ...actions }), [actions, data, settings]);
}

export { useInventoryActions, useInventoryData, useInventorySettings };

export type { AppTheme, Cocktail, CreateCocktailInput, CreateIngredientInput, Ingredient, StartScreen };
