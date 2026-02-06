import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { loadInventoryData, reloadInventoryData } from '@/libs/inventory-data';
import {
  clearInventorySnapshot,
  loadInventorySnapshot,
  persistInventorySnapshot,
  type InventoryDeltaSnapshot,
} from '@/libs/inventory-storage';
import {
  hydrateInventoryTagsFromCode,
} from '@/libs/inventory-utils';
import { normalizeSearchText } from '@/libs/search-normalization';
import { refreshBaseCache } from './inventory/persistence/base-cache';
import {
  calculateInventoryDelta,
  clearDeltaReferenceCache
} from './inventory/persistence/delta-calculator';
import {
  type AppTheme,
  type Cocktail,
  type CocktailStorageRecord,
  type CocktailTag,
  type CreateCocktailInput,
  type CreateIngredientInput,
  type Ingredient,
  type IngredientStorageRecord,
  type IngredientTag,
  type InventoryExportData,
  type PhotoBackupEntry,
  type StartScreen,
} from '@/providers/inventory-types';

import {
  InventoryActionsContext,
  useInventoryActions,
  type InventoryActionsContextValue,
} from './inventory/actions-context';
import {
  InventoryDataContext,
  useInventoryData,
  type InventoryDataContextValue,
} from './inventory/data-context';
import {
  InventorySettingsContext,
  useInventorySettings,
  type InventorySettingsContextValue,
} from './inventory/settings-context';

import {
  DEFAULT_APP_THEME,
  DEFAULT_START_SCREEN,
  DEFAULT_TAG_COLOR,
  sanitizeAppTheme,
  sanitizeCocktailRatings,
  sanitizeCustomTags,
  sanitizeStartScreen,
  createIngredientIdSet,
} from './inventory/model/sanitization';

import {
  createInventoryStateFromData,
  createInventoryStateFromSnapshot,
  type InventoryState,
} from './inventory/persistence/snapshot-logic';

import {
  createCocktailAction,
  updateCocktailAction,
  deleteCocktailAction,
  USER_CREATED_ID_START,
} from './inventory/model/cocktail-model';

import {
  createIngredientAction,
  updateIngredientAction,
  deleteIngredientAction,
  clearBaseIngredientAction,
} from './inventory/model/ingredient-model';

import {
  getNextCustomTagId,
  updateCocktailTagInState,
  deleteCocktailTagFromState,
  updateIngredientTagInState,
  deleteIngredientTagFromState,
  BUILTIN_COCKTAIL_TAG_MAX,
  BUILTIN_INGREDIENT_TAG_MAX,
} from './inventory/model/tag-model';

import {
  getExportInventoryData,
  getExportInventoryPhotoEntries,
} from './inventory/selectors/inventory-selectors';

import { createDeltaSnapshotFromInventory } from './inventory/persistence/snapshot';

const INVENTORY_SNAPSHOT_VERSION = 2;

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
  var __yourbarInventoryRatingFilterThreshold: number | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryStartScreen: StartScreen | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryAppTheme: AppTheme | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryCustomCocktailTags: CocktailTag[] | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryCustomIngredientTags: IngredientTag[] | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryOnboardingStep: number | undefined;
  // eslint-disable-next-line no-var
  var __yourbarInventoryOnboardingCompleted: boolean | undefined;
}

type InventoryProviderProps = {
  children: React.ReactNode;
};

