import { StackActions, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { router } from 'expo-router';

type RouteParams = Record<string, unknown> | undefined;
type ReturnToParams = Record<string, string> | undefined;
type NavigationRoute = { name: string; params?: RouteParams };
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

const areRoutesEqual = (
  left?: NavigationRoute,
  right?: NavigationRoute,
): boolean => {
  if (!left || !right) {
    return false;
  }

  if (left.name !== right.name) {
    return false;
  }

  return areParamsEqual(left.params, right.params);
};

const popToPreviousValidRoute = (
  navigation: NavigationProp<ParamListBase>,
  isRouteValid?: RouteValidator,
): boolean => {
  const state = navigation.getState();
  const currentIndex = state.index ?? 0;

  if (currentIndex <= 0) {
    return false;
  }

  const current = state.routes[currentIndex];
  let targetIndex = currentIndex - 1;

  while (targetIndex >= 0) {
    const candidate = state.routes[targetIndex];
    if (areRoutesEqual(current, candidate)) {
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

export const skipDuplicateBack = (
  navigation: NavigationProp<ParamListBase>,
  options?: { isRouteValid?: RouteValidator },
): boolean => {
  const didPop = popToPreviousValidRoute(navigation, options?.isRouteValid);
  if (didPop) {
    return true;
  }

  navigation.goBack();
  return false;
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

const getRouteParamValue = (route: NavigationRoute, key: string) => {
  const params = route.params;
  if (!params || typeof params !== 'object') {
    return undefined;
  }

  return params[key];
};

const normalizeRouteNumberParam = (value: unknown): number | undefined => {
  if (Array.isArray(value)) {
    return normalizeRouteNumberParam(value[0]);
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.trunc(value) : undefined;
  }

  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : Math.trunc(parsed);
};

export const createInventoryRouteValidator = ({
  ingredientIds,
  cocktailIds,
}: {
  ingredientIds?: Set<number>;
  cocktailIds?: Set<number>;
}): RouteValidator => {
  return (route) => {
    const routeName = route.name ?? '';

    if (routeName.includes('ingredients/[ingredientId]')) {
      if (!ingredientIds) {
        return true;
      }

      const param = getRouteParamValue(route, 'ingredientId');
      const normalized = normalizeRouteNumberParam(param);
      return normalized != null && ingredientIds.has(normalized);
    }

    if (routeName.includes('cocktails/[cocktailId]')) {
      if (!cocktailIds) {
        return true;
      }

      const param = getRouteParamValue(route, 'cocktailId');
      const normalized = normalizeRouteNumberParam(param);
      return normalized != null && cocktailIds.has(normalized);
    }

    return true;
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
  const didPop = popToPreviousValidRoute(navigation, isRouteValid);
  if (didPop) {
    return;
  }

  if (returnToPath) {
    router.navigate({ pathname: returnToPath, params: returnToParams });
    return;
  }

  navigation.goBack();
};
