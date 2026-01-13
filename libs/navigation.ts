import { StackActions, type NavigationProp, type ParamListBase } from '@react-navigation/native';

type RouteParams = Record<string, unknown> | undefined;

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
  const previous = state.routes[currentIndex - 1];
  const shouldSkip = areRoutesEqual(current, previous);

  if (shouldSkip && currentIndex >= 2) {
    navigation.dispatch(StackActions.pop(2));
    return;
  }

  navigation.goBack();
};
