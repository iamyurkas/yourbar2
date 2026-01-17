import type { OnboardingStep } from '@/src/onboarding/onboarding-types';

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to YourBar',
    body: 'Let’s take a quick tour of the essentials. Tap Next to continue.',
    targetId: 'tab-cocktails',
    onEnter: async () => {
      // TODO: Navigate to the cocktails tab explicitly.
    },
    onNext: async () => {
      // TODO: Perform scripted demo actions for the cocktails list.
    },
  },
  {
    id: 'ingredients',
    title: 'Track your ingredients',
    body: 'Mark what you have in stock and build a shopping list.',
    targetId: 'tab-ingredients',
    onEnter: async () => {
      // TODO: Navigate to the ingredients tab explicitly.
    },
    onNext: async () => {
      // TODO: Toggle ingredient availability/shopping list entries.
    },
  },
  {
    id: 'favorites',
    title: 'Save your favorites',
    body: 'Rate cocktails to surface your favorites later.',
    targetId: 'cocktail-rating',
    onEnter: async () => {
      // TODO: Navigate to a cocktail details screen explicitly.
    },
    onNext: async () => {
      // TODO: Set a rating for a cocktail.
    },
  },
];

