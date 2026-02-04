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

export const isRouteValid = (
  route: { name: string; params?: RouteParams },
  cocktails: Array<{ id?: number | string | null; name?: string | null }>,
  ingredients: Array<{ id?: number | string | null; name?: string | null }>,
): boolean => {
  const { name, params } = route;

  if (name === 'cocktails/[cocktailId]') {
    const id = params?.cocktailId;
    if (id == null) return true;
    return cocktails.some((c) => String(c.id ?? c.name) === String(id));
  }

  if (name === 'ingredients/[ingredientId]') {
    const id = params?.ingredientId;
    if (id == null) return true;
    return ingredients.some((i) => String(i.id ?? i.name) === String(id));
  }

  return true;
};

export const findValidBackTarget = (
  state: { index: number; routes: Array<{ name: string; params?: RouteParams }> },
  cocktails: Array<{ id?: number | string | null; name?: string | null }>,
  ingredients: Array<{ id?: number | string | null; name?: string | null }>,
): number => {
  const currentRoute = state.routes[state.index];
  if (!currentRoute) return -1;

  for (let i = state.index - 1; i >= 0; i--) {
    const prevRoute = state.routes[i];
    if (areRoutesEqual(currentRoute, prevRoute)) {
      continue;
    }

    if (!isRouteValid(prevRoute, cocktails, ingredients)) {
      continue;
    }

    return i;
  }

  return -1;
};

export const performNaturalBack = (
  navigation: NavigationProp<ParamListBase>,
  cocktails: Array<{ id?: number | string | null; name?: string | null }>,
  ingredients: Array<{ id?: number | string | null; name?: string | null }>,
) => {
  const state = navigation.getState();
  const targetIndex = findValidBackTarget(state as any, cocktails, ingredients);

  if (targetIndex >= 0) {
    const popCount = state.index - targetIndex;
    if (popCount > 0) {
      navigation.dispatch(StackActions.pop(popCount));
      return;
    }
  }

  if (navigation.canGoBack()) {
    navigation.goBack();
  }
};

export const skipDuplicateBack = (navigation: NavigationProp<ParamListBase>) => {
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

  skipDuplicateBack(navigation);
};
