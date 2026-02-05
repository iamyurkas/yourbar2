import { StackActions, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { router } from 'expo-router';

type RouteParams = Record<string, unknown> | undefined;
type ReturnToParams = Record<string, string> | undefined;
type NavigationRoute = { name: string; params?: RouteParams };

const normalizePath = (value?: string) =>
  typeof value === 'string' ? value.replace(/^\/+/, '') : undefined;

const getRouteParamValue = (route: NavigationRoute, key: string): string | undefined => {
  const value = route.params?.[key];
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

export const routeHasParamValue = (
  route: NavigationRoute,
  key: string,
  expected: string,
): boolean => getRouteParamValue(route, key) === expected;

export const popBackToValidRoute = (
  navigation: NavigationProp<ParamListBase>,
  isInvalidRoute: (route: NavigationRoute) => boolean,
) => {
  const state = navigation.getState();
  const currentIndex = state.index ?? 0;

  if (currentIndex <= 0) {
    navigation.goBack();
    return;
  }

  let targetIndex = currentIndex - 1;
  while (targetIndex >= 0) {
    const route = state.routes[targetIndex] as NavigationRoute;
    if (!isInvalidRoute(route)) {
      break;
    }
    targetIndex -= 1;
  }

  if (targetIndex < 0) {
    navigation.goBack();
    return;
  }

  const popCount = currentIndex - targetIndex;
  if (popCount > 1) {
    navigation.dispatch(StackActions.pop(popCount));
    return;
  }

  navigation.goBack();
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
  let targetIndex = currentIndex - 1;

  while (targetIndex >= 0 && areRoutesEqual(current, state.routes[targetIndex])) {
    targetIndex -= 1;
  }

  if (targetIndex < 0) {
    navigation.goBack();
    return;
  }

  const popCount = currentIndex - targetIndex;

  if (popCount > 1) {
    navigation.dispatch(StackActions.pop(popCount));
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
    const state = navigation.getState();
    const currentIndex = state.index ?? 0;
    const normalizedPath = normalizePath(returnToPath);

    if (normalizedPath) {
      for (let index = currentIndex - 1; index >= 0; index -= 1) {
        const route = state.routes[index] as NavigationRoute;
        const routeName = normalizePath(route.name);
        const routeScreen = normalizePath(getRouteParamValue(route, 'screen'));
        const hasPathMatch =
          routeName === normalizedPath ||
          routeName?.endsWith(`/${normalizedPath}`) ||
          routeScreen === normalizedPath ||
          routeScreen?.endsWith(`/${normalizedPath}`);

        if (!hasPathMatch) {
          continue;
        }

        if (returnToParams) {
          const matchesParams = Object.entries(returnToParams).every(([key, value]) => {
            if (!value) {
              return true;
            }
            return getRouteParamValue(route, key) === value;
          });
          if (!matchesParams) {
            continue;
          }
        }

        const popCount = currentIndex - index;
        if (popCount > 0) {
          navigation.dispatch(StackActions.pop(popCount));
        } else {
          skipDuplicateBack(navigation);
        }
        return;
      }
    }

    router.navigate({ pathname: returnToPath, params: returnToParams });
    return;
  }

  skipDuplicateBack(navigation);
};
