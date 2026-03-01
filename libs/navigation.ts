import { StackActions, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { router } from 'expo-router';

type RouteParams = object | undefined;
type ReturnToParams = Record<string, string> | undefined;

type RouterObjectHref = Extract<Parameters<typeof router.push>[0], { pathname: unknown }>;
type RouterPathname = RouterObjectHref['pathname'];

type NavigationLike = Pick<NavigationProp<ParamListBase>, 'goBack' | 'dispatch'> & {
  getState: () =>
    | {
        index: number;
        routes: Array<{ name: string; params?: RouteParams }>;
      }
    | undefined;
};

const areParamsEqual = (left?: RouteParams, right?: RouteParams): boolean => {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => rightKeys.includes(key) && leftRecord[key] === rightRecord[key]);
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

export const skipDuplicateBack = (navigation: NavigationLike) => {
  const state = navigation.getState();
  const currentIndex = state?.index ?? 0;

  if (currentIndex <= 0) {
    navigation.goBack();
    return;
  }

  const current = state?.routes[currentIndex];
  const previous = state?.routes[currentIndex - 1];
  const shouldSkip = areRoutesEqual(current, previous);

  if (shouldSkip && currentIndex >= 2) {
    navigation.dispatch(StackActions.pop(2));
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
  pathname: RouterPathname;
  params: Record<string, string>;
  returnToPath?: RouterPathname;
  returnToParams?: Record<string, string | undefined>;
}) => {
  router.push({
    pathname,
    params: {
      ...params,
      ...buildReturnToParams(returnToPath, returnToParams),
    },
  } as RouterObjectHref);
};

export const returnToSourceOrBack = (
  navigation: NavigationLike,
  {
    returnToPath,
    returnToParams,
  }: {
    returnToPath?: string;
    returnToParams?: ReturnToParams;
  },
) => {
  if (returnToPath) {
    router.navigate({ pathname: returnToPath as RouterPathname, params: returnToParams } as RouterObjectHref);
    return;
  }

  skipDuplicateBack(navigation);
};
