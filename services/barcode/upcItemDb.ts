import type { BarcodeLookupResult } from '@/services/barcode/types';

type UpcItemDbResponse = {
  code?: string;
  message?: string;
  items?: Array<{
    title?: string;
    description?: string;
    brand?: string;
    category?: string;
    images?: string[];
  }>;
};

function toOptionalString(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export async function fetchProductByBarcodeFromUpcItemDb(barcode: string): Promise<BarcodeLookupResult> {
  const normalizedBarcode = barcode.trim();
  if (!normalizedBarcode) {
    return { kind: 'error', barcode, message: 'Invalid barcode' };
  }

  const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(normalizedBarcode)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { kind: 'not-found', barcode: normalizedBarcode };
      }
      return { kind: 'error', barcode: normalizedBarcode, message: `UPCitemdb returned ${response.status}` };
    }

    const payload = (await response.json()) as UpcItemDbResponse;
    const item = payload.items?.[0];

    if (!item) {
      return { kind: 'not-found', barcode: normalizedBarcode };
    }

    const name = toOptionalString(item.title);
    const description = toOptionalString(item.description);
    const category = toOptionalString(item.category);
    const brand = toOptionalString(item.brand);

    return {
      kind: 'found',
      draft: {
        barcode: normalizedBarcode,
        name,
        imageUrl: toOptionalString(item.images?.[0]),
        description,
        categories: [category, brand].filter((entry): entry is string => Boolean(entry)),
        source: 'upcitemdb',
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
