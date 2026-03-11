import type { Ingredient } from '@/providers/inventory-provider';
import { getBarcodeLookupCandidates, normalizeBarcode } from '@/services/barcode/barcodeNormalization';

export function sanitizeBarcode(value?: string | null): string {
  return normalizeBarcode(value);
}

export function findIngredientByBarcode(
  ingredients: readonly Ingredient[],
  barcode: string,
): Ingredient | undefined {
  const target = sanitizeBarcode(barcode);
  const targetCandidates = new Set(getBarcodeLookupCandidates(target));
  if (!target) {
    return undefined;
  }

  return ingredients.find((ingredient) =>
    (ingredient.barcodes ?? []).some((existing) => {
      const normalizedExisting = sanitizeBarcode(existing);
      if (!normalizedExisting) {
        return false;
      }

      if (targetCandidates.has(normalizedExisting)) {
        return true;
      }

      return getBarcodeLookupCandidates(normalizedExisting).some((candidate) => targetCandidates.has(candidate));
    }),
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
