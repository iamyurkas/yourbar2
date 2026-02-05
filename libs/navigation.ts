import {
  CommonActions,
  StackActions,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import { router } from 'expo-router';

import { normalizeSearchText } from '@/libs/search-normalization';

type RouteParams = Record<string, unknown> | undefined;
type ReturnToParams = Record<string, string> | undefined;

/**
 * Navigation Model
 * - One unified stack-based history represents the real user path.
 * - Back/gesture/programmatic back use the same history-walk algorithm:
 *   skip invalid entries (deleted entities, transient entries after save, or duplicates).
 * - Save replaces transient screens or returns to an earlier stack entry, removing Create/Edit screens.
 * - Delete prunes history so no deleted entity remains in the stack.
 */

type NavigationRoute = {
  name: string;
  params?: RouteParams;
};

type RouteValidator = (route: NavigationRoute) => boolean;

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

export const areRoutesEqual = (
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

const normalizeRouteName = (value: string) =>
  value
    .replace(/^\(.*?\)\//, '')
    .replace(/^\//, '')
    .replace(/\/index$/, '');

const doesRouteNameMatch = (routeName: string, expectedName: string) => {
  const normalizedRoute = normalizeRouteName(routeName);
  const normalizedExpected = normalizeRouteName(expectedName);
  return (
    normalizedRoute === normalizedExpected ||
    normalizedRoute.endsWith(`/${normalizedExpected}`)
  );
};

const getRouteParamValue = (
  params: RouteParams | undefined,
  key: string,
): string | undefined => {
  if (!params) {
    return undefined;
  }

  const rawValue = params[key];
  if (Array.isArray(rawValue)) {
    return rawValue[0] ? String(rawValue[0]) : undefined;
  }

  if (rawValue == null) {
    return undefined;
  }

  return String(rawValue);
};

type EntityLookup = {
  ids: Set<string>;
  names: Set<string>;
};

const buildEntityLookup = (
  entities: Array<{ id?: number | string | null; name?: string | null }>,
): EntityLookup => {
  const ids = new Set<string>();
  const names = new Set<string>();

  entities.forEach((entity) => {
    if (entity.id != null) {
      ids.add(String(entity.id));
    }
    if (entity.name) {
      names.add(normalizeSearchText(entity.name));
    }
  });

  return { ids, names };
};

const isEntityReferenceValid = (value: string, lookup: EntityLookup) => {
  if (lookup.ids.has(value)) {
    return true;
  }

  const normalized = normalizeSearchText(value);
  return lookup.names.has(normalized);
};

export const buildInventoryRouteValidator = ({
  ingredients,
  cocktails,
}: {
  ingredients: Array<{ id?: number | string | null; name?: string | null }>;
  cocktails: Array<{ id?: number | string | null; name?: string | null }>;
}): RouteValidator => {
  const ingredientLookup = buildEntityLookup(ingredients);
  const cocktailLookup = buildEntityLookup(cocktails);

  const matchers = [
    {
      routeNames: ['ingredients/[ingredientId]', 'ingredients/create'],
      paramKey: 'ingredientId',
      lookup: ingredientLookup,
    },
    {
      routeNames: ['cocktails/[cocktailId]', 'cocktails/create'],
      paramKey: 'cocktailId',
      lookup: cocktailLookup,
    },
  ];

  return (route) => {
    const matcher = matchers.find((entry) =>
      entry.routeNames.some((name) => doesRouteNameMatch(route.name, name)),
    );
    if (!matcher) {
      return true;
    }

    const paramValue = getRouteParamValue(route.params, matcher.paramKey);
    if (!paramValue) {
      return true;
    }

    return isEntityReferenceValid(paramValue, matcher.lookup);
  };
};

export const isRouteForEntity = (
  route: NavigationRoute,
  {
    routeName,
    paramKey,
    entityId,
    entityName,
  }: {
    routeName: string;
    paramKey: string;
    entityId: number | string;
    entityName?: string | null;
  },
) => {
  if (!doesRouteNameMatch(route.name, routeName)) {
    return false;
  }

  const paramValue = getRouteParamValue(route.params, paramKey);
  if (!paramValue) {
    return false;
  }

  if (String(paramValue) === String(entityId)) {
    return true;
  }

  if (entityName) {
    return normalizeSearchText(paramValue) === normalizeSearchText(entityName);
  }

  return false;
};

const findBackTargetIndex = (
  routes: NavigationRoute[],
  currentIndex: number,
  isRouteValid?: RouteValidator,
) => {
  const current = routes[currentIndex];

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const candidate = routes[index];
    const isSame = areRoutesEqual(candidate, current);
    const isValid = isRouteValid ? isRouteValid(candidate) : true;

    if (!isValid || isSame) {
      continue;
    }

    return index;
  }

  return -1;
};

export const navigateBackWithHistory = (
  navigation: NavigationProp<ParamListBase>,
  { isRouteValid }: { isRouteValid?: RouteValidator } = {},
) => {
  const state = navigation.getState();
  const currentIndex = state.index ?? state.routes.length - 1;

  if (currentIndex <= 0) {
    navigation.goBack();
    return;
  }

  const targetIndex = findBackTargetIndex(state.routes, currentIndex, isRouteValid);

  if (targetIndex < 0) {
    navigation.dispatch(StackActions.pop(currentIndex));
    return;
  }

  const popCount = currentIndex - targetIndex;
  if (popCount <= 0) {
    return;
  }

  navigation.dispatch(StackActions.pop(popCount));
};

export const pruneNavigationHistory = (
  navigation: NavigationProp<ParamListBase>,
  shouldRemoveRoute: (route: NavigationRoute, index: number) => boolean,
) => {
  const state = navigation.getState();
  const currentIndex = state.index ?? state.routes.length - 1;

  const nextRoutes: typeof state.routes = [];
  let nextIndex = 0;

  state.routes.forEach((route, index) => {
    if (shouldRemoveRoute(route, index)) {
      return;
    }

    const lastRoute = nextRoutes[nextRoutes.length - 1];
    if (lastRoute && areRoutesEqual(lastRoute, route)) {
      if (index <= currentIndex) {
        nextIndex = nextRoutes.length - 1;
      }
      return;
    }

    nextRoutes.push(route);
    if (index <= currentIndex) {
      nextIndex = nextRoutes.length - 1;
    }
  });

  if (nextRoutes.length === 0) {
    return;
  }

  if (nextRoutes.length === state.routes.length && nextIndex === currentIndex) {
    return;
  }

  navigation.dispatch(
    CommonActions.reset({
      ...state,
      routes: nextRoutes,
      index: Math.min(nextIndex, nextRoutes.length - 1),
    }),
  );
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
    isRouteValid,
  }: {
    returnToPath?: string;
    returnToParams?: ReturnToParams;
    isRouteValid?: RouteValidator;
  },
) => {
  if (returnToPath && navigation.canGoBack()) {
    navigateBackWithHistory(navigation, { isRouteValid });
    return;
  }

  if (returnToPath) {
    router.navigate({ pathname: returnToPath, params: returnToParams });
    return;
  }

  navigateBackWithHistory(navigation, { isRouteValid });
};
