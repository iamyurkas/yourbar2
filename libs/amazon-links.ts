import { AMAZON_STORES, type AmazonStoreKey } from '@/libs/amazon-stores';

export function buildAmazonIngredientUrl(store: AmazonStoreKey, ingredientName: string): string {
  const amazonStore = AMAZON_STORES[store];
  const query = encodeURIComponent(ingredientName.trim());
  const tag = amazonStore.affiliateTag.trim();

  if (tag.length > 0) {
    return `https://${amazonStore.domain}/s?k=${query}&tag=${encodeURIComponent(tag)}`;
  }

  return `https://${amazonStore.domain}/s?k=${query}`;
}
