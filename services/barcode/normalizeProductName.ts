const NOISE_PUNCTUATION = /[.,/#!$^*;:{}=_`~()\[\]"'’“”+-]/g;
const VOLUME_TOKEN = /\b\d+(?:[.,]\d+)?\s*(?:ml|cl|l|litre|liter|litres|liters)\b/g;
const PERCENT_TOKEN = /\b\d+(?:[.,]\d+)?\s*%\s*(?:abv)?\b|\babv\b/g;

export function normalizeProductName(value?: string | null): string {
  if (!value) {
    return '';
  }

  return value
    .toLowerCase()
    .replace(VOLUME_TOKEN, ' ')
    .replace(PERCENT_TOKEN, ' ')
    .replace(NOISE_PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
