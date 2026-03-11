export type ScannedProductDraft = {
  barcode: string;
  name?: string;
  imageUrl?: string;
  description?: string;
  abv?: number | null;
  categories?: string[];
  source: 'open-food-facts' | 'upcitemdb';
};

export type BarcodeLookupResult =
  | { kind: 'found'; draft: ScannedProductDraft }
  | { kind: 'not-found'; barcode: string }
  | { kind: 'error'; barcode: string; message: string };
