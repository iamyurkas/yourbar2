import { setLastIngredientTab } from '@/libs/collection-tabs';
import type { OnboardingStep } from '@/src/onboarding/onboarding-types';

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to YourBar',
    body: 'Let’s take a quick tour of the essentials. Tap Next to continue.',
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
    body: 'Search by name or by tags (categories).',
    targetId: 'ingredients-header',
    onEnter: async ({ router }) => {
      setLastIngredientTab('all');
      router.replace('/ingredients');
    },
    onNext: async ({ emitUiAction }) => {
      emitUiAction({ type: 'ingredients_search', value: 'Champagne', stepId: 'ingredients' });
      // TODO: Toggle ingredient availability/shopping list entries.
    },
  },
  {
    id: 'favorites',
    title: 'Mark what you have',
    body: 'You will see available cocktails with your ingredients.',
    targetId: 'ingredients-first-item',
    spotlightOffsetY: 20,
    onEnter: async ({ router }) => {
      setLastIngredientTab('all');
      router.replace('/ingredients');
    },
    onNext: async ({ inventory }) => {
      inventory.setIngredientAvailabilityByName('Champagne', true);
    },
  },
];
