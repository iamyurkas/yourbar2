import { NativeModules, Platform } from 'react-native';

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
  { domain: string; label: string; countryName: string; affiliateTag: string }
> = {
  US: { domain: 'amazon.com', label: 'Amazon.com', countryName: 'United States', affiliateTag: '' },
  UK: { domain: 'amazon.co.uk', label: 'Amazon.co.uk', countryName: 'United Kingdom', affiliateTag: '' },
  DE: { domain: 'amazon.de', label: 'Amazon.de', countryName: 'Germany', affiliateTag: '' },
  FR: { domain: 'amazon.fr', label: 'Amazon.fr', countryName: 'France', affiliateTag: '' },
  IT: { domain: 'amazon.it', label: 'Amazon.it', countryName: 'Italy', affiliateTag: '' },
  ES: { domain: 'amazon.es', label: 'Amazon.es', countryName: 'Spain', affiliateTag: '' },
  NL: { domain: 'amazon.nl', label: 'Amazon.nl', countryName: 'Netherlands', affiliateTag: '' },
  SE: { domain: 'amazon.se', label: 'Amazon.se', countryName: 'Sweden', affiliateTag: '' },
  PL: { domain: 'amazon.pl', label: 'Amazon.pl', countryName: 'Poland', affiliateTag: '' },
  BE: { domain: 'amazon.com.be', label: 'Amazon.com.be', countryName: 'Belgium', affiliateTag: '' },
  TR: { domain: 'amazon.com.tr', label: 'Amazon.com.tr', countryName: 'Turkey', affiliateTag: '' },
  AE: { domain: 'amazon.ae', label: 'Amazon.ae', countryName: 'United Arab Emirates', affiliateTag: '' },
  SA: { domain: 'amazon.sa', label: 'Amazon.sa', countryName: 'Saudi Arabia', affiliateTag: '' },
  IN: { domain: 'amazon.in', label: 'Amazon.in', countryName: 'India', affiliateTag: '' },
  JP: { domain: 'amazon.co.jp', label: 'Amazon.co.jp', countryName: 'Japan', affiliateTag: '' },
  CA: { domain: 'amazon.ca', label: 'Amazon.ca', countryName: 'Canada', affiliateTag: '' },
  AU: { domain: 'amazon.com.au', label: 'Amazon.com.au', countryName: 'Australia', affiliateTag: '' },
  BR: { domain: 'amazon.com.br', label: 'Amazon.com.br', countryName: 'Brazil', affiliateTag: '' },
  MX: { domain: 'amazon.com.mx', label: 'Amazon.com.mx', countryName: 'Mexico', affiliateTag: '' },
  SG: { domain: 'amazon.sg', label: 'Amazon.sg', countryName: 'Singapore', affiliateTag: '' },
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

function mapCountryCodeToAmazonStore(countryCode: string | null | undefined): AmazonStoreKey | null {
  if (!countryCode) {
    return null;
  }

  const normalized = countryCode.trim().toUpperCase();
  if (normalized.length !== 2 || !(normalized in COUNTRY_TO_AMAZON_STORE)) {
    return null;
  }

  return COUNTRY_TO_AMAZON_STORE[normalized];
}

type NativeStoreRegionModule = {
  getStoreCountryCode?: () => Promise<string | null>;
};

async function detectStoreCountryFromNativeModule(): Promise<string | null> {
  const nativeModuleName = Platform.OS === 'ios' ? 'AppStoreRegion' : 'PlayStoreRegion';
  const module = NativeModules[nativeModuleName] as NativeStoreRegionModule | undefined;

  if (!module?.getStoreCountryCode) {
    return null;
  }

  try {
    const result = await module.getStoreCountryCode();
    return typeof result === 'string' ? result : null;
  } catch {
    return null;
  }
}

export async function detectAmazonStoreFromPlatformStore(): Promise<AmazonStoreKey | null> {
  const storeCountry = await detectStoreCountryFromNativeModule();
  const detectedFromStore = mapCountryCodeToAmazonStore(storeCountry);

  if (detectedFromStore) {
    return detectedFromStore;
  }

  return detectAmazonStoreFromLocale();
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
