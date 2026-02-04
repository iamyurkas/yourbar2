import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import commonEn from '@/assets/locales/en/common.json';
import commonEs from '@/assets/locales/es/common.json';
import commonUa from '@/assets/locales/ua/common.json';

const resources = {
  en: {
    common: commonEn,
  },
  es: {
    common: commonEs,
  },
  ua: {
    common: commonUa,
  },
};

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    ns: ['common'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
