import { StackActions, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { router } from 'expo-router';

type RouteParams = Record<string, unknown> | undefined;
type ReturnToParams = Record<string, string> | undefined;
type RouteSnapshot = { name: string; params?: RouteParams };
type RouteValidator = (route: RouteSnapshot) => boolean;

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

const normalizeRouteName = (name: string) => name.replace(/^\/+/, '');

export const routeNameMatches = (route: RouteSnapshot, target: string) =>
  normalizeRouteName(route.name).includes(normalizeRouteName(target));

export const getRouteParam = (route: RouteSnapshot, key: string): string | undefined => {
  const params = route.params;
  if (!params || typeof params !== 'object') {
    return undefined;
  }

  const value = (params as Record<string, unknown>)[key];
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' || typeof first === 'number' ? String(first) : undefined;
  }

  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
};

export const navigateBack = (
  navigation: NavigationProp<ParamListBase>,
  {
    returnToPath,
    returnToParams,
    isRouteValid,
  }: {
    returnToPath?: string;
    returnToParams?: ReturnToParams;
    isRouteValid?: RouteValidator;
  } = {},
) => {
  const state = navigation.getState();
  const currentIndex = state.index ?? 0;

  const canReturnTo =
    returnToPath &&
    (!isRouteValid || isRouteValid({ name: returnToPath, params: returnToParams }));

  if (currentIndex <= 0) {
    if (canReturnTo && returnToPath) {
      router.navigate({ pathname: returnToPath, params: returnToParams });
      return;
    }
    navigation.goBack();
    return;
  }

  const current = state.routes[currentIndex];
  let targetIndex: number | undefined;

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const candidate = state.routes[index];
    if (areRoutesEqual(current, candidate)) {
      continue;
    }

    if (isRouteValid && !isRouteValid(candidate)) {
      continue;
    }

    targetIndex = index;
    break;
  }

  if (targetIndex != null) {
    const steps = currentIndex - targetIndex;
    navigation.dispatch(StackActions.pop(steps));
    return;
  }

  if (canReturnTo && returnToPath) {
    router.navigate({ pathname: returnToPath, params: returnToParams });
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
  navigateBack(navigation, { returnToPath, returnToParams });
};
