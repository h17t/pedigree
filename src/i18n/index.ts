/**
 * Hand-rolled typed i18n. `t(key, params)` looks up a dotted key in the active dictionary,
 * chooses a plural form via Intl.PluralRules when the leaf is a plural object and `count`
 * is given, and substitutes `{name}` placeholders.
 *
 * The active locale lives in a tiny Zustand store so that React components re-render on a
 * switch and non-React code (reports, warnings) can read it synchronously.
 */
import { create } from 'zustand';
import { en } from './en';
import type { Dictionary, Locale, TKey, TParams } from './types';
import type { PluralForms } from './en';
import { LOCALES, intlTag, isLocale } from './locales';
import { useNameOrder } from '@/model/nameOrder';

export type { Locale, DateFormat, TKey, TParams } from './types';
export { LANGUAGES, LOCALES, intlTag, languageName, surnameFirstDefault, isLocale } from './locales';

/**
 * English is bundled (it is the fallback); every other dictionary is its own chunk, loaded
 * when the language is chosen, so the initial payload does not carry twelve translations.
 */
const loaders: Record<Locale, () => Promise<Dictionary>> = {
  en: () => Promise.resolve(en),
  de: () => import('./de').then((m) => m.de),
  fr: () => import('./fr').then((m) => m.fr),
  es: () => import('./es').then((m) => m.es),
  it: () => import('./it').then((m) => m.it),
  pt: () => import('./pt').then((m) => m.pt),
  nl: () => import('./nl').then((m) => m.nl),
  pl: () => import('./pl').then((m) => m.pl),
  ru: () => import('./ru').then((m) => m.ru),
  tr: () => import('./tr').then((m) => m.tr),
};
const loaded: Partial<Record<Locale, Dictionary>> = { en };

export async function loadLocale(locale: Locale): Promise<Dictionary> {
  const have = loaded[locale];
  if (have) return have;
  const dict = await loaders[locale]();
  loaded[locale] = dict;
  return dict;
}

/** For tests and tools: every dictionary at once. */
export async function loadAllLocales(): Promise<Record<Locale, Dictionary>> {
  for (const l of LOCALES) await loadLocale(l);
  return loaded as Record<Locale, Dictionary>;
}

export function isLocaleLoaded(locale: Locale): boolean {
  return loaded[locale] !== undefined;
}

/** The best available language for a browser language tag, English when none fits. */
export function detectLocale(navigatorLanguage: string | undefined): Locale {
  const base = navigatorLanguage?.toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : 'en';
}

interface LocaleState {
  locale: Locale;
  /** Switches once the dictionary is loaded; resolves when the switch is done. */
  setLocale: (l: Locale) => Promise<void>;
}
export const useLocaleStore = create<LocaleState>((set) => ({
  locale: 'en',
  setLocale: async (locale) => {
    await loadLocale(locale);
    set({ locale });
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
  },
}));

const pluralRules: Partial<Record<Locale, Intl.PluralRules>> = {};
type Category = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
function pluralCategory(locale: Locale, n: number): Category {
  const rules = (pluralRules[locale] ??= new Intl.PluralRules(intlTag[locale]));
  return rules.select(n);
}

function lookup(dict: Dictionary, key: string): string | PluralForms | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' || (typeof node === 'object' && node !== null && 'other' in node)
    ? (node as string | PluralForms)
    : undefined;
}

function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = params[name];
    return v === undefined ? m : String(v);
  });
}

/** Translate with an explicit locale (for non-React code such as reports). */
export function translate(locale: Locale, key: TKey, params?: TParams): string {
  const leaf = lookup(loaded[locale] ?? en, key) ?? lookup(en, key);
  if (leaf === undefined) {
    if (import.meta.env.DEV) console.warn(`Missing i18n key: ${key}`);
    return key;
  }
  if (typeof leaf === 'string') return interpolate(leaf, params);
  const count = typeof params?.count === 'number' ? params.count : Number(params?.count ?? 0);
  const form = leaf[pluralCategory(locale, count)] ?? leaf.other;
  return interpolate(form, { ...params, count: formatNumber(locale, count) });
}

/** Translate in the currently active locale. */
export function t(key: TKey, params?: TParams): string {
  return translate(useLocaleStore.getState().locale, key, params);
}

/** React hook: returns a `t` bound to the active locale and re-renders on change. */
export function useT(): { t: (key: TKey, params?: TParams) => string; locale: Locale } {
  const locale = useLocaleStore((s) => s.locale);
  // Name order is part of how text reads; components re-render when it changes.
  useNameOrder((s) => s.surnameFirst);
  return { t: (key, params) => translate(locale, key, params), locale };
}

export function formatNumber(locale: Locale, n: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlTag[locale], options).format(n);
}

/** Formats a timestamp (ms) as a locale date-time for "last changed" lines. */
export function formatDateTime(locale: Locale, ms: number): string {
  return new Intl.DateTimeFormat(intlTag[locale], { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));
}

/** Bytes as a human-readable size. */
export function formatBytes(locale: Locale, bytes: number): string {
  if (bytes < 1024) return `${formatNumber(locale, bytes)} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(locale, bytes / 1024, { maximumFractionDigits: 0 })} KB`;
  return `${formatNumber(locale, bytes / (1024 * 1024), { maximumFractionDigits: 1 })} MB`;
}
