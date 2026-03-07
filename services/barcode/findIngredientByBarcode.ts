import type { Ingredient } from '@/providers/inventory-provider';

export function sanitizeBarcode(value?: string | null): string {
  return value?.trim() ?? '';
}

export function findIngredientByBarcode(
  ingredients: readonly Ingredient[],
  barcode: string,
): Ingredient | undefined {
  const target = sanitizeBarcode(barcode);
  if (!target) {
    return undefined;
  }

  return ingredients.find((ingredient) =>
    (ingredient.barcodes ?? []).some((existing) => sanitizeBarcode(existing) === target),
  );
}

export function appendBarcode(ingredient: Ingredient, barcode: string): string[] {
  const target = sanitizeBarcode(barcode);
  const next = new Set((ingredient.barcodes ?? []).map((entry) => sanitizeBarcode(entry)).filter(Boolean));
  if (target) {
    next.add(target);
  }
  return Array.from(next);
}
