import { StackActions, type NavigationProp, type ParamListBase, type Route } from '@react-navigation/native';
import { router, useNavigation } from 'expo-router';
import { useCallback, useRef } from 'react';
import { useInventory } from '@/providers/inventory-provider';
import { normalizeSearchText } from './search-normalization';

type RouteParams = Record<string, unknown> | undefined;
type ReturnToParams = Record<string, string> | undefined;

const areParamsEqual = (left?: RouteParams, right?: RouteParams): boolean => {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  const leftKeys = Object.keys(left).filter(k => k !== 'returnToPath' && k !== 'returnToParams');
  const rightKeys = Object.keys(right).filter(k => k !== 'returnToPath' && k !== 'returnToParams');

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => rightKeys.includes(key) && String(left[key]) === String(right[key]));
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

export function useNaturalBackHandler() {
  const { cocktails, ingredients } = useInventory();
  const navigation = useNavigation();
  const isHandlingRef = useRef(false);

  const isRouteValid = useCallback((route: Route<string>) => {
    const name = route.name;
    const params = route.params as any;

    if (name === 'cocktails/[cocktailId]') {
      const id = params?.cocktailId;
      if (!id) return false;
      const normalizedId = normalizeSearchText(String(id));
      return cocktails.some(c =>
        String(c.id) === String(id) ||
        normalizeSearchText(c.name) === normalizedId
      );
    }

    if (name === 'ingredients/[ingredientId]') {
      const id = params?.ingredientId;
      if (!id) return false;
      const normalizedId = normalizeSearchText(String(id));
      return ingredients.some(i =>
        String(i.id) === String(id) ||
        normalizeSearchText(i.name) === normalizedId
      );
    }

    return true;
  }, [cocktails, ingredients]);

  const performNaturalBack = useCallback((options?: { skipTransient?: boolean; skipCurrent?: boolean }) => {
    if (isHandlingRef.current) return;

    const state = navigation.getState();
    if (!state) {
      router.back();
      return;
    }

    const currentIndex = state.index;
    const routes = state.routes;
    const currentRoute = routes[currentIndex];
    const currentParams = currentRoute?.params as any;

    const returnToPath = currentParams?.returnToPath;
    const returnToParams = parseReturnToParams(currentParams?.returnToParams);

    // Scenario 5 & 6: If we have a explicit return path and we are either skipping current
    // (after save) or we are at the bottom of the current stack, use it.
    if (returnToPath && (options?.skipCurrent || currentIndex === 0)) {
      isHandlingRef.current = true;
      router.navigate({ pathname: returnToPath, params: returnToParams });
      setTimeout(() => {
        isHandlingRef.current = false;
      }, 100);
      return;
    }

    let targetIndex = currentIndex - (options?.skipCurrent ? 2 : 1);

    while (targetIndex >= 0) {
      const targetRoute = routes[targetIndex];

      // Scenario 2: Skip duplicates
      if (areRoutesEqual(targetRoute, currentRoute)) {
        targetIndex--;
        continue;
      }

      // Scenario 1: Skip deleted entities
      if (!isRouteValid(targetRoute)) {
        targetIndex--;
        continue;
      }

      // Scenario 3: Skip transient Edit/Create screens
      // But DON'T skip if it's the immediate predecessor and we haven't just saved.
      // Actually, if we are going back, we usually want to skip Edit screens if they are in the history.
      if (targetRoute.name.endsWith('/create') || targetRoute.name.endsWith('/edit')) {
        targetIndex--;
        continue;
      }

      break;
    }

    isHandlingRef.current = true;
    if (targetIndex < 0) {
      if (returnToPath) {
        router.navigate({ pathname: returnToPath, params: returnToParams });
      } else {
        navigation.goBack();
      }
    } else {
      const popCount = currentIndex - targetIndex;
      if (popCount > 1) {
        navigation.dispatch(StackActions.pop(popCount));
      } else {
        navigation.goBack();
      }
    }

    setTimeout(() => {
      isHandlingRef.current = false;
    }, 100);
  }, [navigation, isRouteValid]);

  return { performNaturalBack, isHandlingRef };
}
