import type { IngredientTabKey, CocktailTabKey } from './collection-tabs';

export type StartScreenKey =
  | 'cocktails-all'
  | 'cocktails-my'
  | 'cocktails-favorites'
  | 'shaker'
  | 'ingredients-all'
  | 'ingredients-my'
  | 'ingredients-shopping';

export type StartScreenOption = {
  key: StartScreenKey;
  label: string;
};

export const DEFAULT_START_SCREEN: StartScreenKey = 'cocktails-all';

export const START_SCREEN_OPTIONS: StartScreenOption[] = [
  { key: 'cocktails-all', label: 'All cocktails' },
  { key: 'cocktails-my', label: 'My cocktails' },
  { key: 'cocktails-favorites', label: 'Favorite cocktails' },
  { key: 'shaker', label: 'Shaker' },
  { key: 'ingredients-all', label: 'All ingredients' },
  { key: 'ingredients-my', label: 'My ingredients' },
  { key: 'ingredients-shopping', label: 'Shopping list' },
];

export function getStartScreenPath(key: StartScreenKey): string {
  switch (key) {
    case 'cocktails-my':
      return '/cocktails?tab=my';
    case 'cocktails-favorites':
      return '/cocktails?tab=favorites';
    case 'shaker':
      return '/shaker';
    case 'ingredients-my':
      return '/ingredients?tab=my';
    case 'ingredients-shopping':
      return '/ingredients?tab=shopping';
    case 'ingredients-all':
      return '/ingredients?tab=all';
    case 'cocktails-all':
    default:
      return '/cocktails?tab=all';
  }
}

export function getCocktailTabFromStartScreen(key: StartScreenKey): CocktailTabKey | undefined {
  switch (key) {
    case 'cocktails-my':
      return 'my';
    case 'cocktails-favorites':
      return 'favorites';
    case 'cocktails-all':
      return 'all';
    default:
      return undefined;
  }
}

export function getIngredientTabFromStartScreen(key: StartScreenKey): IngredientTabKey | undefined {
  switch (key) {
    case 'ingredients-my':
      return 'my';
    case 'ingredients-shopping':
      return 'shopping';
    case 'ingredients-all':
      return 'all';
    default:
      return undefined;
  }
}
