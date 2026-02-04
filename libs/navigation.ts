import { StackActions, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { router } from 'expo-router';

import { normalizeSearchText } from '@/libs/search-normalization';

type RouteParams = Record<string, unknown> | undefined;
type ReturnToParams = Record<string, string> | undefined;
type NavigationRoute = { name: string; params?: RouteParams };

const areParamsEqual = (left?: RouteParams, right?: RouteParams): boolean => {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => rightKeys.includes(key) && left[key] === right[key]);
};

const areRoutesEqual = (
  left?: { name: string; params?: RouteParams },
  right?: { name: string; params?: RouteParams },
): boolean => {
  if (!left || !right) {
    return false;
  }

  if (left.name !== right.name) {
    return false;
  }

  return areParamsEqual(left.params, right.params);
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

const normalizePath = (path: string) => path.replace(/^\//, '');

const getParamString = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    const entry = value[0];
    return entry != null ? String(entry) : undefined;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  return undefined;
};

const doParamsMatch = (routeParams: RouteParams, expected?: ReturnToParams): boolean => {
  if (!expected) {
    return true;
  }

  if (!routeParams) {
    return false;
  }

  return Object.entries(expected).every(
    ([key, value]) => getParamString(routeParams[key]) === value,
  );
};

export const isRouteMatch = (
  route: NavigationRoute,
  path: string,
  params?: ReturnToParams,
): boolean => {
  const normalizedPath = normalizePath(path);
  const matchesName =
    route.name === normalizedPath ||
    route.name.endsWith(`/${normalizedPath}`) ||
    route.name.endsWith(normalizedPath);

  if (!matchesName) {
    return false;
  }

  return doParamsMatch(route.params, params);
};

export const popToRoute = (
  navigation: NavigationProp<ParamListBase>,
  {
    path,
    params,
    isRouteValid,
  }: {
    path: string;
    params?: ReturnToParams;
    isRouteValid?: (route: NavigationRoute) => boolean;
  },
): boolean => {
  const state = navigation.getState();
  const currentIndex = state.index ?? 0;

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const route = state.routes[index];
    if (!isRouteMatch(route, path, params)) {
      continue;
    }
    if (isRouteValid && !isRouteValid(route)) {
      continue;
    }

    navigation.dispatch(StackActions.pop(currentIndex - index));
    return true;
  }

  return false;
};

export const navigateBackWithHistory = (
  navigation: NavigationProp<ParamListBase>,
  {
    returnToPath,
    returnToParams,
    isRouteValid,
  }: {
    returnToPath?: string;
    returnToParams?: ReturnToParams;
    isRouteValid?: (route: NavigationRoute) => boolean;
  } = {},
) => {
  if (returnToPath && popToRoute(navigation, { path: returnToPath, params: returnToParams, isRouteValid })) {
    return;
  }

  const state = navigation.getState();
  const currentIndex = state.index ?? 0;

  if (currentIndex <= 0) {
    navigation.goBack();
    return;
  }

  const current = state.routes[currentIndex];

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const route = state.routes[index];
    if (areRoutesEqual(current, route)) {
      continue;
    }
    if (isRouteValid && !isRouteValid(route)) {
      continue;
    }

    navigation.dispatch(StackActions.pop(currentIndex - index));
    return;
  }

  navigation.goBack();
};

const buildEntityLookup = (entities: Array<{ id?: number | string; name?: string }>) => {
  const ids = new Set<number>();
  const names = new Set<string>();

  entities.forEach((item) => {
    const rawId = item.id;
    if (rawId != null) {
      const numericId = Number(rawId);
      if (!Number.isNaN(numericId)) {
        ids.add(numericId);
      }
    }

    const normalizedName = normalizeSearchText(item.name ?? '');
    if (normalizedName) {
      names.add(normalizedName);
    }
  });

  return { ids, names };
};

export const createEntityRouteValidator = ({
  ingredients,
  cocktails,
}: {
  ingredients: Array<{ id?: number | string; name?: string }>;
  cocktails: Array<{ id?: number | string; name?: string }>;
}) => {
  const ingredientLookup = buildEntityLookup(ingredients);
  const cocktailLookup = buildEntityLookup(cocktails);

  return (route: NavigationRoute) => {
    const isIngredientDetail = route.name.includes('ingredients/[ingredientId]');
    const isCocktailDetail = route.name.includes('cocktails/[cocktailId]');

    if (!isIngredientDetail && !isCocktailDetail) {
      return true;
    }

    const params = route.params ?? {};

    if (isIngredientDetail) {
      const paramValue = getParamString(params.ingredientId);
      if (!paramValue) {
        return false;
      }
      const numericId = Number(paramValue);
      if (!Number.isNaN(numericId)) {
        return ingredientLookup.ids.has(numericId);
      }
      return ingredientLookup.names.has(normalizeSearchText(paramValue));
    }

    const paramValue = getParamString(params.cocktailId);
    if (!paramValue) {
      return false;
    }
    const numericId = Number(paramValue);
    if (!Number.isNaN(numericId)) {
      return cocktailLookup.ids.has(numericId);
    }
    return cocktailLookup.names.has(normalizeSearchText(paramValue));
  };
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
  navigateBackWithHistory(navigation, { returnToPath, returnToParams });
};
