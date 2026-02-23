import { getLocales } from 'expo-localization';
import { createContext, useContext, useMemo } from 'react';

import { useInventory } from '@/providers/inventory-provider';
import type { UiLocale } from '@/providers/inventory-types';
import { DEFAULT_UI_LOCALE, getTranslation, type TranslationKey } from '@/libs/i18n/translations';

type TranslateParams = Record<string, string | number>;

type UiLocaleContextValue = {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
  t: (key: TranslationKey, params?: TranslateParams) => string;
};

const UiLocaleContext = createContext<UiLocaleContextValue | undefined>(undefined);

function resolveInitialLocale(): UiLocale {
  const locale = getLocales()[0]?.languageTag;
  if (locale === 'uk-UA') {
    return locale;
  }
  return DEFAULT_UI_LOCALE;
}

function applyParams(value: string, params?: TranslateParams): string {
  if (!params) {
    return value;
  }

  return Object.entries(params).reduce(
    (acc, [key, val]) => acc.replaceAll(`{${key}}`, String(val)),
    value,
  );
}

export function UiLocaleProvider({ children }: { children: React.ReactNode }) {
  const { uiLocale, setUiLocale } = useInventory();
  const locale = uiLocale ?? resolveInitialLocale();

  const value = useMemo<UiLocaleContextValue>(() => ({
    locale,
    setLocale: setUiLocale,
    t: (key, params) => applyParams(getTranslation(locale, key), params),
  }), [locale, setUiLocale]);

  return <UiLocaleContext.Provider value={value}>{children}</UiLocaleContext.Provider>;
}

export function useUiLocale() {
  const context = useContext(UiLocaleContext);
  if (!context) {
    throw new Error('useUiLocale must be used within UiLocaleProvider');
  }
  return context;
}
