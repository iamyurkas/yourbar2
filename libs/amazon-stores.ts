import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type AmazonStoreOverride = AmazonStoreKey | 'DISABLED';
type AmazonStoreConfig = {
  domain: string;
  label: string;
  countryName: string;
  affiliateTag: string;
};

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

export const AMAZON_STORES: Record<AmazonStoreKey, AmazonStoreConfig> = {
  US: { domain: 'amazon.com', label: 'Amazon.com', countryName: 'United States', affiliateTag: '' },
  UK: { domain: 'amazon.co.uk', label: 'Amazon.co.uk', countryName: 'United Kingdom', affiliateTag: 'yourbarfree04-21' },
  DE: { domain: 'amazon.de', label: 'Amazon.de', countryName: 'Germany', affiliateTag: 'yourbarfree05-21' },
  FR: { domain: 'amazon.fr', label: 'Amazon.fr', countryName: 'France', affiliateTag: 'yourbarfree0b-21' },
  IT: { domain: 'amazon.it', label: 'Amazon.it', countryName: 'Italy', affiliateTag: 'yourbarfree02-21' },
  ES: { domain: 'amazon.es', label: 'Amazon.es', countryName: 'Spain', affiliateTag: 'yourbarfree0c-21' },
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

const STOREFRONT_COUNTRY_TO_AMAZON_STORE: Record<string, AmazonStoreKey> = {
  US: 'US',
  GB: 'UK',
  DE: 'DE',
  DK: 'DE',
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

const LOCALE_COUNTRY_TO_AMAZON_STORE: Record<string, AmazonStoreKey> = {
  US: 'US',
  GB: 'UK',
  DE: 'DE',
  DK: 'DE',
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

function normalizeCountryCode(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length === 2 ? normalized : null;
}

function getStorefrontCountryCode(): string | null {
  const runtimeExtra = (Constants.expoConfig?.extra ?? null) as
    | {
        iosAppStoreCountryCode?: unknown;
        androidPlayStoreCountryCode?: unknown;
      }
    | null;

  if (Platform.OS === 'ios') {
    return normalizeCountryCode(runtimeExtra?.iosAppStoreCountryCode);
  }

  if (Platform.OS === 'android') {
    return normalizeCountryCode(runtimeExtra?.androidPlayStoreCountryCode);
  }

  return null;
}

function mapCountryToAmazonStore(
  countryCode: string | null,
  countryToStoreMap: Record<string, AmazonStoreKey>,
): AmazonStoreKey | null {
  if (!countryCode || !(countryCode in countryToStoreMap)) {
    return null;
  }

  return countryToStoreMap[countryCode];
}

export function detectAmazonStoreFromLocale(): AmazonStoreKey | null {
  return mapCountryToAmazonStore(getLocaleCountryCode(), LOCALE_COUNTRY_TO_AMAZON_STORE);
}

export function detectAmazonStoreFromStoreOrLocale(): AmazonStoreKey | null {
  const storefrontStore = mapCountryToAmazonStore(getStorefrontCountryCode(), STOREFRONT_COUNTRY_TO_AMAZON_STORE);
  if (storefrontStore) {
    return storefrontStore;
  }

  return detectAmazonStoreFromLocale();
}

export function detectUsStorefrontOrLocale(): boolean {
  const storefrontCountryCode = getStorefrontCountryCode();
  if (storefrontCountryCode) {
    return storefrontCountryCode === 'US';
  }

  return getLocaleCountryCode() === 'US';
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

  return detectedAmazonStore ?? 'US';
}

export const AMAZON_STORE_KEYS = Object.keys(AMAZON_STORES) as AmazonStoreKey[];
