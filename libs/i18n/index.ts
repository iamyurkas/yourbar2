import { deDETranslations } from '@/libs/i18n/locales/de-DE';
import { enGBTranslations } from '@/libs/i18n/locales/en-GB';
import { enUSTranslations } from '@/libs/i18n/locales/en-US';
import { esESTranslations } from '@/libs/i18n/locales/es-ES';
import { ukUATranslations } from '@/libs/i18n/locales/uk-UA';
import type { LanguageOption, SupportedLocale, TranslationDictionary } from '@/libs/i18n/types';

export const DEFAULT_LOCALE: SupportedLocale = 'en-GB';

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'de-DE', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'en-GB', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'en-US', name: 'English (US)', nativeName: 'English (US)', flag: '🇺🇸' },
  { code: 'es-ES', name: 'Spanish', nativeName: 'Español (España)', flag: '🇪🇸' },
  { code: 'uk-UA', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
];

export const TRANSLATIONS: Record<SupportedLocale, TranslationDictionary> = {
  'de-DE': deDETranslations,
  'en-GB': enGBTranslations,
  'en-US': enUSTranslations,
  'es-ES': esESTranslations,
  'uk-UA': ukUATranslations,
};

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return value === 'de-DE' || value === 'en-GB' || value === 'en-US' || value === 'es-ES' || value === 'uk-UA';
}

export function translate(
  locale: SupportedLocale,
  key: string,
  params?: Record<string, string | number>,
): string {
  const primary = TRANSLATIONS[locale][key];
  const fallback = TRANSLATIONS[DEFAULT_LOCALE][key];
  const template = primary ?? fallback ?? key;

  if (!params) {
    return template;
  }

  return Object.entries(params).reduce((result, [name, value]) => {
    return result.replaceAll(`{{${name}}}`, String(value));
  }, template);
}
