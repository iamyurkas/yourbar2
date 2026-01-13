import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { StackActions } from '@react-navigation/native';

type RouteEntry = {
  name: string;
  params?: Record<string, unknown>;
};

const areParamsEqual = (left?: Record<string, unknown>, right?: Record<string, unknown>) => {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) {
    return false;
  }

  return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && left[key] === right[key]);
};

const isSameRoute = (left: RouteEntry, right: RouteEntry) =>
  left.name === right.name && areParamsEqual(left.params, right.params);

export const goBackSkippingDuplicates = (navigation: NavigationProp<ParamListBase>) => {
  const state = navigation.getState();
  const currentIndex = state.index ?? state.routes.length - 1;
  const currentRoute = state.routes[currentIndex] as RouteEntry;

  let previousIndex = currentIndex - 1;
  while (previousIndex >= 0 && isSameRoute(state.routes[previousIndex] as RouteEntry, currentRoute)) {
    previousIndex -= 1;
  }

  if (previousIndex >= 0 && previousIndex < currentIndex - 1) {
    const popCount = currentIndex - previousIndex;
    navigation.dispatch(StackActions.pop(popCount));
    return;
  }

  if (navigation.canGoBack()) {
    navigation.goBack();
  }
};
