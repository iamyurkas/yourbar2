import {
  CommonActions,
  StackActions,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import { router } from 'expo-router';

type RouteParams = Record<string, unknown> | undefined;
type ReturnToParams = Record<string, string> | undefined;
type NavigationRoute = {
  key: string;
  name: string;
  params?: RouteParams;
};

/*
Unified navigation history model:
- We treat the navigation state as a single, ordered stack of routes.
- Back navigation is resolved by walking backward through history until a valid,
  non-duplicate screen is found, popping invalid entries along the way.
- Routes that refer to deleted entities, resolve to the current screen, or are
  transient after save are removed from history to keep it valid.
*/

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

const getNavigationState = (navigation: NavigationProp<ParamListBase>) => {
  const state = navigation.getState();
  return {
    state,
    routes: state.routes as NavigationRoute[],
    index:
      typeof state.index === 'number'
        ? state.index
        : Math.max(0, (state.routes?.length ?? 1) - 1),
  };
};

const normalizeRoutes = (routes: NavigationRoute[]) =>
  routes.filter((route, index, list) => {
    if (index === 0) {
      return true;
    }
    return !areRoutesEqual(route, list[index - 1]);
  });

export const getCurrentRouteKey = (navigation: NavigationProp<ParamListBase>) => {
  const { routes, index } = getNavigationState(navigation);
  return routes[index]?.key;
};

export const getPreviousRouteKey = (navigation: NavigationProp<ParamListBase>) => {
  const { routes, index } = getNavigationState(navigation);
  if (index <= 0) {
    return undefined;
  }
  return routes[index - 1]?.key;
};

export const getRouteParam = (route: { params?: RouteParams }, key: string) => {
  const value = route.params?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

export const goBackWithHistory = (
  navigation: NavigationProp<ParamListBase>,
  {
    isRouteValid,
  }: {
    isRouteValid?: (route: NavigationRoute) => boolean;
  } = {},
) => {
  const { routes, index } = getNavigationState(navigation);

  if (index <= 0) {
    navigation.goBack();
    return;
  }

  const current = routes[index];
  for (let targetIndex = index - 1; targetIndex >= 0; targetIndex -= 1) {
    const candidate = routes[targetIndex];
    const isDuplicate = areRoutesEqual(current, candidate);
    const isValid = isRouteValid ? isRouteValid(candidate) : true;
    if (isValid && !isDuplicate) {
      const popCount = index - targetIndex;
      navigation.dispatch(StackActions.pop(popCount));
      return;
    }
  }

  navigation.dispatch(StackActions.pop(index));
};

export const popToRouteKey = (
  navigation: NavigationProp<ParamListBase>,
  targetKey: string,
  {
    isRouteValid,
  }: {
    isRouteValid?: (route: NavigationRoute) => boolean;
  } = {},
) => {
  const { routes, index } = getNavigationState(navigation);
  const targetIndex = routes.findIndex((route) => route.key === targetKey);
  if (targetIndex === -1) {
    goBackWithHistory(navigation, { isRouteValid });
    return false;
  }

  const targetRoute = routes[targetIndex];
  if (isRouteValid && !isRouteValid(targetRoute)) {
    pruneNavigationHistory(navigation, { isRouteValid });
    goBackWithHistory(navigation, { isRouteValid });
    return false;
  }

  const popCount = index - targetIndex;
  if (popCount > 0) {
    navigation.dispatch(StackActions.pop(popCount));
  }
  return true;
};

export const pruneNavigationHistory = (
  navigation: NavigationProp<ParamListBase>,
  {
    isRouteValid,
    preferRouteKey,
  }: {
    isRouteValid: (route: NavigationRoute) => boolean;
    preferRouteKey?: string;
  },
) => {
  const { state, routes, index } = getNavigationState(navigation);
  const filteredRoutes = normalizeRoutes(routes.filter((route) => isRouteValid(route)));

  if (filteredRoutes.length === 0) {
    return;
  }

  const currentKey = routes[index]?.key;
  const preferredIndex = preferRouteKey
    ? filteredRoutes.findIndex((route) => route.key === preferRouteKey)
    : -1;
  const currentIndex = currentKey
    ? filteredRoutes.findIndex((route) => route.key === currentKey)
    : -1;
  const nextIndex =
    preferredIndex >= 0
      ? preferredIndex
      : currentIndex >= 0
        ? currentIndex
        : Math.max(0, filteredRoutes.length - 1);

  navigation.dispatch(
    CommonActions.reset({
      ...state,
      routes: filteredRoutes,
      index: nextIndex,
    }),
  );
};

export const buildReturnToParams = (
  returnToPath?: string,
  returnToParams?: Record<string, string | undefined>,
  returnToKey?: string,
): { returnToPath?: string; returnToParams?: string; returnToKey?: string } => {
  if (!returnToPath && !returnToKey) {
    return {};
  }

  const entries = Object.entries(returnToParams ?? {}).filter(
    ([, value]) => typeof value === 'string' && value.length > 0,
  ) as Array<[string, string]>;
  const serialized = entries.length ? JSON.stringify(Object.fromEntries(entries)) : undefined;

  return {
    ...(returnToPath ? { returnToPath } : {}),
    ...(serialized ? { returnToParams: serialized } : {}),
    ...(returnToKey ? { returnToKey } : {}),
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

export const parseReturnToKey = (value?: string | string[]) => {
  const resolved = Array.isArray(value) ? value[0] : value;
  return typeof resolved === 'string' && resolved.length > 0 ? resolved : undefined;
};

export const navigateToDetailsWithReturnTo = ({
  pathname,
  params,
  returnToPath,
  returnToParams,
  returnToKey,
}: {
  pathname: string;
  params: Record<string, string>;
  returnToPath?: string;
  returnToParams?: Record<string, string | undefined>;
  returnToKey?: string;
}) => {
  router.push({
    pathname,
    params: {
      ...params,
      ...buildReturnToParams(returnToPath, returnToParams, returnToKey),
    },
  });
};

export const returnToSourceOrBack = (
  navigation: NavigationProp<ParamListBase>,
  {
    returnToKey,
    returnToPath,
    returnToParams,
    isRouteValid,
  }: {
    returnToKey?: string;
    returnToPath?: string;
    returnToParams?: ReturnToParams;
    isRouteValid?: (route: NavigationRoute) => boolean;
  },
) => {
  if (returnToKey) {
    const didReturn = popToRouteKey(navigation, returnToKey, { isRouteValid });
    if (didReturn) {
      return;
    }
  }

  if (returnToPath) {
    router.navigate({ pathname: returnToPath, params: returnToParams });
    return;
  }

  goBackWithHistory(navigation, { isRouteValid });
};
