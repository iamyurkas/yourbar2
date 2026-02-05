import { StackActions, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

export type RouteParams = Record<string, unknown> | undefined;
export type ReturnToParams = Record<string, string> | undefined;

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

  return leftKeys.every((key) => {
    const leftValue = left[key];
    const rightValue = right[key];

    // Handle returnToParams serialization differences if any
    if (key === 'returnToParams' && typeof leftValue === 'string' && typeof rightValue === 'string') {
        try {
            return JSON.stringify(JSON.parse(leftValue)) === JSON.stringify(JSON.parse(rightValue));
        } catch {
            return leftValue === rightValue;
        }
    }

    return rightKeys.includes(key) && leftValue === rightValue;
  });
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
  const previous = state.routes[currentIndex - 1];
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

export type NaturalBackOptions = {
  returnToPath?: string;
  returnToParams?: ReturnToParams;
  isRouteValid?: (route: { name: string; params?: RouteParams }) => boolean;
};

export const performNaturalBack = (
  navigation: NavigationProp<ParamListBase>,
  options?: NaturalBackOptions,
) => {
  const { returnToPath, returnToParams, isRouteValid } = options ?? {};

  if (returnToPath) {
    router.navigate({ pathname: returnToPath, params: returnToParams });
    return;
  }

  const state = navigation.getState();
  if (!state) {
    navigation.goBack();
    return;
  }

  const routes = state.routes;
  const currentIndex = state.index ?? routes.length - 1;
  const currentRoute = routes[currentIndex];

  let targetIndex = currentIndex - 1;

  while (targetIndex >= 0) {
    const route = routes[targetIndex];

    // Scenario 2: Skip if same as current
    if (areRoutesEqual(route, currentRoute)) {
      targetIndex--;
      continue;
    }

    // Scenario 3: Skip transient Edit/Create screens
    // Usually named 'create' in our app
    if (route.name === 'create') {
      targetIndex--;
      continue;
    }

    // Scenario 1: Skip if invalid (e.g. refers to deleted entity)
    if (isRouteValid && !isRouteValid(route)) {
      targetIndex--;
      continue;
    }

    // Found a valid target
    const popCount = currentIndex - targetIndex;
    if (popCount > 1) {
      navigation.dispatch(StackActions.pop(popCount));
    } else {
      navigation.goBack();
    }
    return;
  }

  // Fallback to normal back if no valid target found in history
  navigation.goBack();
};

export function useNaturalBackHandler(options?: NaturalBackOptions) {
  const navigation = useNavigation();
  const isHandlingBackRef = useRef(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (isHandlingBackRef.current) {
        return;
      }

      if (event.data.action.type !== 'GO_BACK') {
        return;
      }

      event.preventDefault();

      isHandlingBackRef.current = true;
      performNaturalBack(navigation as NavigationProp<ParamListBase>, options);

      requestAnimationFrame(() => {
        isHandlingBackRef.current = false;
      });
    });

    return unsubscribe;
  }, [navigation, options]);
}

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
  performNaturalBack(navigation, { returnToPath, returnToParams });
};
