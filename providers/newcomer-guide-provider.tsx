import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Colors } from '@/constants/theme';
import { normalizeSearchText } from '@/libs/search-normalization';
import type { CocktailTabKey, IngredientTabKey } from '@/libs/collection-tabs';
import { useInventory, type Cocktail, type Ingredient } from '@/providers/inventory-provider';

export type GuideStepId =
  | 'ingredients_all'
  | 'ingredients_my_detail'
  | 'ingredients_shopping'
  | 'cocktails_all'
  | 'cocktails_my'
  | 'cocktails_my_detail'
  | 'cocktails_favorites'
  | 'cocktails_favorites_detail'
  | 'shaker';

type GuideContextValue = {
  isRunning: boolean;
  activeStepId: GuideStepId | null;
  requestedIngredientTab: IngredientTabKey | null;
  requestedCocktailTab: CocktailTabKey | null;
  shakerSelectionNames: string[];
  shouldAutoShowShakerResults: boolean;
};

type GuideStep = {
  id: GuideStepId;
  title: string;
  message: string;
  durationMs: number;
  ingredientTab?: IngredientTabKey | null;
  cocktailTab?: CocktailTabKey | null;
  shakerSelectionNames?: string[];
  shouldAutoShowShakerResults?: boolean;
  onEnter?: (helpers: GuideStepHelpers) => void;
};

type GuideStepHelpers = {
  schedule: (callback: () => void, delayMs: number) => void;
  navigateToTab: (path: '/ingredients' | '/cocktails' | '/shaker') => void;
  openIngredientDetail: (name: string) => void;
  openCocktailDetail: (name: string) => void;
  ensureIngredientAvailability: (name: string, available: boolean) => void;
  ensureIngredientShopping: (name: string, inShoppingList: boolean) => void;
  setCocktailRating: (name: string, rating: number) => void;
};

const GuideContext = createContext<GuideContextValue | undefined>(undefined);

const normalizeName = (value: string) => normalizeSearchText(value).trim().toLowerCase();

