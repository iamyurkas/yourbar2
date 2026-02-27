import { useMemo } from 'react';

import { LANGUAGE_OPTIONS, translate } from '@/libs/i18n';
import type { SupportedLocale } from '@/libs/i18n/types';
import { useInventory } from '@/providers/inventory-provider';

export function useI18n() {
  const { appLocale, setAppLocale } = useInventory();

  const currentLanguage = useMemo(
    () => LANGUAGE_OPTIONS.find((option) => option.code === appLocale) ?? LANGUAGE_OPTIONS[0],
    [appLocale],
  );

  const t = (key: string, params?: Record<string, string | number>) =>
    translate(appLocale as SupportedLocale, key, params);

  return {
    locale: appLocale,
    setLocale: setAppLocale,
    t,
    languageOptions: LANGUAGE_OPTIONS,
    currentLanguage,
  };
}
