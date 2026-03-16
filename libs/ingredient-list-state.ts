import type { IngredientSortOption } from '@/libs/ingredient-sort-options';
import type { IngredientTabKey } from '@/libs/collection-tabs';

export type IngredientListState = {
  query: string;
  tab: IngredientTabKey;
  tagKeys: string[];
  sort: IngredientSortOption;
  isSortDescending: boolean;
};

let lastIngredientListState: IngredientListState = {
  query: '',
  tab: 'all',
  tagKeys: [],
  sort: 'alphabetical',
  isSortDescending: false,
};

export function getLastIngredientListState(): IngredientListState {
  return lastIngredientListState;
}

export function setLastIngredientListState(next: IngredientListState): void {
  lastIngredientListState = next;
}