export function NewcomerGuideProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const {
    loading,
    ingredients,
    cocktails,
    availableIngredientIds,
    shoppingIngredientIds,
    setIngredientAvailability,
    toggleIngredientShopping,
    setCocktailRating,
    hasSeenNewcomerGuide,
    setHasSeenNewcomerGuide,
  } = useInventory();
  const [isRunning, setIsRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [activeStepId, setActiveStepId] = useState<GuideStepId | null>(null);
  const [requestedIngredientTab, setRequestedIngredientTab] = useState<IngredientTabKey | null>(null);
  const [requestedCocktailTab, setRequestedCocktailTab] = useState<CocktailTabKey | null>(null);
  const [shakerSelectionNames, setShakerSelectionNames] = useState<string[]>([]);
  const [shouldAutoShowShakerResults, setShouldAutoShowShakerResults] = useState(false);

  const ingredientsRef = useRef<Ingredient[]>(ingredients);
  const cocktailsRef = useRef<Cocktail[]>(cocktails);
  const availableIngredientIdsRef = useRef<Set<number>>(availableIngredientIds);
  const shoppingIngredientIdsRef = useRef<Set<number>>(shoppingIngredientIds);

  useEffect(() => {
    ingredientsRef.current = ingredients;
  }, [ingredients]);

  useEffect(() => {
    cocktailsRef.current = cocktails;
  }, [cocktails]);

  useEffect(() => {
    availableIngredientIdsRef.current = availableIngredientIds;
  }, [availableIngredientIds]);

  useEffect(() => {
    shoppingIngredientIdsRef.current = shoppingIngredientIds;
  }, [shoppingIngredientIds]);

  useEffect(() => {
    if (loading || hasSeenNewcomerGuide) {
      return;
    }

    setIsRunning(true);
    setStepIndex(0);
  }, [hasSeenNewcomerGuide, loading]);

  const steps = useMemo<GuideStep[]>(() => {
    return [
      {
        id: 'ingredients_all',
        title: 'Ingredients: what you already have',
        message:
          'In Ingredients → All, mark Champagne and Peach as in stock. This teaches the app what is available in your bar.',
        durationMs: 3600,
        ingredientTab: 'all',
        onEnter: ({ navigateToTab, ensureIngredientAvailability }) => {
          navigateToTab('/ingredients');
          ensureIngredientAvailability('Champagne', true);
          ensureIngredientAvailability('Peach', true);
        },
      },
      {
        id: 'ingredients_my_detail',
        title: 'My ingredients: add to shopping',
        message:
          'Open Orange Juice and add it to your shopping list so you can track what to buy next.',
        durationMs: 3600,
        ingredientTab: 'my',
        onEnter: ({ navigateToTab, schedule, openIngredientDetail, ensureIngredientShopping }) => {
          navigateToTab('/ingredients');
          schedule(() => openIngredientDetail('Orange Juice'), 700);
          schedule(() => ensureIngredientShopping('Orange Juice', true), 1400);
        },
      },
      {
        id: 'ingredients_shopping',
        title: 'Shopping list: clear items',
        message:
          'Switch to Ingredients → Shopping and remove Orange Juice to keep the list up to date.',
        durationMs: 3200,
        ingredientTab: 'shopping',
        onEnter: ({ navigateToTab, schedule, ensureIngredientShopping }) => {
          navigateToTab('/ingredients');
          ensureIngredientShopping('Orange Juice', true);
          schedule(() => ensureIngredientShopping('Orange Juice', false), 1600);
        },
      },
      {
        id: 'cocktails_all',
        title: 'All cocktails',
        message: 'In Cocktails → All, scroll to Bellini at the top to explore its details.',
        durationMs: 3200,
        cocktailTab: 'all',
        onEnter: ({ navigateToTab }) => {
          navigateToTab('/cocktails');
        },
      },
      {
        id: 'cocktails_my',
        title: 'My cocktails: missing ingredients',
        message:
          'In Cocktails → My, add Orange Juice to the shopping list to plan what you need.',
        durationMs: 3200,
        cocktailTab: 'my',
        onEnter: ({ navigateToTab, ensureIngredientShopping }) => {
          navigateToTab('/cocktails');
          ensureIngredientShopping('Orange Juice', true);
        },
      },
      {
        id: 'cocktails_my_detail',
        title: 'Rate Bellini',
        message: 'Open Bellini and rate it 3 stars to remember your favorites.',
        durationMs: 3200,
        cocktailTab: 'my',
        onEnter: ({ schedule, openCocktailDetail, setCocktailRating }) => {
          schedule(() => openCocktailDetail('Bellini'), 600);
          schedule(() => setCocktailRating('Bellini', 3), 1300);
        },
      },
      {
        id: 'cocktails_favorites',
        title: 'Favorites list',
        message: 'Switch to Cocktails → Favorites to see the cocktails you rate highly.',
        durationMs: 2800,
        cocktailTab: 'favorites',
        onEnter: ({ navigateToTab }) => {
          navigateToTab('/cocktails');
        },
      },
      {
        id: 'cocktails_favorites_detail',
        title: 'Update the favorite rating',
        message: 'Open Bellini again and set it to 4 stars to make it stand out.',
        durationMs: 3200,
        cocktailTab: 'favorites',
        onEnter: ({ schedule, openCocktailDetail, setCocktailRating }) => {
          schedule(() => openCocktailDetail('Bellini'), 600);
          schedule(() => setCocktailRating('Bellini', 4), 1300);
        },
      },
      {
        id: 'shaker',
        title: 'Shaker: AND vs OR',
        message:
          'Within one tag, ingredients are matched with AND; across different tags, they are matched with OR. Select Whiskey, White Rum, and Cola, then tap Show.',
        durationMs: 4000,
        shakerSelectionNames: ['Whiskey', 'White Rum', 'Cola'],
        shouldAutoShowShakerResults: true,
        onEnter: ({ navigateToTab }) => {
          navigateToTab('/shaker');
        },
      },
    ];
  }, []);

  const resolveIngredientId = (name: string): number | undefined => {
    const normalized = normalizeName(name);
    const entry = ingredientsRef.current.find(
      (ingredient) => normalizeName(ingredient.name ?? '') === normalized,
    );
    const rawId = Number(entry?.id ?? -1);
    return Number.isFinite(rawId) && rawId >= 0 ? Math.trunc(rawId) : undefined;
  };

  const resolveCocktail = (name: string): Cocktail | undefined => {
    const normalized = normalizeName(name);
    return cocktailsRef.current.find((cocktail) => normalizeName(cocktail.name ?? '') === normalized);
  };

  useEffect(() => {
    if (!isRunning) {
      setActiveStepId(null);
      setRequestedIngredientTab(null);
      setRequestedCocktailTab(null);
      setShakerSelectionNames([]);
      setShouldAutoShowShakerResults(false);
      return;
    }

    const currentStep = steps[stepIndex];

    if (!currentStep) {
      setIsRunning(false);
      setHasSeenNewcomerGuide(true);
      setActiveStepId(null);
      setRequestedIngredientTab(null);
      setRequestedCocktailTab(null);
      setShakerSelectionNames([]);
      setShouldAutoShowShakerResults(false);
      return;
    }

    setActiveStepId(currentStep.id);
    setRequestedIngredientTab(currentStep.ingredientTab ?? null);
    setRequestedCocktailTab(currentStep.cocktailTab ?? null);
    setShakerSelectionNames(currentStep.shakerSelectionNames ?? []);
    setShouldAutoShowShakerResults(Boolean(currentStep.shouldAutoShowShakerResults));

    const timeouts: Array<ReturnType<typeof setTimeout>> = [];

    const helpers: GuideStepHelpers = {
      schedule: (callback, delayMs) => {
        timeouts.push(setTimeout(callback, delayMs));
      },
      navigateToTab: (path) => {
        router.push(path);
      },
      openIngredientDetail: (name) => {
        const ingredientId = resolveIngredientId(name);
        if (!ingredientId) {
          return;
        }
        router.push({
          pathname: '/ingredients/[ingredientId]',
          params: { ingredientId: String(ingredientId) },
        });
      },
      openCocktailDetail: (name) => {
        const cocktail = resolveCocktail(name);
        if (!cocktail) {
          return;
        }
        const routeParam = cocktail.id ?? cocktail.name;
        if (routeParam == null) {
          return;
        }
        router.push({
          pathname: '/cocktails/[cocktailId]',
          params: { cocktailId: String(routeParam) },
        });
      },
      ensureIngredientAvailability: (name, available) => {
        const ingredientId = resolveIngredientId(name);
        if (!ingredientId) {
          return;
        }
        const isAvailable = availableIngredientIdsRef.current.has(ingredientId);
        if (isAvailable !== available) {
          setIngredientAvailability(ingredientId, available);
        }
      },
      ensureIngredientShopping: (name, inShoppingList) => {
        const ingredientId = resolveIngredientId(name);
        if (!ingredientId) {
          return;
        }
        const isInList = shoppingIngredientIdsRef.current.has(ingredientId);
        if (isInList !== inShoppingList) {
          toggleIngredientShopping(ingredientId);
        }
      },
      setCocktailRating: (name, rating) => {
        const cocktail = resolveCocktail(name);
        if (!cocktail) {
          return;
        }
        setCocktailRating(cocktail, rating);
      },
    };

    currentStep.onEnter?.(helpers);

    const advanceTimeout = setTimeout(() => {
      setStepIndex((previous) => previous + 1);
    }, currentStep.durationMs);

    return () => {
      timeouts.forEach(clearTimeout);
      clearTimeout(advanceTimeout);
    };
  }, [
    isRunning,
    router,
    setHasSeenNewcomerGuide,
    setIngredientAvailability,
    setCocktailRating,
    steps,
    stepIndex,
    toggleIngredientShopping,
  ]);

  const value = useMemo<GuideContextValue>(
    () => ({
      isRunning,
      activeStepId,
      requestedIngredientTab,
      requestedCocktailTab,
      shakerSelectionNames,
      shouldAutoShowShakerResults,
    }),
    [
      isRunning,
      activeStepId,
      requestedIngredientTab,
      requestedCocktailTab,
      shakerSelectionNames,
      shouldAutoShowShakerResults,
    ],
  );

  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>;
}

