import type { ScannedProductDraft } from '@/services/barcode/types';

type OpenFoodFactsProductResponse = {
  status?: number;
  product?: {
    product_name?: string;
    image_url?: string;
    image_front_url?: string;
    generic_name?: string;
    quantity?: string;
    alcohol_value?: number | string;
    nutriments?: {
      alcohol?: number | string;
      alcohol_100g?: number | string;
      alcohol_100ml?: number | string;
    };
  };
};

export type OpenFoodFactsLookupResult =
  | { kind: 'found'; draft: ScannedProductDraft }
  | { kind: 'not-found'; barcode: string }
  | { kind: 'error'; barcode: string; message: string };

function toOptionalString(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function toOptionalNumber(value?: string | number | null): number | null {
  if (value == null || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number.parseFloat(value.replace(',', '.'));
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export async function fetchProductByBarcode(barcode: string): Promise<OpenFoodFactsLookupResult> {
  const normalizedBarcode = barcode.trim();
  if (!normalizedBarcode) {
    return { kind: 'error', barcode, message: 'Invalid barcode' };
  }

  const fields = ['product_name', 'image_url', 'image_front_url', 'generic_name', 'alcohol_value', 'nutriments'];
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(normalizedBarcode)}?fields=${fields.join(',')}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'YourBar/1.0 (https://github.com)'
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { kind: 'not-found', barcode: normalizedBarcode };
      }
      return { kind: 'error', barcode: normalizedBarcode, message: `Open Food Facts returned ${response.status}` };
    }

    const payload = (await response.json()) as OpenFoodFactsProductResponse;
    if (payload.status === 0 || !payload.product) {
      return { kind: 'not-found', barcode: normalizedBarcode };
    }

    const product = payload.product;
    const name = toOptionalString(product.product_name);
    const imageUrl = toOptionalString(product.image_front_url ?? product.image_url);
    const description = toOptionalString(product.generic_name);
    const abv =
      toOptionalNumber(product.alcohol_value)
      ?? toOptionalNumber(product.nutriments?.alcohol)
      ?? toOptionalNumber(product.nutriments?.alcohol_100ml)
      ?? toOptionalNumber(product.nutriments?.alcohol_100g);

    return {
      kind: 'found',
      draft: {
        barcode: normalizedBarcode,
        name,
        imageUrl,
        description,
        abv,
        source: 'open-food-facts',
      },
    };
  } catch (error) {
    return {
      kind: 'error',
      barcode: normalizedBarcode,
      message: error instanceof Error ? error.message : 'Network error',
    };
  }
}
