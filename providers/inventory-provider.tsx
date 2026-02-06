import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
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
import { inventoryReducer, type FullInventoryState } from './inventory/model/inventory-reducer';

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
  const initialState: FullInventoryState = {
    inventoryState: globalThis.__yourbarInventory,
    loading: !globalThis.__yourbarInventory,
    availableIngredientIds: globalThis.__yourbarInventoryAvailableIngredientIds
      ? new Set(globalThis.__yourbarInventoryAvailableIngredientIds)
      : new Set(),
    shoppingIngredientIds: globalThis.__yourbarInventoryShoppingIngredientIds
      ? new Set(globalThis.__yourbarInventoryShoppingIngredientIds)
      : new Set(),
    cocktailRatings: sanitizeCocktailRatings(globalThis.__yourbarInventoryCocktailRatings),
    ignoreGarnish: globalThis.__yourbarInventoryIgnoreGarnish ?? true,
    allowAllSubstitutes: globalThis.__yourbarInventoryAllowAllSubstitutes ?? true,
    useImperialUnits: globalThis.__yourbarInventoryUseImperialUnits ?? false,
    keepScreenAwake: globalThis.__yourbarInventoryKeepScreenAwake ?? true,
    ratingFilterThreshold: typeof globalThis.__yourbarInventoryRatingFilterThreshold === 'number'
      ? Math.min(5, Math.max(1, Math.round(globalThis.__yourbarInventoryRatingFilterThreshold)))
      : 1,
    startScreen: globalThis.__yourbarInventoryStartScreen ?? DEFAULT_START_SCREEN,
    appTheme: globalThis.__yourbarInventoryAppTheme ?? DEFAULT_APP_THEME,
    customCocktailTags: sanitizeCustomTags(globalThis.__yourbarInventoryCustomCocktailTags, DEFAULT_TAG_COLOR),
    customIngredientTags: sanitizeCustomTags(globalThis.__yourbarInventoryCustomIngredientTags, DEFAULT_TAG_COLOR),
    onboardingStep: globalThis.__yourbarInventoryOnboardingStep ?? 0,
    onboardingCompleted: globalThis.__yourbarInventoryOnboardingCompleted ?? false,
  };

  const [state, dispatch] = useReducer(inventoryReducer, initialState);
  const lastPersistedSnapshot = useRef<string | undefined>(undefined);

  // Structural optimization: Track precisely which IDs were changed to avoid O(N) delta recalculation
  const dirtyCocktailIds = useRef<Set<number>>(new Set());
  const dirtyIngredientIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (state.inventoryState) {
      return;
    }

    let cancelled = false;
    dispatch({ type: 'SET_LOADING', payload: true });

    void (async () => {
      try {
        const stored = await loadInventorySnapshot<CocktailStorageRecord, IngredientStorageRecord>();
        if (stored && (stored.version === INVENTORY_SNAPSHOT_VERSION || stored.version === 1) && !cancelled) {
          const baseData = loadInventoryData();

          dispatch({
            type: 'INIT',
            payload: {
              inventoryState: createInventoryStateFromSnapshot(stored, baseData),
              loading: false,
              availableIngredientIds: createIngredientIdSet(stored.availableIngredientIds),
              shoppingIngredientIds: createIngredientIdSet(stored.shoppingIngredientIds),
              cocktailRatings: sanitizeCocktailRatings(stored.cocktailRatings),
              ignoreGarnish: stored.ignoreGarnish ?? true,
              allowAllSubstitutes: stored.allowAllSubstitutes ?? true,
              useImperialUnits: stored.useImperialUnits ?? false,
              keepScreenAwake: stored.keepScreenAwake ?? true,
              ratingFilterThreshold: Math.min(5, Math.max(1, Math.round(stored.ratingFilterThreshold ?? 1))),
              startScreen: sanitizeStartScreen(stored.startScreen),
              appTheme: sanitizeAppTheme(stored.appTheme),
              customCocktailTags: sanitizeCustomTags(stored.customCocktailTags, DEFAULT_TAG_COLOR),
              customIngredientTags: sanitizeCustomTags(stored.customIngredientTags, DEFAULT_TAG_COLOR),
              onboardingStep: 0,
              onboardingCompleted: stored.onboardingCompleted ?? false,
            }
          });
          return;
        }
      } catch (error) {
        console.error('Failed to load inventory snapshot', error);
      }

      try {
        const data = loadInventoryData();
        if (!cancelled) {
          dispatch({
            type: 'INIT',
            payload: {
              inventoryState: createInventoryStateFromData(data, true),
              loading: false,
              availableIngredientIds: new Set(),
              shoppingIngredientIds: new Set(),
              cocktailRatings: {},
              ignoreGarnish: true,
              allowAllSubstitutes: true,
              useImperialUnits: false,
              keepScreenAwake: true,
              ratingFilterThreshold: 1,
              startScreen: DEFAULT_START_SCREEN,
              appTheme: DEFAULT_APP_THEME,
              customCocktailTags: [],
              customIngredientTags: [],
              onboardingStep: 1,
              onboardingCompleted: false,
            }
          });
        }
      } catch (error) {
        console.error('Failed to import bundled inventory', error);
        if (!cancelled) {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.inventoryState]);

  const memoizedDelta = useMemo(() => {
    if (!state.inventoryState) {
      return undefined;
    }
    const delta = calculateInventoryDelta(
      state.inventoryState.cocktails,
      state.inventoryState.ingredients,
      dirtyCocktailIds.current,
      dirtyIngredientIds.current
    );
    // Clear dirty sets after they've been processed into the delta
    dirtyCocktailIds.current.clear();
    dirtyIngredientIds.current.clear();
    return delta;
  }, [state.inventoryState]);

  useEffect(() => {
    if (!state.inventoryState || !memoizedDelta) {
      return;
    }

    if (state.loading) {
      dispatch({ type: 'SET_LOADING', payload: false });
    }

    globalThis.__yourbarInventory = state.inventoryState;
    globalThis.__yourbarInventoryAvailableIngredientIds = state.availableIngredientIds;
    globalThis.__yourbarInventoryShoppingIngredientIds = state.shoppingIngredientIds;
    globalThis.__yourbarInventoryCocktailRatings = state.cocktailRatings;
    globalThis.__yourbarInventoryIgnoreGarnish = state.ignoreGarnish;
    globalThis.__yourbarInventoryAllowAllSubstitutes = state.allowAllSubstitutes;
    globalThis.__yourbarInventoryUseImperialUnits = state.useImperialUnits;
    globalThis.__yourbarInventoryKeepScreenAwake = state.keepScreenAwake;
    globalThis.__yourbarInventoryRatingFilterThreshold = state.ratingFilterThreshold;
    globalThis.__yourbarInventoryStartScreen = state.startScreen;
    globalThis.__yourbarInventoryAppTheme = state.appTheme;
    globalThis.__yourbarInventoryCustomCocktailTags = state.customCocktailTags;
    globalThis.__yourbarInventoryCustomIngredientTags = state.customIngredientTags;
    globalThis.__yourbarInventoryOnboardingStep = state.onboardingStep;
    globalThis.__yourbarInventoryOnboardingCompleted = state.onboardingCompleted;

    const snapshot = createDeltaSnapshotFromInventory(state.inventoryState, memoizedDelta, {
      availableIngredientIds: state.availableIngredientIds,
      shoppingIngredientIds: state.shoppingIngredientIds,
      cocktailRatings: state.cocktailRatings,
      ignoreGarnish: state.ignoreGarnish,
      allowAllSubstitutes: state.allowAllSubstitutes,
      useImperialUnits: state.useImperialUnits,
      keepScreenAwake: state.keepScreenAwake,
      ratingFilterThreshold: state.ratingFilterThreshold,
      startScreen: state.startScreen,
      appTheme: state.appTheme,
      customCocktailTags: state.customCocktailTags,
      customIngredientTags: state.customIngredientTags,
      onboardingStep: state.onboardingStep,
      onboardingCompleted: state.onboardingCompleted,
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
    state.inventoryState,
    memoizedDelta,
    state.availableIngredientIds,
    state.shoppingIngredientIds,
    state.cocktailRatings,
    state.ignoreGarnish,
    state.allowAllSubstitutes,
    state.useImperialUnits,
    state.keepScreenAwake,
    state.ratingFilterThreshold,
    state.startScreen,
    state.appTheme,
    state.customCocktailTags,
    state.customIngredientTags,
    state.onboardingStep,
    state.onboardingCompleted,
    state.loading,
  ]);

  const resolveCocktailKey = useCallback((cocktail: Cocktail) => {
    return cocktail.id != null ? String(cocktail.id) : (cocktail.name ? normalizeSearchText(cocktail.name) : undefined);
  }, []);

  const setCocktailRating = useCallback((cocktail: Cocktail, rating: number) => {
    const key = resolveCocktailKey(cocktail);
    if (!key) return;

    const normalized = Math.max(0, Math.min(5, Math.round(rating)));
    const prev = state.cocktailRatings;

    if (normalized <= 0) {
      if (!(key in prev)) return;
      const next = { ...prev };
      delete next[key];
      dispatch({ type: 'SET_COCKTAIL_RATINGS', payload: next });
      return;
    }
    if (prev[key] === normalized) return;
    dispatch({ type: 'SET_COCKTAIL_RATINGS', payload: { ...prev, [key]: normalized } });
  }, [resolveCocktailKey, state.cocktailRatings]);

  const getCocktailRating = useCallback((cocktail: Cocktail) => {
    const key = resolveCocktailKey(cocktail);
    return key ? Math.max(0, Math.min(5, Number(state.cocktailRatings[key]) || 0)) : 0;
  }, [state.cocktailRatings, resolveCocktailKey]);

  const setIngredientAvailability = useCallback((id: number, available: boolean) => {
    const next = new Set(state.availableIngredientIds);
    available ? next.add(id) : next.delete(id);
    dispatch({ type: 'SET_AVAILABLE_INGREDIENTS', payload: next });
  }, [state.availableIngredientIds]);

  const createCocktail = useCallback((input: CreateCocktailInput) => {
    if (!state.inventoryState) return undefined;
    const result = createCocktailAction(state.inventoryState, input);
    if (!result) return undefined;

    if (result.created.id != null) {
      dirtyCocktailIds.current.add(Number(result.created.id));
    }
    dispatch({ type: 'SET_INVENTORY_STATE', payload: result.nextState });
    return result.created;
  }, [state.inventoryState]);

  const createIngredient = useCallback((input: CreateIngredientInput) => {
    if (!state.inventoryState) return undefined;
    const result = createIngredientAction(state.inventoryState, input);
    if (!result) return undefined;

    const created = result.created;
    if (created.id != null) {
      const id = Number(created.id);
      dirtyIngredientIds.current.add(id);

      const nextAvailable = new Set(state.availableIngredientIds).add(id);
      dispatch({ type: 'SET_AVAILABLE_INGREDIENTS', payload: nextAvailable });

      if (state.shoppingIngredientIds.has(id)) {
        const nextShopping = new Set(state.shoppingIngredientIds);
        nextShopping.delete(id);
        dispatch({ type: 'SET_SHOPPING_INGREDIENTS', payload: nextShopping });
      }
    }

    dispatch({ type: 'SET_INVENTORY_STATE', payload: result.nextState });
    return created;
  }, [state.inventoryState, state.availableIngredientIds, state.shoppingIngredientIds]);

  const resetInventoryFromBundle = useCallback(async () => {
    try { await clearInventorySnapshot(); } catch (e) { console.warn(e); }
    const data = reloadInventoryData();
    refreshBaseCache();
    clearDeltaReferenceCache();

    const baseState = createInventoryStateFromData(data, state.inventoryState?.imported ?? false);
    const userCocktails = state.inventoryState?.cocktails.filter((c) => Number(c.id ?? -1) >= USER_CREATED_ID_START) ?? [];
    const userIngredients = state.inventoryState?.ingredients.filter((i) => Number(i.id ?? -1) >= USER_CREATED_ID_START) ?? [];

    const nextInventoryState = {
      ...baseState,
      cocktails: [...baseState.cocktails, ...userCocktails].sort((a, b) => a.searchNameNormalized.localeCompare(b.searchNameNormalized)),
      ingredients: [...baseState.ingredients, ...userIngredients].sort((a, b) => a.searchNameNormalized.localeCompare(b.searchNameNormalized)),
    };

    dispatch({ type: 'SET_INVENTORY_STATE', payload: nextInventoryState });
  }, [state.inventoryState]);

  const exportInventoryData = useCallback(() => state.inventoryState ? getExportInventoryData(state.inventoryState) : null, [state.inventoryState]);
  const exportInventoryPhotoEntries = useCallback(() => state.inventoryState ? getExportInventoryPhotoEntries(state.inventoryState) : null, [state.inventoryState]);

  const importInventoryData = useCallback((data: InventoryExportData) => {
    const hydrated = hydrateInventoryTagsFromCode(data);
    const incomingState = createInventoryStateFromData(hydrated, true);

    incomingState.cocktails.forEach(c => { if (c.id != null) dirtyCocktailIds.current.add(Number(c.id)); });
    incomingState.ingredients.forEach(i => { if (i.id != null) dirtyIngredientIds.current.add(Number(i.id)); });

    if (!state.inventoryState) {
      dispatch({ type: 'SET_INVENTORY_STATE', payload: { ...incomingState, imported: true } });
      return;
    }

    const merge = <T extends { id?: number | null; searchNameNormalized: string }>(curr: readonly T[], inc: readonly T[]) => {
      const incMap = new Map(inc.map(i => [Math.trunc(Number(i.id ?? -1)), i]));
      const merged = curr.map(i => {
        const id = Math.trunc(Number(i.id ?? -1));
        return incMap.get(id) ?? i;
      });
      const seen = new Set(curr.map(i => Math.trunc(Number(i.id ?? -1))));
      inc.forEach(i => { if (!seen.has(Math.trunc(Number(i.id ?? -1)))) merged.push(i); });
      return merged.sort((a, b) => a.searchNameNormalized.localeCompare(b.searchNameNormalized));
    };

    dispatch({
      type: 'SET_INVENTORY_STATE',
      payload: {
        ...state.inventoryState,
        imported: true,
        cocktails: merge(state.inventoryState.cocktails, incomingState.cocktails),
        ingredients: merge(state.inventoryState.ingredients, incomingState.ingredients)
      }
    });
  }, [state.inventoryState]);

  const updateIngredient = useCallback((id: number, input: CreateIngredientInput) => {
    if (!state.inventoryState) return undefined;
    const result = updateIngredientAction(state.inventoryState, id, input);
    if (!result) return undefined;

    dirtyIngredientIds.current.add(Number(id));
    dispatch({ type: 'SET_INVENTORY_STATE', payload: result.nextState });
    return result.updated;
  }, [state.inventoryState]);

  const updateCocktail = useCallback((id: number, input: CreateCocktailInput) => {
    if (!state.inventoryState) return undefined;
    const result = updateCocktailAction(state.inventoryState, id, input);
    if (!result) return undefined;

    dirtyCocktailIds.current.add(Number(id));
    dispatch({ type: 'SET_INVENTORY_STATE', payload: result.nextState });
    return result.updated;
  }, [state.inventoryState]);

  const deleteIngredient = useCallback((id: number) => {
    if (!state.inventoryState) return false;
    const result = deleteIngredientAction(state.inventoryState, id);
    if (result.wasRemoved) {
      dirtyIngredientIds.current.add(Number(id));
      dispatch({ type: 'SET_INVENTORY_STATE', payload: result.nextState });

      const normalizedId = Number(id);
      if (state.availableIngredientIds.has(normalizedId)) {
        const next = new Set(state.availableIngredientIds);
        next.delete(normalizedId);
        dispatch({ type: 'SET_AVAILABLE_INGREDIENTS', payload: next });
      }
      if (state.shoppingIngredientIds.has(normalizedId)) {
        const next = new Set(state.shoppingIngredientIds);
        next.delete(normalizedId);
        dispatch({ type: 'SET_SHOPPING_INGREDIENTS', payload: next });
      }
      return true;
    }
    return false;
  }, [state.inventoryState, state.availableIngredientIds, state.shoppingIngredientIds]);

  const deleteCocktail = useCallback((id: number) => {
    if (!state.inventoryState) return false;
    const result = deleteCocktailAction(state.inventoryState, id);
    if (result) {
      dirtyCocktailIds.current.add(Number(id));
      dispatch({ type: 'SET_INVENTORY_STATE', payload: result.nextState });

      const key = resolveCocktailKey(result.deleted);
      if (key && key in state.cocktailRatings) {
        const n = { ...state.cocktailRatings };
        delete n[key];
        dispatch({ type: 'SET_COCKTAIL_RATINGS', payload: n });
      }
      return true;
    }
    return false;
  }, [state.inventoryState, state.cocktailRatings, resolveCocktailKey]);

  const toggleIngredientAvailability = useCallback((id: number) => {
    const next = new Set(state.availableIngredientIds);
    next.has(id) ? next.delete(id) : next.add(id);
    dispatch({ type: 'SET_AVAILABLE_INGREDIENTS', payload: next });
  }, [state.availableIngredientIds]);

  const toggleIngredientShopping = useCallback((id: number) => {
    const next = new Set(state.shoppingIngredientIds);
    next.has(id) ? next.delete(id) : next.add(id);
    dispatch({ type: 'SET_SHOPPING_INGREDIENTS', payload: next });
  }, [state.shoppingIngredientIds]);

  const handleSetIgnoreGarnish = useCallback((v: boolean) => dispatch({ type: 'SET_IGNORE_GARNISH', payload: v }), []);
  const handleSetAllowAllSubstitutes = useCallback((v: boolean) => dispatch({ type: 'SET_ALLOW_ALL_SUBSTITUTES', payload: v }), []);
  const handleSetUseImperialUnits = useCallback((v: boolean) => dispatch({ type: 'SET_USE_IMPERIAL_UNITS', payload: v }), []);
  const handleSetKeepScreenAwake = useCallback((v: boolean) => dispatch({ type: 'SET_KEEP_SCREEN_AWAKE', payload: v }), []);
  const handleSetRatingFilterThreshold = useCallback((v: number) => dispatch({ type: 'SET_RATING_FILTER_THRESHOLD', payload: Math.min(5, Math.max(1, Math.round(v))) }), []);
  const handleSetStartScreen = useCallback((v: StartScreen) => dispatch({ type: 'SET_START_SCREEN', payload: sanitizeStartScreen(v) }), []);
  const handleSetAppTheme = useCallback((v: AppTheme) => dispatch({ type: 'SET_APP_THEME', payload: sanitizeAppTheme(v) }), []);

  const completeOnboarding = useCallback(() => {
    dispatch({ type: 'SET_ONBOARDING_COMPLETED', payload: true });
    dispatch({ type: 'SET_ONBOARDING_STEP', payload: 0 });
  }, []);

  const restartOnboarding = useCallback(() => {
    dispatch({ type: 'SET_ONBOARDING_COMPLETED', payload: false });
    dispatch({ type: 'SET_ONBOARDING_STEP', payload: 1 });
    dispatch({ type: 'SET_START_SCREEN', payload: 'ingredients_all' });
  }, []);

  const createCustomCocktailTag = useCallback((input: { name: string; color?: string | null }) => {
    const tag = { id: getNextCustomTagId(state.customCocktailTags, BUILTIN_COCKTAIL_TAG_MAX), name: input.name.trim(), color: input.color?.trim() || DEFAULT_TAG_COLOR };
    const next = [...state.customCocktailTags, tag].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    dispatch({ type: 'SET_CUSTOM_COCKTAIL_TAGS', payload: next });
    return tag;
  }, [state.customCocktailTags]);

  const updateCustomCocktailTag = useCallback((id: number, input: { name: string; color?: string | null }) => {
    const idx = state.customCocktailTags.findIndex((tag) => Number(tag.id ?? -1) === Math.trunc(id));
    if (idx < 0) return undefined;
    const updated = { id: state.customCocktailTags[idx].id, name: input.name.trim(), color: input.color?.trim() || DEFAULT_TAG_COLOR };
    const nextTags = [...state.customCocktailTags];
    nextTags[idx] = updated;
    dispatch({ type: 'SET_CUSTOM_COCKTAIL_TAGS', payload: nextTags.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')) });

    if (state.inventoryState) {
      const result = updateCocktailTagInState(state.inventoryState, updated);
      result.affectedIds.forEach(cid => dirtyCocktailIds.current.add(cid));
      dispatch({ type: 'SET_INVENTORY_STATE', payload: result.nextState });
    }
    return updated;
  }, [state.customCocktailTags, state.inventoryState]);

  const deleteCustomCocktailTag = useCallback((id: number) => {
    const nextTags = state.customCocktailTags.filter((tag) => Number(tag.id ?? -1) !== Math.trunc(id));
    if (nextTags.length === state.customCocktailTags.length) return false;

    dispatch({ type: 'SET_CUSTOM_COCKTAIL_TAGS', payload: nextTags });
    if (state.inventoryState) {
      const result = deleteCocktailTagFromState(state.inventoryState, id);
      result.affectedIds.forEach(cid => dirtyCocktailIds.current.add(cid));
      dispatch({ type: 'SET_INVENTORY_STATE', payload: result.nextState });
    }
    return true;
  }, [state.customCocktailTags, state.inventoryState]);

  const createCustomIngredientTag = useCallback((input: { name: string; color?: string | null }) => {
    const tag = { id: getNextCustomTagId(state.customIngredientTags, BUILTIN_INGREDIENT_TAG_MAX), name: input.name.trim(), color: input.color?.trim() || DEFAULT_TAG_COLOR };
    const next = [...state.customIngredientTags, tag].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    dispatch({ type: 'SET_CUSTOM_INGREDIENT_TAGS', payload: next });
    return tag;
  }, [state.customIngredientTags]);

  const updateCustomIngredientTag = useCallback((id: number, input: { name: string; color?: string | null }) => {
    const idx = state.customIngredientTags.findIndex((tag) => Number(tag.id ?? -1) === Math.trunc(id));
    if (idx < 0) return undefined;
    const updated = { id: state.customIngredientTags[idx].id, name: input.name.trim(), color: input.color?.trim() || DEFAULT_TAG_COLOR };
    const nextTags = [...state.customIngredientTags];
    nextTags[idx] = updated;
    dispatch({ type: 'SET_CUSTOM_INGREDIENT_TAGS', payload: nextTags.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')) });

    if (state.inventoryState) {
      const result = updateIngredientTagInState(state.inventoryState, updated);
      result.affectedIds.forEach(iid => dirtyIngredientIds.current.add(iid));
      dispatch({ type: 'SET_INVENTORY_STATE', payload: result.nextState });
    }
    return updated;
  }, [state.customIngredientTags, state.inventoryState]);

  const deleteCustomIngredientTag = useCallback((id: number) => {
    const nextTags = state.customIngredientTags.filter((tag) => Number(tag.id ?? -1) !== Math.trunc(id));
    if (nextTags.length === state.customIngredientTags.length) return false;

    dispatch({ type: 'SET_CUSTOM_INGREDIENT_TAGS', payload: nextTags });
    if (state.inventoryState) {
      const result = deleteIngredientTagFromState(state.inventoryState, id);
      result.affectedIds.forEach(iid => dirtyIngredientIds.current.add(iid));
      dispatch({ type: 'SET_INVENTORY_STATE', payload: result.nextState });
    }
    return true;
  }, [state.customIngredientTags, state.inventoryState]);

  const clearBaseIngredient = useCallback((id: number) => {
    if (!state.inventoryState) return;
    const nextState = clearBaseIngredientAction(state.inventoryState, id);
    if (nextState !== state.inventoryState) {
      dirtyIngredientIds.current.add(id);
      dispatch({ type: 'SET_INVENTORY_STATE', payload: nextState });
    }
  }, [state.inventoryState]);

  const dataValue = useMemo<InventoryDataContextValue>(() => ({
    cocktails: state.inventoryState?.cocktails ?? [],
    ingredients: state.inventoryState?.ingredients ?? [],
    customCocktailTags: state.customCocktailTags,
    customIngredientTags: state.customIngredientTags,
    availableIngredientIds: state.availableIngredientIds,
    shoppingIngredientIds: state.shoppingIngredientIds,
    cocktailRatings: state.cocktailRatings,
    ignoreGarnish: state.ignoreGarnish,
    allowAllSubstitutes: state.allowAllSubstitutes,
    useImperialUnits: state.useImperialUnits,
    ratingFilterThreshold: state.ratingFilterThreshold,
    getCocktailRating,
    loading: state.loading,
  }), [
    state.inventoryState,
    state.customCocktailTags,
    state.customIngredientTags,
    state.availableIngredientIds,
    state.shoppingIngredientIds,
    state.cocktailRatings,
    state.ignoreGarnish,
    state.allowAllSubstitutes,
    state.useImperialUnits,
    state.ratingFilterThreshold,
    getCocktailRating,
    state.loading
  ]);

  const settingsValue = useMemo<InventorySettingsContextValue>(() => ({
    keepScreenAwake: state.keepScreenAwake,
    startScreen: state.startScreen,
    appTheme: state.appTheme,
    onboardingStep: state.onboardingStep,
    onboardingCompleted: state.onboardingCompleted,
  }), [
    state.keepScreenAwake,
    state.startScreen,
    state.appTheme,
    state.onboardingStep,
    state.onboardingCompleted
  ]);

  const actionsValue = useMemo<InventoryActionsContextValue>(() => ({
    setIngredientAvailability, toggleIngredientAvailability, toggleIngredientShopping, clearBaseIngredient,
    createCocktail, createIngredient, resetInventoryFromBundle, exportInventoryData, exportInventoryPhotoEntries,
    importInventoryData, updateCocktail, updateIngredient, deleteCocktail, deleteIngredient,
    createCustomCocktailTag, updateCustomCocktailTag, deleteCustomCocktailTag,
    createCustomIngredientTag, updateCustomIngredientTag, deleteCustomIngredientTag,
    setCocktailRating, setIgnoreGarnish: handleSetIgnoreGarnish, setAllowAllSubstitutes: handleSetAllowAllSubstitutes,
    setUseImperialUnits: handleSetUseImperialUnits, setKeepScreenAwake: handleSetKeepScreenAwake,
    setRatingFilterThreshold: handleSetRatingFilterThreshold, setStartScreen: handleSetStartScreen,
    setAppTheme: handleSetAppTheme,
    setOnboardingStep: (step: number) => dispatch({ type: 'SET_ONBOARDING_STEP', payload: step }),
    completeOnboarding, restartOnboarding,
  }), [
    setIngredientAvailability, toggleIngredientAvailability, toggleIngredientShopping, clearBaseIngredient, createCocktail, createIngredient, resetInventoryFromBundle, exportInventoryData, exportInventoryPhotoEntries, importInventoryData, updateCocktail, updateIngredient, deleteCocktail, deleteIngredient, createCustomCocktailTag, updateCustomCocktailTag, deleteCustomCocktailTag, createCustomIngredientTag, updateCustomIngredientTag, deleteCustomIngredientTag, setCocktailRating, handleSetIgnoreGarnish, handleSetAllowAllSubstitutes, handleSetUseImperialUnits, handleSetKeepScreenAwake, handleSetRatingFilterThreshold, handleSetStartScreen, handleSetAppTheme, completeOnboarding, restartOnboarding
  ]);

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
