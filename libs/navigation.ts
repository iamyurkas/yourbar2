import { StackActions, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { router } from 'expo-router';

import { normalizeSearchText } from '@/libs/search-normalization';
import type { Cocktail, Ingredient } from '@/providers/inventory-provider';

type RouteParams = Record<string, unknown> | undefined;
type ReturnToParams = Record<string, string> | undefined;
type RouteDescriptor = { name: string; params?: RouteParams };
type RouteValidator = (route: RouteDescriptor) => boolean;

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
  left?: RouteDescriptor,
  right?: RouteDescriptor,
): boolean => {
  if (!left || !right) {
    return false;
  }

  if (left.name !== right.name) {
    return false;
  }

  return areParamsEqual(left.params, right.params);
};

const getParamValue = (params: RouteParams, key: string): unknown => {
  if (!params) {
    return undefined;
  }

  const value = params[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const resolveEntityByParam = <T extends { id?: number | string | null; name?: string | null }>(
  param: unknown,
  items: T[],
): T | undefined => {
  if (param == null) {
    return undefined;
  }

  const candidate = typeof param === 'string' || typeof param === 'number' ? param : undefined;
  if (candidate == null) {
    return undefined;
  }

  const numericId = Number(candidate);
  if (!Number.isNaN(numericId)) {
    const match = items.find((item) => Number(item.id ?? -1) === numericId);
    if (match) {
      return match;
    }
  }

  const normalized = normalizeSearchText(String(candidate));
  if (!normalized) {
    return undefined;
  }

  return items.find((item) => normalizeSearchText(item.name ?? '') === normalized);
};

const findValidBackIndex = (
  state: ReturnType<NavigationProp<ParamListBase>['getState']>,
  {
    currentRoute,
    isRouteValid,
  }: {
    currentRoute?: RouteDescriptor;
    isRouteValid?: RouteValidator;
  },
): number | null => {
  const currentIndex = state.index ?? 0;
  if (currentIndex <= 0) {
    return null;
  }

  const resolvedCurrent = currentRoute ?? state.routes[currentIndex];

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const candidate = state.routes[index];
    if (resolvedCurrent && areRoutesEqual(candidate, resolvedCurrent)) {
      continue;
    }

    if (isRouteValid && !isRouteValid(candidate)) {
      continue;
    }

    return index;
  }

  return null;
};

export const skipDuplicateBack = (navigation: NavigationProp<ParamListBase>) => {
  const state = navigation.getState();
  const currentIndex = state.index ?? 0;

  if (currentIndex <= 0) {
    navigation.goBack();
    return;
  }

  const targetIndex = findValidBackIndex(state, {});
  if (targetIndex == null) {
    navigation.goBack();
    return;
  }

  const offset = currentIndex - targetIndex;
  if (offset <= 0) {
    navigation.goBack();
    return;
  }

  navigation.dispatch(StackActions.pop(offset));
};

export const goBackSkippingInvalid = (
  navigation: NavigationProp<ParamListBase>,
  options: {
    isRouteValid?: RouteValidator;
    currentRoute?: RouteDescriptor;
  } = {},
) => {
  const state = navigation.getState();
  const currentIndex = state.index ?? 0;

  if (currentIndex <= 0) {
    navigation.goBack();
    return;
  }

  const targetIndex = findValidBackIndex(state, options);
  if (targetIndex == null) {
    navigation.goBack();
    return;
  }

  const offset = currentIndex - targetIndex;
  if (offset <= 0) {
    navigation.goBack();
    return;
  }

  navigation.dispatch(StackActions.pop(offset));
};

export const createInventoryRouteValidator = ({
  cocktails,
  ingredients,
}: {
  cocktails: Cocktail[];
  ingredients: Ingredient[];
}): RouteValidator => {
  return (route) => {
    const params = route.params;
    const cocktailParam = getParamValue(params, 'cocktailId');
    if (cocktailParam != null) {
      return Boolean(resolveEntityByParam(cocktailParam, cocktails));
    }

    const ingredientParam = getParamValue(params, 'ingredientId');
    if (ingredientParam != null) {
      return Boolean(resolveEntityByParam(ingredientParam, ingredients));
    }

    return true;
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
    currentPathname,
    isRouteValid,
  }: {
    returnToPath?: string;
    returnToParams?: ReturnToParams;
    currentPathname?: string;
    isRouteValid?: RouteValidator;
  },
) => {
  if (returnToPath && returnToPath !== currentPathname) {
    router.navigate({ pathname: returnToPath, params: returnToParams });
    return;
  }

  goBackSkippingInvalid(navigation, { isRouteValid });
};
