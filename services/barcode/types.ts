export type ScannedProductDraft = {
  barcode: string;
  name?: string;
  imageUrl?: string;
  description?: string;
  abv?: number | null;
  source: 'open-food-facts';
};
