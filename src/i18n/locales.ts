/**
 * The languages the app ships. A language is listed here only when its dictionary is complete
 * (the parity test compares every dictionary with `en`); the Data page builds its language
 * list from this table. `tag` is the BCP 47 tag used for Intl formatting, `name` the
 * language's own name, `surnameFirst` the default display order of personal names.
 */
export const LANGUAGES = [
  { code: 'en', tag: 'en-GB', name: 'English', surnameFirst: false },
  { code: 'de', tag: 'de-DE', name: 'Deutsch', surnameFirst: false },
  { code: 'fr', tag: 'fr-FR', name: 'Français', surnameFirst: false },
  { code: 'es', tag: 'es-ES', name: 'Español', surnameFirst: false },
  { code: 'it', tag: 'it-IT', name: 'Italiano', surnameFirst: false },
  { code: 'pt', tag: 'pt-BR', name: 'Português', surnameFirst: false },
  { code: 'nl', tag: 'nl-NL', name: 'Nederlands', surnameFirst: false },
  { code: 'pl', tag: 'pl-PL', name: 'Polski', surnameFirst: false },
  { code: 'ru', tag: 'ru-RU', name: 'Русский', surnameFirst: false },
  { code: 'tr', tag: 'tr-TR', name: 'Türkçe', surnameFirst: false },
] as const;

export type Locale = (typeof LANGUAGES)[number]['code'];
export const LOCALES: readonly Locale[] = LANGUAGES.map((l) => l.code);

export const intlTag: Record<Locale, string> = Object.fromEntries(LANGUAGES.map((l) => [l.code, l.tag])) as Record<Locale, string>;
export const languageName: Record<Locale, string> = Object.fromEntries(LANGUAGES.map((l) => [l.code, l.name])) as Record<Locale, string>;
export const surnameFirstDefault: Record<Locale, boolean> = Object.fromEntries(LANGUAGES.map((l) => [l.code, l.surnameFirst])) as Record<Locale, boolean>;

export function isLocale(x: unknown): x is Locale {
  return typeof x === 'string' && (LOCALES as readonly string[]).includes(x);
}
