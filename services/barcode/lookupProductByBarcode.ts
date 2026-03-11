import { getBarcodeLookupCandidates, normalizeBarcode } from '@/services/barcode/barcodeNormalization';
import { fetchProductByBarcode } from '@/services/barcode/openFoodFacts';
import type { BarcodeLookupResult } from '@/services/barcode/types';
import { fetchProductByBarcodeFromUpcItemDb } from '@/services/barcode/upcItemDb';

const LOOKUP_PROVIDERS = [fetchProductByBarcode, fetchProductByBarcodeFromUpcItemDb] as const;

export async function lookupProductByBarcode(rawBarcode: string): Promise<BarcodeLookupResult> {
  const normalizedInput = normalizeBarcode(rawBarcode);
  const candidates = getBarcodeLookupCandidates(normalizedInput);

  if (!normalizedInput || candidates.length === 0) {
    return { kind: 'error', barcode: rawBarcode, message: 'Invalid barcode' };
  }

  let firstError: string | undefined;

  for (const candidate of candidates) {
    for (const provider of LOOKUP_PROVIDERS) {
      const result = await provider(candidate);

      if (result.kind === 'found') {
        return {
          kind: 'found',
          draft: {
            ...result.draft,
            barcode: normalizedInput,
            categories: result.draft.categories?.length
              ? Array.from(new Set(result.draft.categories.map((entry) => entry.trim()).filter(Boolean)))
              : undefined,
          },
        };
      }

      if (result.kind === 'error' && !firstError) {
        firstError = result.message;
      }
    }
  }

  if (firstError) {
    return { kind: 'error', barcode: normalizedInput, message: firstError };
  }

  return { kind: 'not-found', barcode: normalizedInput };
}