export function useNewcomerGuide() {
  const context = useContext(GuideContext);

  if (!context) {
    throw new Error('useNewcomerGuide must be used within a NewcomerGuideProvider');
  }

  return context;
}

export function NewcomerGuideOverlay() {
  const { activeStepId, isRunning } = useNewcomerGuide();

  const stepCopy = useMemo(() => {
    switch (activeStepId) {
      case 'ingredients_all':
        return {
          title: 'Ingredients: what you already have',
          message:
            'In Ingredients → All, mark Champagne and Peach as in stock. This teaches the app what is available in your bar.',
        };
      case 'ingredients_my_detail':
        return {
          title: 'My ingredients: add to shopping',
          message:
            'Open Orange Juice and add it to your shopping list so you can track what to buy next.',
        };
      case 'ingredients_shopping':
        return {
          title: 'Shopping list: clear items',
          message:
            'Switch to Ingredients → Shopping and remove Orange Juice to keep the list up to date.',
        };
      case 'cocktails_all':
        return {
          title: 'All cocktails',
          message: 'In Cocktails → All, scroll to Bellini at the top to explore its details.',
        };
      case 'cocktails_my':
        return {
          title: 'My cocktails: missing ingredients',
          message:
            'In Cocktails → My, add Orange Juice to the shopping list to plan what you need.',
        };
      case 'cocktails_my_detail':
        return {
          title: 'Rate Bellini',
          message: 'Open Bellini and rate it 3 stars to remember your favorites.',
        };
      case 'cocktails_favorites':
        return {
          title: 'Favorites list',
          message: 'Switch to Cocktails → Favorites to see the cocktails you rate highly.',
        };
      case 'cocktails_favorites_detail':
        return {
          title: 'Update the favorite rating',
          message: 'Open Bellini again and set it to 4 stars to make it stand out.',
        };
      case 'shaker':
        return {
          title: 'Shaker: AND vs OR',
          message:
            'Within one tag, ingredients are matched with AND; across different tags, they are matched with OR. Select Whiskey, White Rum, and Cola, then tap Show.',
        };
      default:
        return null;
    }
  }, [activeStepId]);

  if (!isRunning || !stepCopy) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <View style={styles.backdrop} />
      <View style={styles.card}>
        <Text style={styles.title}>{stepCopy.title}</Text>
        <Text style={styles.message}>{stepCopy.message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 32,
    zIndex: 10,
    elevation: 10,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  card: {
    width: '100%',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
  },
  title: {
    color: Colors.onSurface,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  message: {
    color: Colors.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 20,
  },
});
