import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BUILTIN_COCKTAIL_TAGS } from '@/constants/cocktail-tags';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import { TAG_COLORS } from '@/constants/tag-colors';
import { AMAZON_STORES, detectAmazonStoreFromStoreOrLocale, detectUsStorefrontOrLocale, getEffectiveAmazonStore, type AmazonStoreKey, type AmazonStoreOverride } from '@/libs/amazon-stores';
import { DEFAULT_LOCALE, isSupportedLocale, translate } from '@/libs/i18n';
import type { SupportedLocale } from '@/libs/i18n/types';
import { localizeCocktails, localizeIngredients } from '@/libs/i18n/catalog-overlay';
import { loadInventoryData, reloadInventoryData } from '@/libs/inventory-data';
import {
  loadInventorySnapshot,
  persistInventorySnapshot,
} from '@/libs/inventory-storage';
import {
  signInWithGoogle,
  uploadToGoogleDrive,
  downloadFromGoogleDrive as downloadToGoogleDrive,
  getFileMetadata,
  getAccessToken,
  clearAccessToken,
  type GoogleUser,
} from '@/libs/google-drive-sync';
import {
  base64ToBytes,
  bytesToBase64,
  parseTarArchive,
  createTarArchive,
} from '@/libs/archive-utils';
import * as FileSystem from 'expo-file-system/legacy';
import { buildPhotoBaseName } from '@/libs/photo-utils';
import {
  areStorageRecordsEqual,
  hydrateInventoryTagsFromCode,
  BACKUP_PHOTO_URI_PATTERN,
  normalizePhotoUriForBackup,
  normalizeSearchFields,
  normalizeSynonyms,
  normalizeTagIds,
  toCocktailStorageRecord,
  toIngredientStorageRecord,
} from '@/libs/inventory-utils';
import { toSortedArray } from '@/providers/inventory/persistence/inventory-snapshot';
import { normalizeSearchText } from '@/libs/search-normalization';
import { compareGlobalAlphabet, compareOptionalGlobalAlphabet } from '@/libs/global-sort';
import {
  type Bar,
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
  type InventoryImportOptions,
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
  readInventoryRuntimeCache,
  writeInventoryRuntimeCache,
} from '@/providers/inventory/model/inventory-runtime-cache';
import {
  buildInventoryDelta,
  buildInventorySnapshot,
  createInventoryBaseMaps,
  INVENTORY_SNAPSHOT_VERSION,
  sanitizeCocktailComments,
  sanitizeCocktailRatings,
} from '@/providers/inventory/persistence/inventory-snapshot';
import {
  buildCocktailFeedbackExport,
  buildIngredientStatusExport,
  parseCocktailFeedbackImport,
  parseIngredientStatusImport,
  type CocktailFeedbackExport,
} from '@/providers/inventory/model/inventory-provider-mappers';
import {
  createIngredientIdSet,
  sanitizeAmazonStoreOverride,
  sanitizeAppLocale,
  sanitizeAppTheme,
  sanitizeCocktailDefaultServings,
  sanitizeStartScreen,
} from '@/providers/inventory/model/inventory-provider-sanitizers';
import {
  getNextCustomTagId,
  sanitizePartySelectedCocktailKeys,
  sanitizeCustomTags,
  sanitizeTranslationOverrides,
} from '@/providers/inventory/model/inventory-provider-utils';
import { rehydrateBuiltInTags } from '@/providers/inventory/model/inventory-provider-rehydration';

const DEFAULT_START_SCREEN: StartScreen = 'cocktails_all';
const DEFAULT_APP_THEME: AppTheme = 'light';
const DEFAULT_APP_LOCALE: AppLocale = DEFAULT_LOCALE;


function getDefaultBarName(locale: AppLocale): string {
  return translate(locale, 'barManager.defaultName');
}

const DEFAULT_TAG_COLOR = TAG_COLORS[0];
const BUILTIN_COCKTAIL_TAG_MAX = BUILTIN_COCKTAIL_TAGS.reduce((max, tag) => Math.max(max, tag.id), 0);
const BUILTIN_INGREDIENT_TAG_MAX = BUILTIN_INGREDIENT_TAGS.reduce((max, tag) => Math.max(max, tag.id), 0);
const USER_CREATED_ID_START = 10000;

const MIN_COCKTAIL_DEFAULT_SERVINGS = 1;
const MAX_COCKTAIL_DEFAULT_SERVINGS = 6;

type InventoryProviderProps = {
  children: React.ReactNode;
};

