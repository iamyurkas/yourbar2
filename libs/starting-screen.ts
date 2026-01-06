import type { CocktailTabKey, IngredientTabKey } from '@/libs/collection-tabs';

export type StartingScreenOption =
  | 'cocktails-all'
  | 'cocktails-my'
  | 'cocktails-favorites'
  | 'shaker'
  | 'ingredients-all'
  | 'ingredients-my'
  | 'ingredients-shopping';

export const STARTING_SCREEN_DEFAULT: StartingScreenOption = 'cocktails-all';

type StartingScreenTarget = {
  path: '/cocktails' | '/ingredients' | '/shaker';
  cocktailTab?: CocktailTabKey;
  ingredientTab?: IngredientTabKey;
};

export type StartingScreenOptionConfig = {
  key: StartingScreenOption;
  label: string;
  target: StartingScreenTarget;
};

export const STARTING_SCREEN_OPTIONS: StartingScreenOptionConfig[] = [
  {
    key: 'cocktails-all',
    label: 'All cocktails',
    target: { path: '/cocktails', cocktailTab: 'all' },
  },
  {
    key: 'cocktails-my',
    label: 'My cocktails',
    target: { path: '/cocktails', cocktailTab: 'my' },
  },
  {
    key: 'cocktails-favorites',
    label: 'Favorite cocktails',
    target: { path: '/cocktails', cocktailTab: 'favorites' },
  },
  {
    key: 'shaker',
    label: 'Shaker',
    target: { path: '/shaker' },
  },
  {
    key: 'ingredients-all',
    label: 'All ingredients',
    target: { path: '/ingredients', ingredientTab: 'all' },
  },
  {
    key: 'ingredients-my',
    label: 'My ingredients',
    target: { path: '/ingredients', ingredientTab: 'my' },
  },
  {
    key: 'ingredients-shopping',
    label: 'Shopping list',
    target: { path: '/ingredients', ingredientTab: 'shopping' },
  },
];

export function sanitizeStartingScreen(
  value?: StartingScreenOption | string | null,
): StartingScreenOption {
  if (!value) {
    return STARTING_SCREEN_DEFAULT;
  }

  const found = STARTING_SCREEN_OPTIONS.find((option) => option.key === value);
  return found?.key ?? STARTING_SCREEN_DEFAULT;
}

export function resolveStartingScreenTarget(option: StartingScreenOption): StartingScreenTarget {
  const found = STARTING_SCREEN_OPTIONS.find((item) => item.key === option);
  if (found) {
    return found.target;
  }

  return STARTING_SCREEN_OPTIONS[0]?.target ?? { path: '/cocktails', cocktailTab: 'all' };
}
