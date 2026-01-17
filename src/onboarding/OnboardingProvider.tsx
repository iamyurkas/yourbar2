import * as FileSystem from 'expo-file-system/legacy';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';

import { normalizeSearchText } from '@/libs/search-normalization';
import type { InventoryData } from '@/libs/inventory-data';
import { useInventory } from '@/providers/inventory-provider';

import { createOnboardingSteps } from './onboarding-steps';
import type { OnboardingSnapshot, OnboardingStep } from './onboarding-types';
import {
  getCocktailsOnboardingActions,
  getIngredientsOnboardingActions,
  getShakerOnboardingActions,
  subscribeIngredientsOnboardingActions,
} from './onboarding-helpers';

const STORAGE_FILENAME = 'onboarding-state.json';

type OnboardingContextValue = {
  isActive: boolean;
  currentStepIndex: number;
  currentStep: OnboardingStep | null;
  steps: OnboardingStep[];
  start: (force?: boolean) => void;
  stop: (completed?: boolean) => void;
  next: () => void;
  prev: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

function resolveStoragePath(): string | undefined {
  const documentPath = FileSystem.documentDirectory;
  if (!documentPath) {
    return undefined;
  }

  return `${documentPath.replace(/\/?$/, '/')}${STORAGE_FILENAME}`;
}

async function readHasSeenOnboarding(): Promise<boolean> {
  const storagePath = resolveStoragePath();
  if (!storagePath) {
    return false;
  }

  try {
    const info = await FileSystem.getInfoAsync(storagePath);
    if (!info.exists) {
      return false;
    }

    const contents = await FileSystem.readAsStringAsync(storagePath);
    if (!contents) {
      return false;
    }

    const parsed = JSON.parse(contents) as { hasSeenOnboarding?: boolean };
    return Boolean(parsed.hasSeenOnboarding);
  } catch (error) {
    console.warn('Unable to read onboarding state', error);
    return false;
  }
}

async function writeHasSeenOnboarding(value: boolean): Promise<void> {
  const storagePath = resolveStoragePath();
  if (!storagePath) {
    return;
  }

  try {
    await FileSystem.writeAsStringAsync(storagePath, JSON.stringify({ hasSeenOnboarding: value }));
  } catch (error) {
    console.warn('Unable to persist onboarding state', error);
  }
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const {
    exportInventoryData,
    importInventoryData,
    availableIngredientIds,
    shoppingIngredientIds,
    cocktailRatings,
    ignoreGarnish,
    allowAllSubstitutes,
    useImperialUnits,
    keepScreenAwake,
    ratingFilterThreshold,
    startScreen,
    setIngredientAvailability,
    setIngredientShopping,
    setCocktailRating,
    createIngredient,
    deleteIngredient,
    setIgnoreGarnish,
    setAllowAllSubstitutes,
    setUseImperialUnits,
    setKeepScreenAwake,
    setRatingFilterThreshold,
    setStartScreen,
    ingredients,
    cocktails,
  } = useInventory();
  const router = useRouter();
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [ingredientsActionsVersion, setIngredientsActionsVersion] = useState(0);
  const snapshotRef = useRef<OnboardingSnapshot | null>(null);
  const hasInitializedRef = useRef(false);

  const ensureIngredientId = useCallback(
    (name: string) => {
      const normalizedName = normalizeSearchText(name);
      const existing = ingredients.find(
        (ingredient) => normalizeSearchText(ingredient.name ?? '') === normalizedName,
      );
      if (existing?.id != null) {
        return Number(existing.id);
      }

      const created = createIngredient({ name, description: '', tags: [] });
      if (created?.id != null) {
        const createdId = Number(created.id);
        if (snapshotRef.current && !snapshotRef.current.createdIngredientIds.includes(createdId)) {
          snapshotRef.current.createdIngredientIds.push(createdId);
        }
        return createdId;
      }

      return undefined;
    },
    [createIngredient, ingredients],
  );

  const findCocktailByName = useCallback(
    (name: string) => {
      const normalizedName = normalizeSearchText(name);
      return cocktails.find(
        (cocktail) => normalizeSearchText(cocktail.name ?? '') === normalizedName,
      );
    },
    [cocktails],
  );

  useEffect(() => {
    const unsubscribe = subscribeIngredientsOnboardingActions(() => {
      setIngredientsActionsVersion((prev) => prev + 1);
    });
    return unsubscribe;
  }, []);

  const steps = useMemo<OnboardingStep[]>(() => {
    const ingredientActions = getIngredientsOnboardingActions();
    const cocktailActions = getCocktailsOnboardingActions();
    const shakerActions = getShakerOnboardingActions();
    return createOnboardingSteps({
      navigateToIngredients: () => {
        router.replace('/(tabs)/ingredients');
      },
      focusTab: (tab) => ingredientActions?.focusTab(tab),
      scrollToIngredient: (name, tab) => ingredientActions?.scrollToIngredient(name, tab),
      openIngredientDetails: (name) => ingredientActions?.openIngredientDetails(name),
      ensureIngredientId,
      setIngredientAvailability,
      setIngredientShopping,
      navigateToCocktails: () => {
        router.replace('/(tabs)/cocktails');
      },
      focusCocktailTab: (tab) => cocktailActions?.focusTab(tab),
      scrollToCocktail: (name, tab) => cocktailActions?.scrollToCocktail(name, tab),
      openCocktailDetails: (name) => cocktailActions?.openCocktailDetails(name),
      findCocktailByName,
      setCocktailRating,
      navigateToShaker: () => {
        router.replace('/(tabs)/shaker');
      },
      resetShakerFilters: () => shakerActions?.resetFilters(),
      ensureShakerIngredientVisible: (name) => shakerActions?.ensureIngredientVisible(name),
      selectShakerIngredient: (name) => shakerActions?.selectIngredient(name),
      showShakerResults: () => shakerActions?.showResults(),
    });
  }, [
    ensureIngredientId,
    findCocktailByName,
    ingredientsActionsVersion,
    router,
    setCocktailRating,
    setIngredientAvailability,
    setIngredientShopping,
  ]);

  const currentStep = isActive ? steps[currentStepIndex] ?? null : null;

  const createSnapshot = useCallback((): OnboardingSnapshot => {
    return {
      inventoryData: exportInventoryData(),
      availableIngredientIds: Array.from(availableIngredientIds),
      shoppingIngredientIds: Array.from(shoppingIngredientIds),
      cocktailRatings: { ...cocktailRatings },
      ignoreGarnish,
      allowAllSubstitutes,
      useImperialUnits,
      keepScreenAwake,
      ratingFilterThreshold,
      startScreen,
      createdIngredientIds: [],
    };
  }, [
    allowAllSubstitutes,
    availableIngredientIds,
    cocktailRatings,
    exportInventoryData,
    ignoreGarnish,
    keepScreenAwake,
    ratingFilterThreshold,
    shoppingIngredientIds,
    startScreen,
    useImperialUnits,
  ]);

  const restoreSnapshot = useCallback(
    (snapshot: OnboardingSnapshot | null) => {
      if (!snapshot) {
        return;
      }

      if (snapshot.inventoryData) {
        importInventoryData(snapshot.inventoryData as InventoryData);
      }

      snapshot.createdIngredientIds.forEach((id) => {
        deleteIngredient(id);
      });

      ingredients.forEach((ingredient) => {
        const id = Number(ingredient.id ?? -1);
        if (id < 0) {
          return;
        }

        const shouldBeAvailable = snapshot.availableIngredientIds.includes(id);
        if (availableIngredientIds.has(id) !== shouldBeAvailable) {
          setIngredientAvailability(id, shouldBeAvailable);
        }

        const shouldBeShopping = snapshot.shoppingIngredientIds.includes(id);
        setIngredientShopping(id, shouldBeShopping);
      });

      cocktails.forEach((cocktail) => {
        const key = cocktail.id != null ? String(cocktail.id) : normalizeSearchText(cocktail.name ?? '');
        const desiredRating = key ? snapshot.cocktailRatings[key] ?? 0 : 0;
        setCocktailRating(cocktail, desiredRating);
      });

      setIgnoreGarnish(snapshot.ignoreGarnish);
      setAllowAllSubstitutes(snapshot.allowAllSubstitutes);
      setUseImperialUnits(snapshot.useImperialUnits);
      setKeepScreenAwake(snapshot.keepScreenAwake);
      setRatingFilterThreshold(snapshot.ratingFilterThreshold);
      setStartScreen(snapshot.startScreen as never);
    },
    [
      availableIngredientIds,
      cocktails,
      deleteIngredient,
      importInventoryData,
      ingredients,
      setAllowAllSubstitutes,
      setCocktailRating,
      setIgnoreGarnish,
      setIngredientAvailability,
      setKeepScreenAwake,
      setRatingFilterThreshold,
      setStartScreen,
      setUseImperialUnits,
      setIngredientShopping,
    ],
  );

  const start = useCallback(
    (force = false) => {
      if (isActive && !force) {
        return;
      }

      snapshotRef.current = createSnapshot();
      setCurrentStepIndex(0);
      setIsActive(true);
    },
    [createSnapshot, isActive],
  );

  const stop = useCallback(
    (completed = false) => {
      setIsActive(false);
      setCurrentStepIndex(0);
      restoreSnapshot(snapshotRef.current);
      snapshotRef.current = null;
      if (completed) {
        void writeHasSeenOnboarding(true);
      }
    },
    [restoreSnapshot],
  );

  const next = useCallback(() => {
    if (!isActive) {
      return;
    }

    const step = steps[currentStepIndex];
    step?.onNext?.();

    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= steps.length) {
      stop(true);
      return;
    }

    setCurrentStepIndex(nextIndex);
  }, [currentStepIndex, isActive, steps, stop]);

  const prev = useCallback(() => {
    if (!isActive) {
      return;
    }

    const step = steps[currentStepIndex];
    step?.onPrev?.();

    setCurrentStepIndex((prevIndex) => Math.max(0, prevIndex - 1));
  }, [currentStepIndex, isActive, steps]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const step = steps[currentStepIndex];
    step?.routeTo?.();
    step?.onEnter?.();
  }, [currentStepIndex, isActive, steps]);

  useEffect(() => {
    if (hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;
    readHasSeenOnboarding()
      .then((hasSeen) => {
        if (!hasSeen) {
          start(false);
        }
      })
      .catch((error) => {
        console.warn('Unable to load onboarding state', error);
      });
  }, [start]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      isActive,
      currentStepIndex,
      currentStep,
      steps,
      start,
      stop,
      next,
      prev,
    }),
    [
      currentStep,
      currentStepIndex,
      isActive,
      next,
      prev,
      start,
      steps,
      stop,
    ],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }

  return context;
}