export function InventoryProvider({ children }: InventoryProviderProps) {
  const baseMaps = useMemo(() => createInventoryBaseMaps(loadInventoryData()), []);
  const baseInventoryData = baseMaps.baseData;
  const runtimeCache = useMemo(() => readInventoryRuntimeCache(), []);
  const [inventoryState, setInventoryState] = useState<InventoryState | undefined>(
    () => runtimeCache.inventoryState,
  );
  const [loading, setLoading] = useState<boolean>(() => !runtimeCache.inventoryState);
  const [availableIngredientIds, setAvailableIngredientIds] = useState<Set<number>>(() =>
    runtimeCache.availableIngredientIds
      ? new Set(runtimeCache.availableIngredientIds)
      : new Set(),
  );
  const [shoppingIngredientIds, setShoppingIngredientIds] = useState<Set<number>>(() =>
    runtimeCache.shoppingIngredientIds
      ? new Set(runtimeCache.shoppingIngredientIds)
      : new Set(),
  );
  const [ratingsByCocktailId, setRatingsByCocktailId] = useState<Record<string, number>>(() =>
    sanitizeCocktailRatings(runtimeCache.cocktailRatings),
  );
  const [commentsByCocktailId, setCommentsByCocktailId] = useState<Record<string, string>>(() =>
    sanitizeCocktailComments(runtimeCache.cocktailComments),
  );
  const [ignoreGarnish, setIgnoreGarnish] = useState<boolean>(
    () => runtimeCache.ignoreGarnish ?? true,
  );
  const [allowAllSubstitutes, setAllowAllSubstitutes] = useState<boolean>(
    () => runtimeCache.allowAllSubstitutes ?? true,
  );
  const shouldDefaultToImperialUnits = useMemo(() => detectUsStorefrontOrLocale(), []);
  const [useImperialUnits, setUseImperialUnits] = useState<boolean>(
    () => (runtimeCache.useImperialUnits ?? false) || shouldDefaultToImperialUnits,
  );
  const [keepScreenAwake, setKeepScreenAwake] = useState<boolean>(
    () => runtimeCache.keepScreenAwake ?? true,
  );
  const [shakerSmartFilteringEnabled, setShakerSmartFilteringEnabled] = useState<boolean>(
    () => runtimeCache.shakerSmartFilteringEnabled ?? false,
  );
  const [showTabCounters, setShowTabCounters] = useState<boolean>(
    () => runtimeCache.showTabCounters ?? false,
  );
  const [partySelectedCocktailKeys, setPartySelectedCocktailKeys] = useState<Set<string>>(() =>
    runtimeCache.partySelectedCocktailKeys
      ? new Set(runtimeCache.partySelectedCocktailKeys)
      : new Set(),
  );
  const [ratingFilterThreshold, setRatingFilterThreshold] = useState<number>(() =>
    typeof runtimeCache.ratingFilterThreshold === 'number'
      ? Math.min(5, Math.max(1, Math.round(runtimeCache.ratingFilterThreshold)))
      : 1,
  );
  const [startScreen, setStartScreen] = useState<StartScreen>(
    () => runtimeCache.startScreen ?? DEFAULT_START_SCREEN,
  );
  const [appTheme, setAppTheme] = useState<AppTheme>(
    () => runtimeCache.appTheme ?? DEFAULT_APP_THEME,
  );
  const [amazonStoreOverride, setAmazonStoreOverride] = useState<AmazonStoreOverride | null>(
    () => sanitizeAmazonStoreOverride(runtimeCache.amazonStoreOverride, AMAZON_STORES) as AmazonStoreOverride | null,
  );
  const [appLocale, setAppLocale] = useState<AppLocale>(
    () => sanitizeAppLocale(runtimeCache.appLocale, isSupportedLocale, DEFAULT_APP_LOCALE) as AppLocale,
  );
  const [translationOverrides, setTranslationOverrides] = useState<InventoryTranslationOverrides>({});
  const [customCocktailTags, setCustomCocktailTags] = useState<CocktailTag[]>(() =>
    sanitizeCustomTags(runtimeCache.customCocktailTags, DEFAULT_TAG_COLOR, compareGlobalAlphabet),
  );
  const [customIngredientTags, setCustomIngredientTags] = useState<IngredientTag[]>(() =>
    sanitizeCustomTags(runtimeCache.customIngredientTags, DEFAULT_TAG_COLOR, compareGlobalAlphabet),
  );
  const [bars, setBars] = useState<Bar[]>(() => runtimeCache.bars ?? []);
  const [activeBarId, setActiveBarId] = useState<string>(
    () => runtimeCache.activeBarId ?? '',
  );
  const [onboardingStep, setOnboardingStep] = useState<number>(
    () => Math.max(1, Math.min(11, Math.trunc(runtimeCache.onboardingStep ?? 1))),
  );
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(
    () => runtimeCache.onboardingCompleted ?? false,
  );
  const [onboardingStarterApplied, setOnboardingStarterApplied] = useState<boolean>(
    () => runtimeCache.onboardingStarterApplied ?? false,
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(
    () => runtimeCache.lastSyncTime ?? null,
  );
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(
    () => runtimeCache.googleUser ?? null,
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
  const isValidInventoryExportFile = (candidate: unknown): candidate is InventoryExportFile => {
    if (!candidate || typeof candidate !== 'object') {
      return false;
    }

    const record = candidate as { kind?: unknown; schemaVersion?: unknown };
    return (record.kind === 'base' || record.kind === 'translations') && typeof record.schemaVersion === 'number';
  };

  const parsePhotoEntryFromArchivePath = (path: string): {
    type: ImportedPhotoEntry['type'];
    id: number;
    extension: string;
  } | null => {
    const normalizedPath = path.trim().replace(/^\/+/, '');
    const [category, filename] = normalizedPath.split('/');
    if (!category || !filename) {
      return null;
    }

    if (category !== 'cocktails' && category !== 'ingredients') {
      return null;
    }

    const extensionMatch = filename.match(/\.([a-zA-Z0-9]+)$/);
    const extension = extensionMatch?.[1]?.toLowerCase() ?? 'jpg';
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

  const applyInventoryBootstrap = useCallback(
    (bootstrap: {
      inventoryState: InventoryState;
      availableIngredientIds: Set<number>;
      shoppingIngredientIds: Set<number>;
      ratingsByCocktailId: Record<string, number>;
      commentsByCocktailId: Record<string, string>;
      partySelectedCocktailKeys: Set<string>;
      ignoreGarnish: boolean;
      allowAllSubstitutes: boolean;
      useImperialUnits: boolean;
      keepScreenAwake: boolean;
      shakerSmartFilteringEnabled: boolean;
      showTabCounters: boolean;
      ratingFilterThreshold: number;
      startScreen: StartScreen;
      appTheme: AppTheme;
      appLocale: AppLocale;
      translationOverrides: InventoryTranslationOverrides;
      amazonStoreOverride: AmazonStoreOverride | null;
      customCocktailTags: CocktailTag[];
      customIngredientTags: IngredientTag[];
      bars: Bar[];
      activeBarId: string;
      onboardingStep: number;
      onboardingCompleted: boolean;
      onboardingStarterApplied: boolean;
      lastSyncTime?: string | null;
      googleUser?: GoogleUser | null;
    }) => {
      setInventoryState(bootstrap.inventoryState);
      setAvailableIngredientIds(bootstrap.availableIngredientIds);
      setShoppingIngredientIds(bootstrap.shoppingIngredientIds);
      setRatingsByCocktailId(bootstrap.ratingsByCocktailId);
      setCommentsByCocktailId(bootstrap.commentsByCocktailId);
      setPartySelectedCocktailKeys(bootstrap.partySelectedCocktailKeys);
      setIgnoreGarnish(bootstrap.ignoreGarnish);
      setAllowAllSubstitutes(bootstrap.allowAllSubstitutes);
      setUseImperialUnits(bootstrap.useImperialUnits);
      setKeepScreenAwake(bootstrap.keepScreenAwake);
      setShakerSmartFilteringEnabled(bootstrap.shakerSmartFilteringEnabled);
      setShowTabCounters(bootstrap.showTabCounters);
      setRatingFilterThreshold(bootstrap.ratingFilterThreshold);
      setStartScreen(bootstrap.startScreen);
      setAppTheme(bootstrap.appTheme);
      setAppLocale(bootstrap.appLocale);
      setTranslationOverrides(bootstrap.translationOverrides);
      setAmazonStoreOverride(bootstrap.amazonStoreOverride);
      setCustomCocktailTags(bootstrap.customCocktailTags);
      setCustomIngredientTags(bootstrap.customIngredientTags);
      setBars(bootstrap.bars);
      setActiveBarId(bootstrap.activeBarId);
      setOnboardingStep(bootstrap.onboardingStep);
      setOnboardingCompleted(bootstrap.onboardingCompleted);
      setOnboardingStarterApplied(bootstrap.onboardingStarterApplied);
      setLastSyncTime(bootstrap.lastSyncTime ?? null);
      setGoogleUser(bootstrap.googleUser ?? null);
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
        if (stored && (stored.version === INVENTORY_SNAPSHOT_VERSION || (stored as any).version === 2 || (stored as any).version === 1) && !cancelled) {
          const castedStored = stored as any;
          const nextInventoryState = rehydrateBuiltInTags(
            createInventoryStateFromSnapshot(stored, baseInventoryData),
            BUILTIN_COCKTAIL_TAGS,
            BUILTIN_INGREDIENT_TAGS,
          );
          const nextAvailableIds = createIngredientIdSet(stored.availableIngredientIds);
          const nextShoppingIds = createIngredientIdSet(stored.shoppingIngredientIds);
          const nextRatings = sanitizeCocktailRatings(stored.cocktailRatings);
          const nextComments = sanitizeCocktailComments((stored as { cocktailComments?: Record<string, string> }).cocktailComments);
          const nextPartySelectedCocktailKeys = sanitizePartySelectedCocktailKeys(
            (stored as { partySelectedCocktailKeys?: string[] }).partySelectedCocktailKeys,
          );
          const nextIgnoreGarnish = stored.ignoreGarnish ?? true;
          const nextAllowAllSubstitutes = stored.allowAllSubstitutes ?? true;
          const nextUseImperialUnits = (stored.useImperialUnits ?? false) || shouldDefaultToImperialUnits;
          const nextKeepScreenAwake = stored.keepScreenAwake ?? true;
          const nextShakerSmartFilteringEnabled = stored.shakerSmartFilteringEnabled ?? false;
          const nextShowTabCounters = stored.showTabCounters ?? false;
          const nextRatingFilterThreshold = Math.min(
            5,
            Math.max(1, Math.round(stored.ratingFilterThreshold ?? 1)),
          );
          const nextStartScreen = sanitizeStartScreen(stored.startScreen, DEFAULT_START_SCREEN) as StartScreen;
          const nextAppTheme = sanitizeAppTheme(stored.appTheme, DEFAULT_APP_THEME) as AppTheme;
          const nextAmazonStoreOverride = sanitizeAmazonStoreOverride(stored.amazonStoreOverride, AMAZON_STORES) as AmazonStoreOverride | null;
          const nextAppLocale = sanitizeAppLocale(stored.appLocale, isSupportedLocale, DEFAULT_APP_LOCALE) as AppLocale;
          const nextCustomCocktailTags = sanitizeCustomTags(
            'customCocktailTags' in stored ? stored.customCocktailTags : undefined,
            DEFAULT_TAG_COLOR,
            compareGlobalAlphabet,
          );
          const nextCustomIngredientTags = sanitizeCustomTags(
            'customIngredientTags' in stored ? stored.customIngredientTags : undefined,
            DEFAULT_TAG_COLOR,
            compareGlobalAlphabet,
          );
          const nextTranslationOverrides = sanitizeTranslationOverrides<InventoryTranslationOverrides>(
            (stored as { translationOverrides?: unknown }).translationOverrides,
            isSupportedLocale,
          );
          const nextOnboardingStep = Math.max(1, Math.min(11, Math.trunc((stored as { onboardingStep?: number }).onboardingStep ?? 1)));
          const nextOnboardingCompleted = (stored as { onboardingCompleted?: boolean }).onboardingCompleted ?? false;
          const nextOnboardingStarterApplied = (stored as { onboardingStarterApplied?: boolean }).onboardingStarterApplied ?? false;
          const nextLastSyncTime = (stored as { lastSyncTime?: string }).lastSyncTime ?? null;
          const nextGoogleUser = (stored as { googleUser?: GoogleUser }).googleUser ?? null;

          let nextBars: Bar[] = castedStored.bars ?? [];
          let nextActiveBarId: string = castedStored.activeBarId ?? '';

          if (nextBars.length === 0) {
            nextActiveBarId = Date.now().toString();
            nextBars = [{
              id: nextActiveBarId,
              name: getDefaultBarName(nextAppLocale),
              availableIngredientIds: toSortedArray(nextAvailableIds),
              shoppingIngredientIds: toSortedArray(nextShoppingIds),
            }];
          }

          applyInventoryBootstrap({
            inventoryState: nextInventoryState,
            availableIngredientIds: nextAvailableIds,
            shoppingIngredientIds: nextShoppingIds,
            ratingsByCocktailId: nextRatings,
            commentsByCocktailId: nextComments,
            partySelectedCocktailKeys: nextPartySelectedCocktailKeys,
            ignoreGarnish: nextIgnoreGarnish,
            allowAllSubstitutes: nextAllowAllSubstitutes,
            useImperialUnits: nextUseImperialUnits,
            keepScreenAwake: nextKeepScreenAwake,
            shakerSmartFilteringEnabled: nextShakerSmartFilteringEnabled,
            showTabCounters: nextShowTabCounters,
            ratingFilterThreshold: nextRatingFilterThreshold,
            startScreen: nextStartScreen,
            appTheme: nextAppTheme,
            appLocale: nextAppLocale,
            translationOverrides: nextTranslationOverrides,
            amazonStoreOverride: nextAmazonStoreOverride,
            customCocktailTags: nextCustomCocktailTags,
            customIngredientTags: nextCustomIngredientTags,
            bars: nextBars,
            activeBarId: nextActiveBarId,
            onboardingStep: nextOnboardingStep,
            onboardingCompleted: nextOnboardingCompleted,
            onboardingStarterApplied: nextOnboardingStarterApplied,
            lastSyncTime: nextLastSyncTime,
            googleUser: nextGoogleUser,
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
            commentsByCocktailId: {},
            partySelectedCocktailKeys: new Set<string>(),
            ignoreGarnish: true,
            allowAllSubstitutes: true,
            useImperialUnits: shouldDefaultToImperialUnits,
            keepScreenAwake: true,
            shakerSmartFilteringEnabled: false,
            showTabCounters: false,
            ratingFilterThreshold: 1,
            startScreen: DEFAULT_START_SCREEN,
            appTheme: DEFAULT_APP_THEME,
            appLocale: DEFAULT_APP_LOCALE,
            translationOverrides: {},
            amazonStoreOverride: null,
            customCocktailTags: [],
            customIngredientTags: [],
            bars: [{
              id: '1',
              name: getDefaultBarName(DEFAULT_APP_LOCALE),
              availableIngredientIds: [],
              shoppingIngredientIds: [],
            }],
            activeBarId: '1',
            onboardingStep: 1,
            onboardingCompleted: false,
            onboardingStarterApplied: false,
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
    if (!activeBarId) {
      return;
    }

    setBars((prevBars) => {
      const activeBar = prevBars.find((bar) => bar.id === activeBarId);
      if (!activeBar) {
        return prevBars;
      }

      const nextAvailable = toSortedArray(availableIngredientIds);
      const nextShopping = toSortedArray(shoppingIngredientIds);

      const hasChanges =
        JSON.stringify(activeBar.availableIngredientIds) !== JSON.stringify(nextAvailable) ||
        JSON.stringify(activeBar.shoppingIngredientIds) !== JSON.stringify(nextShopping);

      if (!hasChanges) {
        return prevBars;
      }

      return prevBars.map((bar) =>
        bar.id === activeBarId
          ? { ...bar, availableIngredientIds: nextAvailable, shoppingIngredientIds: nextShopping }
          : bar,
      );
    });
  }, [activeBarId, availableIngredientIds, shoppingIngredientIds]);

  useEffect(() => {
    if (!inventoryState || !inventoryDelta) {
      return;
    }

    setLoading(false);
    writeInventoryRuntimeCache({
      inventoryState,
      availableIngredientIds,
      shoppingIngredientIds,
      cocktailRatings: ratingsByCocktailId,
      cocktailComments: commentsByCocktailId,
      partySelectedCocktailKeys,
      ignoreGarnish,
      allowAllSubstitutes,
      useImperialUnits,
      keepScreenAwake,
      shakerSmartFilteringEnabled,
      showTabCounters,
      ratingFilterThreshold,
      startScreen,
      appTheme,
      appLocale,
      amazonStoreOverride,
      customCocktailTags,
      customIngredientTags,
      bars,
      activeBarId,
      onboardingStep,
      onboardingCompleted,
      onboardingStarterApplied,
      isSyncing,
      lastSyncTime,
      googleUser,
    });

    const snapshot = buildInventorySnapshot(inventoryDelta, {
      availableIngredientIds,
      shoppingIngredientIds,
      ratingsByCocktailId,
      commentsByCocktailId,
      partySelectedCocktailKeys,
      ignoreGarnish,
      allowAllSubstitutes,
      useImperialUnits,
      keepScreenAwake,
      shakerSmartFilteringEnabled,
      showTabCounters,
      ratingFilterThreshold,
      startScreen,
      appTheme,
      appLocale,
      translationOverrides,
      amazonStoreOverride,
      customCocktailTags,
      customIngredientTags,
      bars,
      activeBarId,
      onboardingStep,
      onboardingCompleted,
      onboardingStarterApplied,
      lastSyncTime,
      googleUser,
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
    commentsByCocktailId,
    partySelectedCocktailKeys,
    ignoreGarnish,
    allowAllSubstitutes,
    useImperialUnits,
    keepScreenAwake,
    shakerSmartFilteringEnabled,
    showTabCounters,
    ratingFilterThreshold,
    startScreen,
    appTheme,
    appLocale,
    translationOverrides,
    amazonStoreOverride,
    customCocktailTags,
    customIngredientTags,
    bars,
    activeBarId,
    onboardingStep,
    onboardingCompleted,
    onboardingStarterApplied,
    isSyncing,
    lastSyncTime,
    googleUser,
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

  const setCocktailComment = useCallback(
    (cocktail: Cocktail, comment: string) => {
      const key = resolveCocktailKey(cocktail);
      if (!key) {
        return;
      }

      setCommentsByCocktailId((prev) => {
        const normalizedComment = comment.trim();
        if (!normalizedComment) {
          if (!(key in prev)) {
            return prev;
          }

          const next = { ...prev };
          delete next[key];
          return next;
        }

        if (prev[key] === normalizedComment) {
          return prev;
        }

        return { ...prev, [key]: normalizedComment };
      });
    },
    [resolveCocktailKey],
  );

  const getCocktailComment = useCallback(
    (cocktail: Cocktail) => {
      const key = resolveCocktailKey(cocktail);
      if (!key) {
        return '';
      }

      return commentsByCocktailId[key] ?? '';
    },
    [commentsByCocktailId, resolveCocktailKey],
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

        const sanitizedIngredients: CocktailIngredient[] = (input.ingredients ?? [])
          .flatMap((ingredient, index) => {
            const trimmedIngredientName = ingredient.name?.trim();
            if (!trimmedIngredientName) {
              return [];
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
            const selectedIngredient =
              ingredientId != null
                ? prev.ingredients.find((item) => Number(item.id ?? -1) === ingredientId)
                : undefined;
            const isIceIngredient = selectedIngredient?.ingredientKind === 'ice';
            const optional = !isIceIngredient && ingredient.optional ? true : undefined;
            const garnish = !isIceIngredient && ingredient.garnish ? true : undefined;
            const process = isIceIngredient
              ? ingredient.serving ? undefined : true
              : ingredient.process
                ? true
                : undefined;
            const serving = isIceIngredient
              ? process ? undefined : true
              : ingredient.serving
                ? true
                : undefined;
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
              const substituteAmount = candidate.amount?.trim() || undefined;
              const normalizedSubstituteUnitId =
                candidate.unitId != null ? Number(candidate.unitId) : undefined;
              const substituteUnitId =
                normalizedSubstituteUnitId != null &&
                  Number.isFinite(normalizedSubstituteUnitId) &&
                  normalizedSubstituteUnitId >= 0
                  ? Math.trunc(normalizedSubstituteUnitId)
                  : undefined;

              substitutes.push({
                ingredientId: substituteIngredientId,
                name: substituteName,
                brand,
                amount: substituteAmount,
                unitId: substituteUnitId,
              });
            });

            const sanitizedIngredient: CocktailIngredient = {
              order: index + 1,
              ingredientId,
              name: trimmedIngredientName,
              amount,
              unitId,
              optional,
              garnish,
              process,
              serving,
              allowBaseSubstitution: allowBase,
              allowBrandSubstitution: allowBrand,
              allowStyleSubstitution: allowStyle,
              substitutes: substitutes.length > 0 ? substitutes : undefined,
            };

            return [sanitizedIngredient];
          });

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
        const video = input.video?.trim() || undefined;
        const synonyms = normalizeSynonyms(input.synonyms);
        const photoUri = input.photoUri?.trim() || undefined;
        const glassId = input.glassId?.trim() || undefined;
        const methodIds = input.methodIds
          ? Array.from(new Set(input.methodIds)).filter(Boolean)
          : undefined;
        const defaultServings = sanitizeCocktailDefaultServings(
          input.defaultServings,
          MIN_COCKTAIL_DEFAULT_SERVINGS,
          MAX_COCKTAIL_DEFAULT_SERVINGS,
        );

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
          video,
          synonyms,
          photoUri,
          glassId,
          methodIds: methodIds && methodIds.length > 0 ? methodIds : undefined,
          defaultServings,
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
        const nextVideo = input.video?.trim();
        const nextSynonyms = normalizeSynonyms(input.synonyms);
        const patch: CocktailTranslationOverride = {
          name: nextName,
          ...(nextDescription ? { description: nextDescription } : {}),
          ...(nextInstructions ? { instructions: nextInstructions } : {}),
          ...(nextVideo ? { video: nextVideo } : {}),
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
        const imageUrl = input.imageUrl?.trim() || undefined;
        const abv = input.abv != null && Number.isFinite(Number(input.abv)) ? Number(input.abv) : undefined;
        const barcodes = Array.from(new Set((input.barcodes ?? []).map((value) => value?.trim()).filter((value): value is string => Boolean(value))));

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
          imageUrl,
          abv,
          barcodes: barcodes.length > 0 ? barcodes : undefined,
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

  const exportInventoryData = useCallback((
    overrides?: {
      inventoryState?: InventoryState;
      availableIngredientIds?: Set<number>;
      shoppingIngredientIds?: Set<number>;
      ratingsByCocktailId?: Record<string, number>;
      commentsByCocktailId?: Record<string, string>;
      translationOverrides?: InventoryTranslationOverrides;
    }
  ): InventoryExportFile[] | null => {
    const state = overrides?.inventoryState ?? inventoryState;
    if (!state) {
      return null;
    }

    const baseCocktails = baseMaps.baseCocktails;
    const baseIngredients = baseMaps.baseIngredients;

    const cocktails = state.cocktails.reduce<InventoryExportData['cocktails']>((acc, cocktail) => {
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
    const ingredients = state.ingredients.reduce<InventoryExportData['ingredients']>((acc, ingredient) => {
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

    const exportFeedback = buildCocktailFeedbackExport(
      overrides?.ratingsByCocktailId ?? ratingsByCocktailId,
      overrides?.commentsByCocktailId ?? commentsByCocktailId,
      {
        ratings: sanitizeCocktailRatings,
        comments: sanitizeCocktailComments,
      },
    );
    const exportIngredientStatus = buildIngredientStatusExport(
      overrides?.availableIngredientIds ?? availableIngredientIds,
      overrides?.shoppingIngredientIds ?? shoppingIngredientIds,
      toSortedArray,
    );

    const files: InventoryExportFile[] = [{
      schemaVersion: 1,
      kind: 'base',
      data: {
        cocktails,
        ingredients,
        ...(Object.keys(exportFeedback).length > 0 ? { cocktailFeedback: exportFeedback } : {}),
        ...(Object.keys(exportIngredientStatus).length > 0 ? { ingredientStatus: exportIngredientStatus } : {}),
      },
    } satisfies InventoryBaseExportFile];

    (Object.entries(overrides?.translationOverrides ?? translationOverrides) as Array<[SupportedLocale, InventoryLocaleTranslationOverrides | undefined]>).forEach(([locale, localeData]) => {
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
  }, [
    availableIngredientIds,
    baseMaps,
    commentsByCocktailId,
    inventoryState,
    ratingsByCocktailId,
    shoppingIngredientIds,
    translationOverrides,
  ]);

  const exportInventoryPhotoEntries = useCallback((
    overrides?: { inventoryState?: InventoryState }
  ): PhotoBackupEntry[] | null => {
    const state = overrides?.inventoryState ?? inventoryState;
    if (!state) {
      return null;
    }

    const baseCocktails = baseMaps.baseCocktails;
    const baseIngredients = baseMaps.baseIngredients;

    return [
      ...state.cocktails.reduce<PhotoBackupEntry[]>((acc, cocktail) => {
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
      ...state.ingredients.reduce<PhotoBackupEntry[]>((acc, ingredient) => {
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

  const importInventoryData = useCallback((
    input: InventoryExportData | InventoryExportFile | InventoryExportFile[],
    options?: InventoryImportOptions,
  ): {
    ratings: Record<string, number>;
    comments: Record<string, string>;
    availableIngredientIds: Set<number>;
    shoppingIngredientIds: Set<number>;
    inventoryState?: InventoryState;
    translationOverrides?: InventoryTranslationOverrides;
  } => {
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

    const incomingFeedback = parseCocktailFeedbackImport(baseFile?.data, {
      ratings: sanitizeCocktailRatings,
      comments: sanitizeCocktailComments,
    });
    const incomingIngredientStatus = parseIngredientStatusImport(baseFile?.data);

    const mergeCocktailWithFallback = (current: Cocktail, incoming: Cocktail): Cocktail => {
      const currentVideo = current.video?.trim();
      const incomingVideo = incoming.video?.trim();

      return {
        ...incoming,
        ...(incomingVideo ? {} : (currentVideo ? { video: currentVideo } : {})),
      };
    };

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

    const resultRatings = { ...ratingsByCocktailId, ...incomingFeedback.ratings };
    const resultComments = { ...commentsByCocktailId, ...incomingFeedback.comments };

    if (Object.keys(incomingFeedback.ratings).length > 0) {
      setRatingsByCocktailId(resultRatings);
    }

    if (Object.keys(incomingFeedback.comments).length > 0) {
      setCommentsByCocktailId(resultComments);
    }

    const shouldImportIngredientAvailability = options?.importIngredientAvailability === true;
    const shouldImportIngredientShopping = options?.importIngredientShopping === true;

    const resultAvailable = shouldImportIngredientAvailability
      ? new Set([...availableIngredientIds, ...incomingIngredientStatus.availableIngredientIds])
      : availableIngredientIds;

    const resultShopping = shouldImportIngredientShopping
      ? new Set([...shoppingIngredientIds, ...incomingIngredientStatus.shoppingIngredientIds])
      : shoppingIngredientIds;

    if (shouldImportIngredientAvailability && incomingIngredientStatus.availableIngredientIds.size > 0) {
      setAvailableIngredientIds(resultAvailable);
    }

    if (shouldImportIngredientShopping && incomingIngredientStatus.shoppingIngredientIds.size > 0) {
      setShoppingIngredientIds(resultShopping);
    }

    let resultInventoryState = inventoryState;

    if (incomingState) {
      setInventoryState((prev) => {
        if (!prev) {
          return incomingState;
        }

        const currentCocktailsById = new Map<number, Cocktail>();
        prev.cocktails.forEach((cocktail) => {
          const id = Number(cocktail.id ?? -1);
          if (Number.isFinite(id) && id >= 0) {
            currentCocktailsById.set(Math.trunc(id), cocktail);
          }
        });

        const cocktailsForMerge = incomingState.cocktails.map((item) => {
          const id = Number(item.id ?? -1);
          if (!Number.isFinite(id) || id < 0) {
            return item;
          }

          const current = currentCocktailsById.get(Math.trunc(id));
          return current ? mergeCocktailWithFallback(current, item) : item;
        });

        resultInventoryState = {
          ...prev,
          imported: true,
          cocktails: mergeById(prev.cocktails, cocktailsForMerge),
          ingredients: mergeById(prev.ingredients, incomingState.ingredients),
        } satisfies InventoryState;
        return resultInventoryState;
      });
    }

    let resultTranslationOverrides = translationOverrides;

    if (translationFiles.length > 0) {
      setTranslationOverrides((prev) => {
        const next: InventoryTranslationOverrides = { ...prev };
        translationFiles.forEach((file) => {
          const locale = file.locale;
          const prevLocale = next[locale] ?? {};

          const mergedCocktails = { ...(prevLocale.cocktails ?? {}) };
          Object.entries(file.data.cocktails ?? {}).forEach(([id, value]) => {
            const previousValue = mergedCocktails[id] ?? {};
            mergedCocktails[id] = {
              ...previousValue,
              ...value,
            };
          });

          const mergedIngredients = { ...(prevLocale.ingredients ?? {}) };
          Object.entries(file.data.ingredients ?? {}).forEach(([id, value]) => {
            const previousValue = mergedIngredients[id] ?? {};
            mergedIngredients[id] = {
              ...previousValue,
              ...value,
            };
          });

          next[locale] = {
            ...prevLocale,
            cocktails: mergedCocktails,
            ingredients: mergedIngredients,
          };
        });
        resultTranslationOverrides = next;
        return next;
      });
    }

    return {
      ratings: resultRatings,
      comments: resultComments,
      availableIngredientIds: resultAvailable,
      shoppingIngredientIds: resultShopping,
      inventoryState: resultInventoryState,
      translationOverrides: resultTranslationOverrides,
    };
  }, [availableIngredientIds, commentsByCocktailId, inventoryState, ratingsByCocktailId, shoppingIngredientIds, translationOverrides]);

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
        const previous = prev.ingredients[ingredientIndex];
        const imageUrl = input.imageUrl?.trim() || previous?.imageUrl || undefined;
        const abv = input.abv != null && Number.isFinite(Number(input.abv))
          ? Number(input.abv)
          : previous?.abv ?? undefined;
        const barcodes = input.barcodes !== undefined
          ? Array.from(new Set((input.barcodes ?? []).map((value) => value?.trim()).filter((value): value is string => Boolean(value))))
          : previous?.barcodes ?? [];

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

        const candidateRecord = {
          ...previous,
          id: previous.id,
          name: trimmedName,
          description,
          synonyms,
          tags,
          baseIngredientId,
          styleIngredientId,
          photoUri,
          imageUrl,
          abv,
          barcodes: barcodes.length > 0 ? barcodes : undefined,
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

      const sanitizedIngredients: CocktailIngredient[] = (input.ingredients ?? [])
        .flatMap((ingredient, index) => {
          const trimmedIngredientName = ingredient.name?.trim();
          if (!trimmedIngredientName) {
            return [];
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
          const selectedIngredient =
            ingredientId != null
              ? prev.ingredients.find((item) => Number(item.id ?? -1) === ingredientId)
              : undefined;
          const isIceIngredient = selectedIngredient?.ingredientKind === 'ice';
          const optional = !isIceIngredient && ingredient.optional ? true : undefined;
          const garnish = !isIceIngredient && ingredient.garnish ? true : undefined;
          const process = isIceIngredient
            ? ingredient.serving ? undefined : true
            : ingredient.process
              ? true
              : undefined;
          const serving = isIceIngredient
            ? process ? undefined : true
            : ingredient.serving
              ? true
              : undefined;
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
            const substituteAmount = candidate.amount?.trim() || undefined;
            const normalizedSubstituteUnitId =
              candidate.unitId != null ? Number(candidate.unitId) : undefined;
            const substituteUnitId =
              normalizedSubstituteUnitId != null &&
                Number.isFinite(normalizedSubstituteUnitId) &&
                normalizedSubstituteUnitId >= 0
                ? Math.trunc(normalizedSubstituteUnitId)
                : undefined;

            substitutes.push({
              ingredientId: substituteIngredientId,
              name: substituteName,
              brand,
              amount: substituteAmount,
              unitId: substituteUnitId,
            });
          });

          const sanitizedIngredient: CocktailIngredient = {
            order: index + 1,
            ingredientId,
            name: trimmedIngredientName,
            amount,
            unitId,
            optional,
            garnish,
            process,
            serving,
            allowBaseSubstitution: allowBase,
            allowBrandSubstitution: allowBrand,
            allowStyleSubstitution: allowStyle,
            substitutes: substitutes.length > 0 ? substitutes : undefined,
          };

          return [sanitizedIngredient];
        });
      if (sanitizedIngredients.length === 0) {
        return prev;
      }

      const existing = prev.cocktails[existingIndex];
      const description = input.description?.trim() || undefined;
      const instructions = input.instructions?.trim() || undefined;
      const hasVideoInInput = Object.prototype.hasOwnProperty.call(input, 'video');
      const nextVideo = input.video?.trim();
      const video = hasVideoInInput
        ? (nextVideo || '')
        : (existing.video ?? undefined);
      const synonyms =
        input.synonyms !== undefined
          ? normalizeSynonyms(input.synonyms)
          : existing.synonyms ?? undefined;
      const photoUri = input.photoUri?.trim() || undefined;
      const glassId = input.glassId?.trim() || undefined;
      const methodIds = input.methodIds
        ? Array.from(new Set(input.methodIds)).filter(Boolean)
        : undefined;
      const defaultServings = sanitizeCocktailDefaultServings(
        input.defaultServings ?? (existing as { defaultServings?: number | null }).defaultServings,
        MIN_COCKTAIL_DEFAULT_SERVINGS,
        MAX_COCKTAIL_DEFAULT_SERVINGS,
      );

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
        description,
        instructions,
        video,
        synonyms,
        photoUri,
        glassId,
        methodIds: methodIds && methodIds.length > 0 ? methodIds : undefined,
        defaultServings,
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
      const hasVideoInInput = Object.prototype.hasOwnProperty.call(input, 'video');
      const nextVideo = input.video?.trim();
      const nextSynonyms = normalizeSynonyms(input.synonyms);
      const patch: CocktailTranslationOverride = {
        ...(nextName ? { name: nextName } : {}),
        ...(nextDescription ? { description: nextDescription } : {}),
        ...(nextInstructions ? { instructions: nextInstructions } : {}),
        ...(nextVideo ? { video: nextVideo } : {}),
        ...(((nextSynonyms ?? []).length > 0) ? { synonyms: nextSynonyms } : {}),
      };
      setTranslationOverrides((prev) => {
        const currentOverride = prev[appLocale]?.cocktails?.[key] ?? {};
        const merged = {
          ...currentOverride,
          ...patch,
        } as CocktailTranslationOverride;

        if (hasVideoInInput && !nextVideo) {
          delete merged.video;
        }

        return {
          ...prev,
          [appLocale]: {
            ...(prev[appLocale] ?? {}),
            cocktails: {
              ...((prev[appLocale]?.cocktails as Record<string, any> | undefined) ?? {}),
              [key]: merged,
            },
          },
        };
      });
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

  const togglePartyCocktailSelection = useCallback((key: string) => {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      return;
    }

    setPartySelectedCocktailKeys((previous) => {
      const next = new Set(previous);
      if (next.has(normalizedKey)) {
        next.delete(normalizedKey);
      } else {
        next.add(normalizedKey);
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

  const handleSetShowTabCounters = useCallback((value: boolean) => {
    setShowTabCounters(Boolean(value));
  }, []);

  const handleSetRatingFilterThreshold = useCallback((value: number) => {
    const normalized = Math.min(5, Math.max(1, Math.round(value)));
    setRatingFilterThreshold(normalized);
  }, []);

  const handleSetStartScreen = useCallback((value: StartScreen) => {
    setStartScreen(sanitizeStartScreen(value, DEFAULT_START_SCREEN) as StartScreen);
  }, []);

  const handleSetAppTheme = useCallback((value: AppTheme) => {
    setAppTheme(sanitizeAppTheme(value, DEFAULT_APP_THEME) as AppTheme);
  }, []);

  const handleSetAmazonStoreOverride = useCallback((value: AmazonStoreOverride | null) => {
    setAmazonStoreOverride(value == null ? null : sanitizeAmazonStoreOverride(value, AMAZON_STORES) as AmazonStoreOverride | null);
  }, []);

  const handleSetActiveBar = useCallback(
    (id: string) => {
      setBars((prevBars) => {
        const bar = prevBars.find((b) => b.id === id);
        if (bar) {
          setAvailableIngredientIds(createIngredientIdSet(bar.availableIngredientIds));
          setShoppingIngredientIds(createIngredientIdSet(bar.shoppingIngredientIds));
          setActiveBarId(id);
        }
        return prevBars;
      });
    },
    [],
  );

  const handleCreateBar = useCallback((name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    const newBar: Bar = {
      id: Date.now().toString(),
      name: trimmedName,
      availableIngredientIds: [],
      shoppingIngredientIds: [],
    };

    setBars((prev) => [...prev, newBar]);
    handleSetActiveBar(newBar.id);
  }, [handleSetActiveBar]);

  const handleUpdateBar = useCallback((id: string, name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    setBars((prev) =>
      prev.map((bar) => (bar.id === id ? { ...bar, name: trimmedName } : bar)),
    );
  }, []);

  const handleSignInWithGoogle = useCallback(async () => {
    try {
      const user = await signInWithGoogle();
      if (user) {
        setGoogleUser(user);
      }
    } catch (error) {
      console.error('Sign in with Google failed', error);
    }
  }, []);

  const handleSignOutFromGoogle = useCallback(async () => {
    await clearAccessToken();
    setGoogleUser(null);
  }, []);

  const handleSyncWithGoogleDrive = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!googleUser || !accessToken || isSyncing) {
      return;
    }

    setIsSyncing(true);
    try {
      // 1. Download and merge
      let mergedDataResult: ReturnType<typeof importInventoryData> | undefined;
      const remoteArchiveBase64 = await downloadToGoogleDrive(accessToken);
      if (remoteArchiveBase64) {
        const remoteBytes = base64ToBytes(remoteArchiveBase64);
        const remoteFiles = parseTarArchive(remoteBytes);

        const decoder = new TextDecoder();
        const importFiles: InventoryExportFile[] = [];
        for (const archived of remoteFiles) {
          if (archived.path.toLowerCase().endsWith('.json')) {
            const parsed = JSON.parse(decoder.decode(archived.contents)) as unknown;
            if (isValidInventoryExportFile(parsed)) {
              importFiles.push(parsed);
            }
          }
        }

        if (importFiles.length > 0) {
          mergedDataResult = importInventoryData(importFiles);

          const importedPhotoEntries: ImportedPhotoEntry[] = [];
          const timestamp = Date.now();
          const directory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
          const photosDir = `${directory!.replace(/\/?$/, '/')}imported-photos/`;
          await FileSystem.makeDirectoryAsync(photosDir, { intermediates: true });

          for (const file of remoteFiles) {
            if (!file.path.toLowerCase().endsWith('.json')) {
              const parsedPath = parsePhotoEntryFromArchivePath(file.path);
              if (parsedPath && file.contents.length > 0) {
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
            }
          }
          if (importedPhotoEntries.length > 0) {
            importInventoryPhotos(importedPhotoEntries);
          }
        }
      }

      // 2. Upload current state (merged if download occurred)
      const data = exportInventoryData(mergedDataResult ? {
        inventoryState: mergedDataResult.inventoryState,
        availableIngredientIds: mergedDataResult.availableIngredientIds,
        shoppingIngredientIds: mergedDataResult.shoppingIngredientIds,
        ratingsByCocktailId: mergedDataResult.ratings,
        commentsByCocktailId: mergedDataResult.comments,
        translationOverrides: mergedDataResult.translationOverrides,
      } : undefined);
      const photoEntries = exportInventoryPhotoEntries(mergedDataResult ? {
        inventoryState: mergedDataResult.inventoryState
      } : undefined);
      if (data && photoEntries) {
        const files: { path: string; contents: Uint8Array }[] = [];
        const encoder = new TextEncoder();
        data.forEach((file) => {
          const path = file.kind === 'base' ? 'base.json' : `translations.${file.locale}.json`;
          files.push({
            path,
            contents: encoder.encode(JSON.stringify(file, null, 2)),
          });
        });

        for (const entry of photoEntries) {
          if (entry.uri) {
            const info = await FileSystem.getInfoAsync(entry.uri);
            if (info.exists && !info.isDirectory) {
              const baseName = buildPhotoBaseName(entry.id || 'photo', entry.name ?? 'photo');
              const fileName = `${baseName}.jpg`;
              const contentsBase64 = await FileSystem.readAsStringAsync(entry.uri, {
                encoding: FileSystem.EncodingType.Base64,
              });
              files.push({ path: `${entry.type}/${fileName}`, contents: base64ToBytes(contentsBase64) });
            }
          }
        }

        const archiveBase64 = createTarArchive(files);
        await uploadToGoogleDrive(accessToken, archiveBase64);

        const metadata = await getFileMetadata(accessToken);
        setLastSyncTime(metadata?.modifiedTime || new Date().toISOString());
      }
    } catch (error) {
      console.error('Google Drive sync failed', error);
    } finally {
      setIsSyncing(false);
    }
  }, [googleUser, isSyncing, exportInventoryData, exportInventoryPhotoEntries, importInventoryData, importInventoryPhotos]);

  const handleDeleteBar = useCallback((id: string) => {
    setBars((prev) => {
      if (prev.length <= 1) {
        return prev;
      }

      const nextBars = prev.filter((bar) => bar.id !== id);
      if (activeBarId === id) {
        const firstRemaining = nextBars[0];
        setAvailableIngredientIds(createIngredientIdSet(firstRemaining.availableIngredientIds));
        setShoppingIngredientIds(createIngredientIdSet(firstRemaining.shoppingIngredientIds));
        setActiveBarId(firstRemaining.id);
      }
      return nextBars;
    });
  }, [activeBarId]);

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
      commentsByCocktailId,
      partySelectedCocktailKeys,
      getCocktailRating,
      getCocktailComment,
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
      commentsByCocktailId,
      partySelectedCocktailKeys,
      getCocktailRating,
      getCocktailComment,
    ],
  );

  const settingsValue = useMemo(
    () => ({
      ignoreGarnish,
      allowAllSubstitutes,
      useImperialUnits,
      keepScreenAwake,
      shakerSmartFilteringEnabled,
      showTabCounters,
      ratingFilterThreshold,
      startScreen,
      appTheme,
      appLocale,
      translationOverrides,
      amazonStoreOverride,
      detectedAmazonStore,
      effectiveAmazonStore,
      bars,
      activeBarId,
      onboardingStep,
      onboardingCompleted,
      onboardingStarterApplied,
      isSyncing,
      lastSyncTime,
      googleUser,
    }),
    [
      ignoreGarnish,
      allowAllSubstitutes,
      useImperialUnits,
      keepScreenAwake,
      shakerSmartFilteringEnabled,
      showTabCounters,
      ratingFilterThreshold,
      startScreen,
      appTheme,
      appLocale,
      translationOverrides,
      amazonStoreOverride,
      detectedAmazonStore,
      effectiveAmazonStore,
      bars,
      activeBarId,
      onboardingStep,
      onboardingCompleted,
      onboardingStarterApplied,
      isSyncing,
      lastSyncTime,
      googleUser,
    ],
  );

  const actionsValue = useMemo(
    () => ({
      setIngredientAvailability,
      toggleIngredientAvailability,
      toggleIngredientShopping,
      togglePartyCocktailSelection,
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
      setCocktailComment,
      setIgnoreGarnish: handleSetIgnoreGarnish,
      setAllowAllSubstitutes: handleSetAllowAllSubstitutes,
      setUseImperialUnits: handleSetUseImperialUnits,
      setKeepScreenAwake: handleSetKeepScreenAwake,
      setShakerSmartFilteringEnabled: handleSetShakerSmartFilteringEnabled,
      setShowTabCounters: handleSetShowTabCounters,
      setRatingFilterThreshold: handleSetRatingFilterThreshold,
      setStartScreen: handleSetStartScreen,
      setAppTheme: handleSetAppTheme,
      setAppLocale,
      setAmazonStoreOverride: handleSetAmazonStoreOverride,
      setOnboardingStep,
      setOnboardingCompleted,
      setOnboardingStarterApplied,
      setActiveBar: handleSetActiveBar,
      createBar: handleCreateBar,
      updateBar: handleUpdateBar,
      deleteBar: handleDeleteBar,
      signInWithGoogle: handleSignInWithGoogle,
      signOutFromGoogle: handleSignOutFromGoogle,
      syncWithGoogleDrive: handleSyncWithGoogleDrive,
    }),
    [
      setIngredientAvailability,
      toggleIngredientAvailability,
      toggleIngredientShopping,
      togglePartyCocktailSelection,
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
      setCocktailComment,
      handleSetIgnoreGarnish,
      handleSetAllowAllSubstitutes,
      handleSetUseImperialUnits,
      handleSetKeepScreenAwake,
      handleSetShakerSmartFilteringEnabled,
      handleSetShowTabCounters,
      handleSetRatingFilterThreshold,
      handleSetStartScreen,
      handleSetAppTheme,
      setAppLocale,
      handleSetAmazonStoreOverride,
      setOnboardingStep,
      setOnboardingCompleted,
      setOnboardingStarterApplied,
      handleSetActiveBar,
      handleCreateBar,
      handleUpdateBar,
      handleDeleteBar,
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

export type { AppTheme, Bar, Cocktail, CreateCocktailInput, CreateIngredientInput, Ingredient, StartScreen };
