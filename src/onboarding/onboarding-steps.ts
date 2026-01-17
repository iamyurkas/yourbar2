import type { OnboardingStep } from '@/src/onboarding/onboarding-types';

export const ONBOARDING_TARGETS = {
  cocktailsMenu: 'onboarding-cocktails-menu',
  ingredientsMenu: 'onboarding-ingredients-menu',
} as const;

export function createOnboardingSteps(): OnboardingStep[] {
  return [
    {
      id: 'cocktails-menu',
      targetId: ONBOARDING_TARGETS.cocktailsMenu,
      title: 'Browse cocktails',
      description: 'Use the menu to access settings and your collections.',
      onEnter: ({ router }) => {
        router.replace('/cocktails');
      },
    },
    {
      id: 'ingredients-menu',
      targetId: ONBOARDING_TARGETS.ingredientsMenu,
      title: 'Manage ingredients',
      description: 'Switch to Ingredients to keep your inventory and shopping list up to date.',
      onEnter: ({ router }) => {
        router.replace('/ingredients');
      },
    },
  ];
}
