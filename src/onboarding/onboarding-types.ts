export type OnboardingTargetAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OnboardingTarget = {
  anchor?: OnboardingTargetAnchor | null;
  description?: string | null;
};

export type OnboardingRouter = {
  navigate: (href: string) => void;
};

export type OnboardingInventoryActions = {
  getCocktailIdByName: (name: string) => string | null;
  getIngredientIdByName: (name: string) => number | null;
  ensureIngredientIdByName: (name: string) => number | null;
  isIngredientOnShoppingList: (id: number) => boolean;
  setIngredientAvailability: (id: number, available: boolean) => void;
  toggleIngredientShopping: (id: number) => void;
  setCocktailRating: (cocktailId: string, rating: number) => void;
};

export type OnboardingStepContext = {
  router: OnboardingRouter;
  inventory: OnboardingInventoryActions;
};

export type OnboardingStep = {
  id: string;
  title?: string | null;
  text: string;
  targetId?: string | null;
  target?: OnboardingTarget | null;
  routeTo: (router: OnboardingRouter) => void;
  onEnter?: (context: OnboardingStepContext) => void;
  onNext?: (context: OnboardingStepContext) => void | Promise<void>;
};

export type OnboardingState = {
  isActive: boolean;
  currentStepIndex: number;
  lastNextStepId?: string | null;
};

export type OnboardingContextValue = OnboardingState & {
  start: (force?: boolean) => void;
  stop: () => void;
  next: () => void;
  prev?: () => void;
};
