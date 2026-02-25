export type SupportedLocale = 'en-GB' | 'en-US' | 'es-ES' | 'uk-UA';

export type TranslationDictionary = Record<string, string>;

export type LanguageOption = {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  flag: string;
};
