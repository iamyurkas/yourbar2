export type SupportedLocale = 'en-GB' | 'en-US' | 'uk-UA' | 'es-ES';

export type TranslationDictionary = Record<string, string>;

export type LanguageOption = {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  flag: string;
};
