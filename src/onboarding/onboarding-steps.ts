import type { OnboardingStep } from '@/src/onboarding/onboarding-types';

export const ONBOARDING_TARGETS = {
  cocktailsMenu: 'onboarding-cocktails-menu',
  ingredientsMenu: 'onboarding-ingredients-menu',
} as const;

const TARGET_INGREDIENTS = ['Peach', 'Champagne'] as const;

const findIngredientIdsByName = (
  names: readonly string[],
  inventoryNames: Array<{ id?: number | string | null; name?: string | null }>,
) => {
  const normalizedTargets = new Set(names.map((name) => name.trim().toLowerCase()));

  return inventoryNames
    .filter((ingredient) => ingredient.name && normalizedTargets.has(ingredient.name.trim().toLowerCase()))
    .map((ingredient) => Number(ingredient.id ?? -1))
    .filter((id) => Number.isFinite(id) && id >= 0);
};

export function createOnboardingSteps(): OnboardingStep[] {
  return [
    {
      id: 'ingredients-manage',
      targetId: ONBOARDING_TARGETS.ingredientsMenu,
      title: 'Manage ingredients',
      description: 'Mark ingredients you have to see available cocktails.',
      onEnter: ({ router }) => {
        router.replace('/ingredients');
      },
      onNext: ({ inventory }) => {
        const targetIds = findIngredientIdsByName(TARGET_INGREDIENTS, inventory.ingredients);
        targetIds.forEach((id) => {
          inventory.setIngredientAvailability(id, true);
        });
      },
    },
    {
      id: 'cocktails-menu',
      targetId: ONBOARDING_TARGETS.cocktailsMenu,
      title: 'Browse cocktails',
      description: 'Use the menu to access settings and your collections.',
      onEnter: ({ router }) => {
        router.replace('/cocktails');
      },
    },
  ];
}
