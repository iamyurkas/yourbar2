import { StackActions, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { router } from 'expo-router';

type RouteParams = Record<string, unknown> | undefined;
type ReturnToParams = Record<string, string> | undefined;

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

type RoutePredicate = (route: { name: string; params?: RouteParams }) => boolean;

export const popBackToValidRoute = (
  navigation: NavigationProp<ParamListBase>,
  {
    isRouteValid,
  }: {
    isRouteValid?: RoutePredicate;
  } = {},
): boolean => {
  const state = navigation.getState();
  const routes = state.routes ?? [];
  const currentIndex = typeof state.index === 'number' ? state.index : routes.length - 1;

  if (currentIndex <= 0) {
    return false;
  }

  const current = routes[currentIndex];
  let targetIndex = currentIndex - 1;

  while (targetIndex >= 0) {
    const candidate = routes[targetIndex];
    if (current && areRoutesEqual(current, candidate)) {
      targetIndex -= 1;
      continue;
    }

    if (isRouteValid && !isRouteValid(candidate)) {
      targetIndex -= 1;
      continue;
    }

    break;
  }

  if (targetIndex < 0) {
    return false;
  }

  const popCount = currentIndex - targetIndex;
  if (popCount <= 0) {
    return false;
  }

  navigation.dispatch(StackActions.pop(popCount));
  return true;
};

export const skipDuplicateBack = (navigation: NavigationProp<ParamListBase>) => {
  if (!popBackToValidRoute(navigation)) {
    navigation.goBack();
  }
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
    isRouteValid?: RoutePredicate;
  },
) => {
  if (navigation.canGoBack()) {
    if (!popBackToValidRoute(navigation, { isRouteValid })) {
      if (returnToPath) {
        router.navigate({ pathname: returnToPath, params: returnToParams });
      }
    }
    return;
  }

  if (returnToPath) {
    router.navigate({ pathname: returnToPath, params: returnToParams });
    return;
  }

  skipDuplicateBack(navigation);
};
