import type { Ingredient } from '@/providers/inventory-provider';
import { normalizeProductName } from '@/services/barcode/normalizeProductName';

export function findSimilarIngredientByName(
  ingredients: readonly Ingredient[],
  productName?: string,
): Ingredient | undefined {
  const normalizedProductName = normalizeProductName(productName);
  if (!normalizedProductName) {
    return undefined;
  }

  return ingredients.find((ingredient) => {
    const normalizedIngredientName = normalizeProductName(ingredient.name);
    if (!normalizedIngredientName) {
      return false;
    }

    return (
      normalizedIngredientName === normalizedProductName
      || normalizedIngredientName.includes(normalizedProductName)
      || normalizedProductName.includes(normalizedIngredientName)
    );
  });
}
