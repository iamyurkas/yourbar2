export type OnboardingStep =
  | 'ingredients_tab'
  | 'ingredients_add'
  | 'cocktails_explain'
  | 'shaker_explain';

export const DEFAULT_ONBOARDING_STEP: OnboardingStep = 'ingredients_tab';

export const ONBOARDING_REQUIRED_INGREDIENTS = [
  { id: 111, name: 'Cola' },
  { id: 193, name: 'Ice' },
  { id: 315, name: 'Spiced Rum' },
] as const;
