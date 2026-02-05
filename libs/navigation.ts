import { StackActions, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { router } from 'expo-router';
import { normalizeSearchText } from './search-normalization';

type RouteParams = Record<string, unknown> | undefined;
type ReturnToParams = Record<string, string> | undefined;
type RouteLike = { name: string; params?: RouteParams };
type RouteValidator = (route: RouteLike) => boolean;
type EntityLike = { id?: number | string | null; name?: string | null };
type EntityRouteConfig = {
  path: string;
  paramKey: string;
  entities: EntityLike[];
};

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
  left?: RouteLike,
  right?: RouteLike,
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
    .replace(/^\//, '')
    .split('/')
    .filter((segment) => segment.length > 0 && !/^\(.+\)$/.test(segment))
    .join('/')
    .replace(/\/index$/, '');

const routeMatchesPath = (
  route: RouteLike,
  path: string,
  params?: RouteParams,
): boolean => {
  if (normalizeRouteName(route.name) !== normalizeRouteName(path)) {
    return false;
  }

  if (!params) {
    return true;
  }

  return areParamsEqual(route.params, params);
};

const resolveEntityFromParam = (param: unknown, entities: EntityLike[]) => {
  if (param == null) {
    return undefined;
  }

  const resolvedValue = Array.isArray(param) ? param[0] : param;
  if (typeof resolvedValue === 'number') {
    return entities.find((item) => Number(item.id ?? -1) === resolvedValue);
  }

  if (typeof resolvedValue === 'string') {
    const numericValue = Number(resolvedValue);
    if (!Number.isNaN(numericValue)) {
      const byId = entities.find((item) => Number(item.id ?? -1) === numericValue);
      if (byId) {
        return byId;
      }
    }

    const normalized = normalizeSearchText(resolvedValue);
    return entities.find((item) => normalizeSearchText(item.name ?? '') === normalized);
  }

  return undefined;
};

const popToIndex = (
  navigation: NavigationProp<ParamListBase>,
  currentIndex: number,
  targetIndex: number,
): boolean => {
  if (targetIndex < 0 || currentIndex <= targetIndex) {
    return false;
  }

  const count = currentIndex - targetIndex;
  navigation.dispatch(StackActions.pop(count));
  return true;
};

const findPreviousValidIndex = (
  routes: RouteLike[],
  currentIndex: number,
  currentRoute: RouteLike,
  isRouteValid?: RouteValidator,
): number | null => {
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const route = routes[index];
    if (areRoutesEqual(route, currentRoute)) {
      continue;
    }

    if (isRouteValid && !isRouteValid(route)) {
      continue;
    }

    return index;
  }

  return null;
};

const popToPreviousValidRoute = (
  navigation: NavigationProp<ParamListBase>,
  isRouteValid?: RouteValidator,
): boolean => {
  if (!navigation.canGoBack()) {
    return false;
  }

  const state = navigation.getState();
  const currentIndex = state.index ?? state.routes.length - 1;
  const currentRoute = state.routes[currentIndex];
  if (!currentRoute || currentIndex <= 0) {
    return false;
  }

  const targetIndex = findPreviousValidIndex(
    state.routes,
    currentIndex,
    currentRoute,
    isRouteValid,
  );

  if (targetIndex == null) {
    if (!isRouteValid) {
      navigation.goBack();
      return true;
    }

    return false;
  }

  return popToIndex(navigation, currentIndex, targetIndex);
};

export const skipDuplicateBack = (
  navigation: NavigationProp<ParamListBase>,
  options?: { isRouteValid?: RouteValidator },
): boolean => popToPreviousValidRoute(navigation, options?.isRouteValid);

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
): boolean => {
  if (returnToPath) {
    const routeCandidate: RouteLike = {
      name: normalizeRouteName(returnToPath),
      params: returnToParams,
    };
    if (isRouteValid && !isRouteValid(routeCandidate)) {
      return popToPreviousValidRoute(navigation, isRouteValid);
    }

    const state = navigation.getState();
    const currentIndex = state.index ?? state.routes.length - 1;
    const currentRoute = state.routes[currentIndex];
    if (currentRoute) {
      for (let index = currentIndex - 1; index >= 0; index -= 1) {
        const route = state.routes[index];
        if (areRoutesEqual(route, currentRoute)) {
          continue;
        }
        if (!routeMatchesPath(route, returnToPath, returnToParams)) {
          continue;
        }
        if (isRouteValid && !isRouteValid(route)) {
          continue;
        }

        return popToIndex(navigation, currentIndex, index);
      }
    }

    router.navigate({ pathname: returnToPath, params: returnToParams });
    return true;
  }

  return popToPreviousValidRoute(navigation, isRouteValid);
};

export const createEntityRouteValidator =
  (configs: EntityRouteConfig[]): RouteValidator =>
  (route) => {
    const match = configs.find((config) => routeMatchesPath(route, config.path));
    if (!match) {
      return true;
    }

    const paramValue = route.params?.[match.paramKey];
    return Boolean(resolveEntityFromParam(paramValue, match.entities));
  };

export const isRouteMatch = routeMatchesPath;
