export type AmazonStoreOverride = AmazonStoreKey | 'DISABLED';

export type AmazonStoreKey =
  | 'US'
  | 'UK'
  | 'DE'
  | 'FR'
  | 'IT'
  | 'ES'
  | 'NL'
  | 'SE'
  | 'PL'
  | 'BE'
  | 'TR'
  | 'AE'
  | 'SA'
  | 'IN'
  | 'JP'
  | 'CA'
  | 'AU'
  | 'BR'
  | 'MX'
  | 'SG';

export const AMAZON_STORES: Record<
  AmazonStoreKey,
  { domain: string; label: string; affiliateTag: string }
> = {
  US: { domain: 'amazon.com', label: 'Amazon.com', affiliateTag: '' },
  UK: { domain: 'amazon.co.uk', label: 'Amazon.co.uk', affiliateTag: '' },
  DE: { domain: 'amazon.de', label: 'Amazon.de', affiliateTag: '' },
  FR: { domain: 'amazon.fr', label: 'Amazon.fr', affiliateTag: '' },
  IT: { domain: 'amazon.it', label: 'Amazon.it', affiliateTag: '' },
  ES: { domain: 'amazon.es', label: 'Amazon.es', affiliateTag: '' },
  NL: { domain: 'amazon.nl', label: 'Amazon.nl', affiliateTag: '' },
  SE: { domain: 'amazon.se', label: 'Amazon.se', affiliateTag: '' },
  PL: { domain: 'amazon.pl', label: 'Amazon.pl', affiliateTag: '' },
  BE: { domain: 'amazon.com.be', label: 'Amazon.com.be', affiliateTag: '' },
  TR: { domain: 'amazon.com.tr', label: 'Amazon.com.tr', affiliateTag: '' },
  AE: { domain: 'amazon.ae', label: 'Amazon.ae', affiliateTag: '' },
  SA: { domain: 'amazon.sa', label: 'Amazon.sa', affiliateTag: '' },
  IN: { domain: 'amazon.in', label: 'Amazon.in', affiliateTag: '' },
  JP: { domain: 'amazon.co.jp', label: 'Amazon.co.jp', affiliateTag: '' },
  CA: { domain: 'amazon.ca', label: 'Amazon.ca', affiliateTag: '' },
  AU: { domain: 'amazon.com.au', label: 'Amazon.com.au', affiliateTag: '' },
  BR: { domain: 'amazon.com.br', label: 'Amazon.com.br', affiliateTag: '' },
  MX: { domain: 'amazon.com.mx', label: 'Amazon.com.mx', affiliateTag: '' },
  SG: { domain: 'amazon.sg', label: 'Amazon.sg', affiliateTag: '' },
};

const COUNTRY_TO_AMAZON_STORE: Record<string, AmazonStoreKey> = {
  US: 'US',
  GB: 'UK',
  DE: 'DE',
  FR: 'FR',
  IT: 'IT',
  ES: 'ES',
  NL: 'NL',
  SE: 'SE',
  PL: 'PL',
  BE: 'BE',
  TR: 'TR',
  AE: 'AE',
  SA: 'SA',
  IN: 'IN',
  JP: 'JP',
  CA: 'CA',
  AU: 'AU',
  BR: 'BR',
  MX: 'MX',
  SG: 'SG',
};

function getLocaleCountryCode(): string | null {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  const normalized = typeof locale === 'string' ? locale : '';
  const parts = normalized.split('-');
  const maybeRegion = parts.length > 1 ? parts[parts.length - 1] : '';

  if (!maybeRegion || maybeRegion.length !== 2) {
    return null;
  }

  return maybeRegion.toUpperCase();
}

export function detectAmazonStoreFromLocale(): AmazonStoreKey | null {
  const countryCode = getLocaleCountryCode();

  if (!countryCode || !(countryCode in COUNTRY_TO_AMAZON_STORE)) {
    return null;
  }

  return COUNTRY_TO_AMAZON_STORE[countryCode];
}

export function getEffectiveAmazonStore(
  amazonStoreOverride: AmazonStoreOverride | null,
  detectedAmazonStore: AmazonStoreKey | null,
): AmazonStoreKey | null {
  if (amazonStoreOverride === 'DISABLED') {
    return null;
  }

  if (amazonStoreOverride) {
    return amazonStoreOverride;
  }

  return detectedAmazonStore;
}

export const AMAZON_STORE_KEYS = Object.keys(AMAZON_STORES) as AmazonStoreKey[];
