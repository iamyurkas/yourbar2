import { EN_GB } from '@/libs/i18n/en-gb';
import { UK_UA } from '@/libs/i18n/uk-ua';
import type { TranslationKey } from '@/libs/i18n/types';
import type { UiLocale } from '@/providers/inventory-types';

export type { TranslationKey };

export const DEFAULT_UI_LOCALE: UiLocale = 'en-GB';

export const SUPPORTED_UI_LOCALES: { key: UiLocale; labelKey: TranslationKey; flag: string }[] = [
  { key: 'en-GB', labelKey: 'sideMenu.language.enGB', flag: '🇬🇧' },
  { key: 'uk-UA', labelKey: 'sideMenu.language.ukUA', flag: '🇺🇦' },
];

const dictionaries: Record<UiLocale, Partial<Record<TranslationKey, string>>> = {
  'en-GB': EN_GB,
  'uk-UA': UK_UA,
};

export function getTranslation(locale: UiLocale, key: TranslationKey): string {
  return dictionaries[locale][key] ?? EN_GB[key];
}