export function InventoryProvider({ children }: InventoryProviderProps) {
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
  const [cocktailRatings, setCocktailRatings] = useState<Record<string, number>>(() =>
    sanitizeCocktailRatings(globalThis.__yourbarInventoryCocktailRatings),
  );
  const [ignoreGarnish, setIgnoreGarnish] = useState<boolean>(
    () => globalThis.__yourbarInventoryIgnoreGarnish ?? true,
  );
  const [allowAllSubstitutes, setAllowAllSubstitutes] = useState<boolean>(
    () => globalThis.__yourbarInventoryAllowAllSubstitutes ?? true,
  );
  const [useImperialUnits, setUseImperialUnits] = useState<boolean>(
    () => globalThis.__yourbarInventoryUseImperialUnits ?? false,
  );
  const [keepScreenAwake, setKeepScreenAwake] = useState<boolean>(
    () => globalThis.__yourbarInventoryKeepScreenAwake ?? true,
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
  const lastPersistedSnapshot = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (inventoryState) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const stored = await loadInventorySnapshot<CocktailStorageRecord, IngredientStorageRecord>();
        if (stored && (stored.version === INVENTORY_SNAPSHOT_VERSION || stored.version === 1) && !cancelled) {
          const baseData = loadInventoryData();
          setInventoryState(createInventoryStateFromSnapshot(stored, baseData));
          setAvailableIngredientIds(createIngredientIdSet(stored.availableIngredientIds));
          setShoppingIngredientIds(createIngredientIdSet(stored.shoppingIngredientIds));
          setCocktailRatings(sanitizeCocktailRatings(stored.cocktailRatings));
          setIgnoreGarnish(stored.ignoreGarnish ?? true);
          setAllowAllSubstitutes(stored.allowAllSubstitutes ?? true);
          setUseImperialUnits(stored.useImperialUnits ?? false);
          setKeepScreenAwake(stored.keepScreenAwake ?? true);
          setRatingFilterThreshold(Math.min(5, Math.max(1, Math.round(stored.ratingFilterThreshold ?? 1))));
          setStartScreen(sanitizeStartScreen(stored.startScreen));
          setAppTheme(sanitizeAppTheme(stored.appTheme));
          setCustomCocktailTags(sanitizeCustomTags(stored.customCocktailTags, DEFAULT_TAG_COLOR));
          setCustomIngredientTags(sanitizeCustomTags(stored.customIngredientTags, DEFAULT_TAG_COLOR));
          setOnboardingStep(0);
          setOnboardingCompleted(stored.onboardingCompleted ?? false);
          return;
        }
      } catch (error) {
        console.error('Failed to load inventory snapshot', error);
      }

      try {
        const data = loadInventoryData();
        if (!cancelled) {
          setInventoryState(createInventoryStateFromData(data, true));
          setAvailableIngredientIds(new Set());
          setShoppingIngredientIds(new Set());
          setCocktailRatings({});
          setIgnoreGarnish(true);
          setAllowAllSubstitutes(true);
          setUseImperialUnits(false);
          setKeepScreenAwake(true);
          setStartScreen(DEFAULT_START_SCREEN);
          setAppTheme(DEFAULT_APP_THEME);
          setCustomCocktailTags([]);
          setCustomIngredientTags([]);
          setOnboardingStep(1);
          setOnboardingCompleted(false);
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
  }, [inventoryState]);

  const memoizedDelta = useMemo(() => {
    if (!inventoryState) {
      return undefined;
    }
    return calculateInventoryDelta(inventoryState.cocktails, inventoryState.ingredients);
  }, [inventoryState]);

  useEffect(() => {
    if (!inventoryState || !memoizedDelta) {
      return;
    }

    setLoading(false);
    globalThis.__yourbarInventory = inventoryState;
    globalThis.__yourbarInventoryAvailableIngredientIds = availableIngredientIds;
    globalThis.__yourbarInventoryShoppingIngredientIds = shoppingIngredientIds;
    globalThis.__yourbarInventoryCocktailRatings = cocktailRatings;
    globalThis.__yourbarInventoryIgnoreGarnish = ignoreGarnish;
    globalThis.__yourbarInventoryAllowAllSubstitutes = allowAllSubstitutes;
    globalThis.__yourbarInventoryUseImperialUnits = useImperialUnits;
    globalThis.__yourbarInventoryKeepScreenAwake = keepScreenAwake;
    globalThis.__yourbarInventoryRatingFilterThreshold = ratingFilterThreshold;
    globalThis.__yourbarInventoryStartScreen = startScreen;
    globalThis.__yourbarInventoryAppTheme = appTheme;
    globalThis.__yourbarInventoryCustomCocktailTags = customCocktailTags;
    globalThis.__yourbarInventoryCustomIngredientTags = customIngredientTags;
    globalThis.__yourbarInventoryOnboardingStep = onboardingStep;
    globalThis.__yourbarInventoryOnboardingCompleted = onboardingCompleted;

    const snapshot = createDeltaSnapshotFromInventory(inventoryState, {
      availableIngredientIds,
      shoppingIngredientIds,
      cocktailRatings,
      ignoreGarnish,
      allowAllSubstitutes,
      useImperialUnits,
      keepScreenAwake,
      ratingFilterThreshold,
      startScreen,
      appTheme,
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
    memoizedDelta,
    availableIngredientIds,
    shoppingIngredientIds,
    cocktailRatings,
    ignoreGarnish,
    allowAllSubstitutes,
    useImperialUnits,
    keepScreenAwake,
    ratingFilterThreshold,
    startScreen,
    appTheme,
    customCocktailTags,
    customIngredientTags,
    onboardingStep,
    onboardingCompleted,
  ]);

  const resolveCocktailKey = useCallback((cocktail: Cocktail) => {
    return cocktail.id != null ? String(cocktail.id) : (cocktail.name ? normalizeSearchText(cocktail.name) : undefined);
  }, []);

  const setCocktailRating = useCallback((cocktail: Cocktail, rating: number) => {
    const key = resolveCocktailKey(cocktail);
    if (!key) return;
    setCocktailRatings((prev) => {
      const normalized = Math.max(0, Math.min(5, Math.round(rating)));
      if (normalized <= 0) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      if (prev[key] === normalized) return prev;
      return { ...prev, [key]: normalized };
    });
  }, [resolveCocktailKey]);

  const getCocktailRating = useCallback((cocktail: Cocktail) => {
    const key = resolveCocktailKey(cocktail);
    return key ? Math.max(0, Math.min(5, Number(cocktailRatings[key]) || 0)) : 0;
  }, [cocktailRatings, resolveCocktailKey]);

  const setIngredientAvailability = useCallback((id: number, available: boolean) => {
    setAvailableIngredientIds((prev) => {
      const next = new Set(prev);
      available ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  const createCocktail = useCallback((input: CreateCocktailInput) => {
    let created: Cocktail | undefined;
    setInventoryState((prev) => {
      if (!prev) return prev;
      const result = createCocktailAction(prev, input);
      if (!result) return prev;
      created = result.created;
      return result.nextState;
    });
    return created;
  }, []);

  const createIngredient = useCallback((input: CreateIngredientInput) => {
    let created: Ingredient | undefined;
    setInventoryState((prev) => {
      if (!prev) return prev;
      const result = createIngredientAction(prev, input);
      if (!result) return prev;
      created = result.created;
      return result.nextState;
    });
    if (created?.id != null) {
      const id = Number(created.id);
      setAvailableIngredientIds((p) => new Set(p).add(id));
      setShoppingIngredientIds((p) => {
        if (!p.has(id)) return p;
        const n = new Set(p); n.delete(id); return n;
      });
    }
    return created;
  }, []);

  const resetInventoryFromBundle = useCallback(async () => {
    try { await clearInventorySnapshot(); } catch (e) { console.warn(e); }
    const data = reloadInventoryData();
    refreshBaseCache();
    clearDeltaReferenceCache();
    setInventoryState((prev) => {
      const baseState = createInventoryStateFromData(data, prev?.imported ?? false);
      if (!prev) return baseState;
      const userCocktails = prev.cocktails.filter((c) => Number(c.id ?? -1) >= USER_CREATED_ID_START);
      const userIngredients = prev.ingredients.filter((i) => Number(i.id ?? -1) >= USER_CREATED_ID_START);
      return {
        ...baseState,
        cocktails: [...baseState.cocktails, ...userCocktails].sort((a, b) => a.searchNameNormalized.localeCompare(b.searchNameNormalized)),
        ingredients: [...baseState.ingredients, ...userIngredients].sort((a, b) => a.searchNameNormalized.localeCompare(b.searchNameNormalized)),
      };
    });
  }, []);

  const exportInventoryData = useCallback(() => inventoryState ? getExportInventoryData(inventoryState) : null, [inventoryState]);
  const exportInventoryPhotoEntries = useCallback(() => inventoryState ? getExportInventoryPhotoEntries(inventoryState) : null, [inventoryState]);

  const importInventoryData = useCallback((data: InventoryExportData) => {
    const incomingState = createInventoryStateFromData(hydrateInventoryTagsFromCode(data), true);
    setInventoryState((prev) => {
      if (!prev) return incomingState;
      const merge = <T extends { id?: number | null; searchNameNormalized: string }>(curr: readonly T[], inc: readonly T[]) => {
        const incMap = new Map(inc.map(i => [Math.trunc(Number(i.id ?? -1)), i]));
        const merged = curr.map(i => incMap.get(Math.trunc(Number(i.id ?? -1))) ?? i);
        const seen = new Set(curr.map(i => Math.trunc(Number(i.id ?? -1))));
        inc.forEach(i => { if (!seen.has(Math.trunc(Number(i.id ?? -1)))) merged.push(i); });
        return merged.sort((a, b) => a.searchNameNormalized.localeCompare(b.searchNameNormalized));
      };
      return { ...prev, imported: true, cocktails: merge(prev.cocktails, incomingState.cocktails), ingredients: merge(prev.ingredients, incomingState.ingredients) };
    });
  }, []);

  const updateIngredient = useCallback((id: number, input: CreateIngredientInput) => {
    let updated: Ingredient | undefined;
    setInventoryState((prev) => {
      if (!prev) return prev;
      const result = updateIngredientAction(prev, id, input);
      if (!result) return prev;
      updated = result.updated;
      return result.nextState;
    });
    return updated;
  }, []);

  const updateCocktail = useCallback((id: number, input: CreateCocktailInput) => {
    let updated: Cocktail | undefined;
    setInventoryState((prev) => {
      if (!prev) return prev;
      const result = updateCocktailAction(prev, id, input);
      if (!result) return prev;
      updated = result.updated;
      return result.nextState;
    });
    return updated;
  }, []);

  const deleteIngredient = useCallback((id: number) => {
    const normalizedId = Number(id);
    let wasRemoved = false;
    setInventoryState((prev) => {
      if (!prev) return prev;
      const result = deleteIngredientAction(prev, id);
      wasRemoved = result.wasRemoved;
      return result.nextState;
    });
    if (wasRemoved) {
      setAvailableIngredientIds((p) => { if (!p.has(normalizedId)) return p; const n = new Set(p); n.delete(normalizedId); return n; });
      setShoppingIngredientIds((p) => { if (!p.has(normalizedId)) return p; const n = new Set(p); n.delete(normalizedId); return n; });
    }
    return wasRemoved;
  }, []);

  const deleteCocktail = useCallback((id: number) => {
    let deleted: Cocktail | undefined;
    setInventoryState((prev) => {
      if (!prev) return prev;
      const result = deleteCocktailAction(prev, id);
      if (!result) return prev;
      deleted = result.deleted;
      return result.nextState;
    });
    if (deleted) {
      setCocktailRatings((prev) => {
        const key = resolveCocktailKey(deleted!);
        if (key && key in prev) { const n = { ...prev }; delete n[key]; return n; }
        return prev;
      });
      return true;
    }
    return false;
  }, [resolveCocktailKey]);

  const toggleIngredientAvailability = useCallback((id: number) => setAvailableIngredientIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }), []);
  const toggleIngredientShopping = useCallback((id: number) => setShoppingIngredientIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }), []);
  const handleSetIgnoreGarnish = useCallback((v: boolean) => setIgnoreGarnish(v), []);
  const handleSetAllowAllSubstitutes = useCallback((v: boolean) => setAllowAllSubstitutes(v), []);
  const handleSetUseImperialUnits = useCallback((v: boolean) => setUseImperialUnits(v), []);
  const handleSetKeepScreenAwake = useCallback((v: boolean) => setKeepScreenAwake(v), []);
  const handleSetRatingFilterThreshold = useCallback((v: number) => setRatingFilterThreshold(Math.min(5, Math.max(1, Math.round(v)))), []);
  const handleSetStartScreen = useCallback((v: StartScreen) => setStartScreen(sanitizeStartScreen(v)), []);
  const handleSetAppTheme = useCallback((v: AppTheme) => setAppTheme(sanitizeAppTheme(v)), []);
  const completeOnboarding = useCallback(() => { setOnboardingCompleted(true); setOnboardingStep(0); }, []);
  const restartOnboarding = useCallback(() => { setOnboardingCompleted(false); setOnboardingStep(1); setStartScreen('ingredients_all'); }, []);

  const createCustomCocktailTag = useCallback((input: { name: string; color?: string | null }) => {
    let created: CocktailTag | undefined;
    setCustomCocktailTags((prev) => {
      const tag = { id: getNextCustomTagId(prev, BUILTIN_COCKTAIL_TAG_MAX), name: input.name.trim(), color: input.color?.trim() || DEFAULT_TAG_COLOR };
      created = tag;
      return [...prev, tag].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    });
    return created;
  }, []);

  const updateCustomCocktailTag = useCallback((id: number, input: { name: string; color?: string | null }) => {
    let updated: CocktailTag | undefined;
    setCustomCocktailTags((prev) => {
      const idx = prev.findIndex((tag) => Number(tag.id ?? -1) === Math.trunc(id));
      if (idx < 0) return prev;
      updated = { id: prev[idx].id, name: input.name.trim(), color: input.color?.trim() || DEFAULT_TAG_COLOR };
      const next = [...prev]; next[idx] = updated; return next.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    });
    if (updated) setInventoryState((prev) => prev ? updateCocktailTagInState(prev, updated!) : prev);
    return updated;
  }, []);

  const deleteCustomCocktailTag = useCallback((id: number) => {
    let didRemove = false;
    setCustomCocktailTags((prev) => {
      const next = prev.filter((tag) => Number(tag.id ?? -1) !== Math.trunc(id));
      didRemove = next.length !== prev.length;
      return next;
    });
    if (didRemove) setInventoryState((prev) => prev ? deleteCocktailTagFromState(prev, id) : prev);
    return didRemove;
  }, []);

  const createCustomIngredientTag = useCallback((input: { name: string; color?: string | null }) => {
    let created: IngredientTag | undefined;
    setCustomIngredientTags((prev) => {
      const tag = { id: getNextCustomTagId(prev, BUILTIN_INGREDIENT_TAG_MAX), name: input.name.trim(), color: input.color?.trim() || DEFAULT_TAG_COLOR };
      created = tag;
      return [...prev, tag].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    });
    return created;
  }, []);

  const updateCustomIngredientTag = useCallback((id: number, input: { name: string; color?: string | null }) => {
    let updated: IngredientTag | undefined;
    setCustomIngredientTags((prev) => {
      const idx = prev.findIndex((tag) => Number(tag.id ?? -1) === Math.trunc(id));
      if (idx < 0) return prev;
      updated = { id: prev[idx].id, name: input.name.trim(), color: input.color?.trim() || DEFAULT_TAG_COLOR };
      const next = [...prev]; next[idx] = updated; return next.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    });
    if (updated) setInventoryState((prev) => prev ? updateIngredientTagInState(prev, updated!) : prev);
    return updated;
  }, []);

  const deleteCustomIngredientTag = useCallback((id: number) => {
    let didRemove = false;
    setCustomIngredientTags((prev) => {
      const next = prev.filter((tag) => Number(tag.id ?? -1) !== Math.trunc(id));
      didRemove = next.length !== prev.length;
      return next;
    });
    if (didRemove) setInventoryState((prev) => prev ? deleteIngredientTagFromState(prev, id) : prev);
    return didRemove;
  }, []);

  const clearBaseIngredient = useCallback((id: number) => setInventoryState((prev) => prev ? clearBaseIngredientAction(prev, id) : prev), []);

  const dataValue = useMemo<InventoryDataContextValue>(() => ({
    cocktails: inventoryState?.cocktails ?? [],
    ingredients: inventoryState?.ingredients ?? [],
    customCocktailTags,
    customIngredientTags,
    availableIngredientIds,
    shoppingIngredientIds,
    cocktailRatings,
    ignoreGarnish,
    allowAllSubstitutes,
    useImperialUnits,
    ratingFilterThreshold,
    getCocktailRating,
    loading,
  }), [inventoryState, customCocktailTags, customIngredientTags, availableIngredientIds, shoppingIngredientIds, cocktailRatings, ignoreGarnish, allowAllSubstitutes, useImperialUnits, ratingFilterThreshold, getCocktailRating, loading]);

  const settingsValue = useMemo<InventorySettingsContextValue>(() => ({
    keepScreenAwake,
    startScreen,
    appTheme,
    onboardingStep,
    onboardingCompleted,
  }), [keepScreenAwake, startScreen, appTheme, onboardingStep, onboardingCompleted]);

  const actionsValue = useMemo<InventoryActionsContextValue>(() => ({
    setIngredientAvailability, toggleIngredientAvailability, toggleIngredientShopping, clearBaseIngredient,
    createCocktail, createIngredient, resetInventoryFromBundle, exportInventoryData, exportInventoryPhotoEntries,
    importInventoryData, updateCocktail, updateIngredient, deleteCocktail, deleteIngredient,
    createCustomCocktailTag, updateCustomCocktailTag, deleteCustomCocktailTag,
    createCustomIngredientTag, updateCustomIngredientTag, deleteCustomIngredientTag,
    setCocktailRating, setIgnoreGarnish: handleSetIgnoreGarnish, setAllowAllSubstitutes: handleSetAllowAllSubstitutes,
    setUseImperialUnits: handleSetUseImperialUnits, setKeepScreenAwake: handleSetKeepScreenAwake,
    setRatingFilterThreshold: handleSetRatingFilterThreshold, setStartScreen: handleSetStartScreen,
    setAppTheme: handleSetAppTheme, setOnboardingStep, completeOnboarding, restartOnboarding,
  }), [setIngredientAvailability, toggleIngredientAvailability, toggleIngredientShopping, clearBaseIngredient, createCocktail, createIngredient, resetInventoryFromBundle, exportInventoryData, exportInventoryPhotoEntries, importInventoryData, updateCocktail, updateIngredient, deleteCocktail, deleteIngredient, createCustomCocktailTag, updateCustomCocktailTag, deleteCustomCocktailTag, createCustomIngredientTag, updateCustomIngredientTag, deleteCustomIngredientTag, setCocktailRating, handleSetIgnoreGarnish, handleSetAllowAllSubstitutes, handleSetUseImperialUnits, handleSetKeepScreenAwake, handleSetRatingFilterThreshold, handleSetStartScreen, handleSetAppTheme, setOnboardingStep, completeOnboarding, restartOnboarding]);

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

export { useInventoryActions, useInventoryData, useInventorySettings };

export function useInventory() {
  const data = useInventoryData();
  const settings = useInventorySettings();
  const actions = useInventoryActions();
  return useMemo(() => ({ ...data, ...settings, ...actions }), [data, settings, actions]);
}

export type { AppTheme, Cocktail, CreateCocktailInput, CreateIngredientInput, Ingredient, StartScreen };
