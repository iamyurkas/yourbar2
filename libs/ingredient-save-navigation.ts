export type IngredientSaveNavigationPlan =
  | { kind: 'back_then_navigate_return' }
  | { kind: 'replace_return' }
  | { kind: 'back' }
  | { kind: 'replace_ingredient_details'; ingredientId: string }
  | { kind: 'replace_ingredients_list' };

export function getIngredientSaveNavigationPlan(input: {
  returnToPath?: string;
  canGoBack: boolean;
  fallbackIngredientId?: string;
}): IngredientSaveNavigationPlan {
  if (input.returnToPath) {
    if (input.canGoBack) {
      return { kind: 'back_then_navigate_return' };
    }

    return { kind: 'replace_return' };
  }

  if (input.canGoBack) {
    return { kind: 'back' };
  }

  if (input.fallbackIngredientId) {
    return {
      kind: 'replace_ingredient_details',
      ingredientId: input.fallbackIngredientId,
    };
  }

  return { kind: 'replace_ingredients_list' };
}
