import { StackActions, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { router } from 'expo-router';

import { normalizeSearchText } from './search-normalization';

type RouteParams = Record<string, unknown> | undefined;
type ReturnToParams = Record<string, string> | undefined;

function resolveCocktail(
  param: string | undefined,
  cocktails: any[],
): any | undefined {
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

  const normalized = normalizeSearchText(param);
  return cocktails.find(
    (item) => normalizeSearchText(item.name ?? "") === normalized,
  );
}

function resolveIngredient(
  param: string | undefined,
  ingredients: any[],
): any | undefined {
  if (!param) {
    return undefined;
  }

  const numericId = Number(param);
  if (!Number.isNaN(numericId)) {
    const byId = ingredients.find(
      (item) => Number(item.id ?? -1) === numericId,
    );
    if (byId) {
      return byId;
    }
  }

  const normalized = normalizeSearchText(param);
  return ingredients.find(
    (item) => normalizeSearchText(item.name ?? "") === normalized,
  );
}

const areParamsEqual = (left?: RouteParams, right?: RouteParams): boolean => {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  const leftKeys = Object.keys(left).filter(k => k !== 'returnToPath' && k !== 'returnToParams');
  const rightKeys = Object.keys(right).filter(k => k !== 'returnToPath' && k !== 'returnToParams');

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => rightKeys.includes(key) && String(left[key]) === String(right[key]));
};

const areRoutesEqual = (
  left?: { name: string; params?: RouteParams },
  right?: { name: string; params?: RouteParams },
): boolean => {
  if (!left || !right) {
    return false;
  }

  // Normalize names for comparison
  const leftName = left.name.replace(/\/index$/, '');
  const rightName = right.name.replace(/\/index$/, '');

  if (leftName !== rightName) {
    return false;
  }

  return areParamsEqual(left.params, right.params);
};

function isDetailViewForSameEntity(detailRoute: any, createRoute: any): boolean {
  if (!detailRoute.name.includes('[') || !createRoute.name.endsWith('/create')) {
    return false;
  }

  const detailType = detailRoute.name.split('/')[0];
  const createType = createRoute.name.split('/')[0];

  if (detailType !== createType) {
    return false;
  }

  // If it's an edit mode, check ID
  if (createRoute.params?.mode === 'edit') {
    const detailId = detailRoute.params?.cocktailId || detailRoute.params?.ingredientId;
    const createId = createRoute.params?.cocktailId || createRoute.params?.ingredientId;
    return detailId && createId && String(detailId) === String(createId);
  }

  // For new creations, if we are on a details page of the same type, we assume it's the result of that creation
  return true;
}

export const performNaturalBack = (
  navigation: NavigationProp<ParamListBase>,
  inventory: { cocktails: any[]; ingredients: any[] },
) => {
  const state = navigation.getState();
  if (!state) {
    navigation.goBack();
    return;
  }

  const routes = state.routes;
  const currentIndex = state.index ?? (routes.length - 1);
  const currentRoute = routes[currentIndex];

  let targetIndex = currentIndex - 1;

  while (targetIndex >= 0) {
    const route = routes[targetIndex];

    // 1. Skip if it refers to a deleted entity
    if (route.name.includes('cocktails/[cocktailId]')) {
      const id = (route.params as any)?.cocktailId;
      if (id && !resolveCocktail(String(id), inventory.cocktails)) {
        targetIndex--;
        continue;
      }
    }
    if (route.name.includes('ingredients/[ingredientId]')) {
      const id = (route.params as any)?.ingredientId;
      if (id && !resolveIngredient(String(id), inventory.ingredients)) {
        targetIndex--;
        continue;
      }
    }

    // 2. Skip if it's the same screen instance (Duplicate)
    if (areRoutesEqual(currentRoute, route)) {
      targetIndex--;
      continue;
    }

    // 3. Skip if it's an Edit/Create screen (Transient)
    // ONLY if we are currently on a detail view for the same entity (successful save scenario)
    if (route.name.endsWith('/create') && isDetailViewForSameEntity(currentRoute, route)) {
      targetIndex--;
      continue;
    }

    // Valid target found
    break;
  }

  if (targetIndex >= 0) {
    const popCount = currentIndex - targetIndex;
    if (popCount > 1) {
      navigation.dispatch(StackActions.pop(popCount));
      return;
    }
  }

  navigation.goBack();
};

export const skipDuplicateBack = (navigation: NavigationProp<ParamListBase>) => {
  const state = navigation.getState();
  const currentIndex = state.index ?? 0;

  if (currentIndex <= 0) {
    navigation.goBack();
    return;
  }

  const current = state.routes[currentIndex];
  const previous = state.routes[currentIndex - 1];
  const shouldSkip = areRoutesEqual(current, previous);

  if (shouldSkip && currentIndex >= 2) {
    navigation.dispatch(StackActions.pop(2));
    return;
  }

  navigation.goBack();
};

export const buildReturnToParams = (
  returnToPath?: string,
  returnToParams?: Record<string, string | undefined>,
): { returnToPath?: string; returnToParams?: string } => {
  if (!returnToPath) {
    return {};
  }

  const entries = Object.entries(returnToParams ?? {}).filter(
    ([, value]) => typeof value === 'string' && value.length > 0,
  ) as Array<[string, string]>;
  const serialized = entries.length ? JSON.stringify(Object.fromEntries(entries)) : undefined;

  return {
    returnToPath,
    ...(serialized ? { returnToParams: serialized } : {}),
  };
};

export const parseReturnToParams = (
  value?: string | string[],
): ReturnToParams | undefined => {
  const resolved = Array.isArray(value) ? value[0] : value;
  if (typeof resolved !== 'string' || resolved.length === 0) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(resolved);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined;
    }

    const entries = Object.entries(parsed).filter(([, entryValue]) => typeof entryValue === 'string');
    return entries.length ? (Object.fromEntries(entries) as Record<string, string>) : undefined;
  } catch (error) {
    console.warn('Failed to parse return params', error);
    return undefined;
  }
};

export const navigateToDetailsWithReturnTo = ({
  pathname,
  params,
  returnToPath,
  returnToParams,
}: {
  pathname: string;
  params: Record<string, string>;
  returnToPath?: string;
  returnToParams?: Record<string, string | undefined>;
}) => {
  router.push({
    pathname,
    params: {
      ...params,
      ...buildReturnToParams(returnToPath, returnToParams),
    },
  });
};

export const returnToSourceOrBack = (
  navigation: NavigationProp<ParamListBase>,
  {
    returnToPath,
    returnToParams,
  }: {
    returnToPath?: string;
    returnToParams?: ReturnToParams;
  },
) => {
  if (returnToPath) {
    router.navigate({ pathname: returnToPath, params: returnToParams });
    return;
  }

  navigation.goBack();
};
