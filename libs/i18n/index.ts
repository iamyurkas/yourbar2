import { enGBTranslations } from '@/libs/i18n/locales/en-GB';
import { ukUATranslations } from '@/libs/i18n/locales/uk-UA';
import type { LanguageOption, SupportedLocale, TranslationDictionary } from '@/libs/i18n/types';

export const DEFAULT_LOCALE: SupportedLocale = 'en-GB';

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en-GB', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'uk-UA', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
];

export const TRANSLATIONS: Record<SupportedLocale, TranslationDictionary> = {
  'en-GB': enGBTranslations,
  'uk-UA': ukUATranslations,
};

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return value === 'en-GB' || value === 'uk-UA';
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
