import { enGBTranslations } from '@/libs/i18n/locales/en-GB';
import { enUSTranslations } from '@/libs/i18n/locales/en-US';
import { ukUATranslations } from '@/libs/i18n/locales/uk-UA';
import { esESTranslations } from '@/libs/i18n/locales/es-ES';
import type { LanguageOption, SupportedLocale, TranslationDictionary } from '@/libs/i18n/types';

export const DEFAULT_LOCALE: SupportedLocale = 'en-GB';

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en-GB', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'en-US', name: 'English (US)', nativeName: 'English (US)', flag: '🇺🇸' },
  { code: 'uk-UA', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
  { code: 'es-ES', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
];

export const TRANSLATIONS: Record<SupportedLocale, TranslationDictionary> = {
  'en-GB': enGBTranslations,
  'en-US': enUSTranslations,
  'uk-UA': ukUATranslations,
  'es-ES': esESTranslations,
};

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return value === 'en-GB' || value === 'en-US' || value === 'uk-UA' || value === 'es-ES';
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
