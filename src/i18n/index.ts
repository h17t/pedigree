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
import { de } from './de';
import type { Dictionary, Locale, TKey, TParams } from './types';
import type { PluralForms } from './en';

export type { Locale, DateFormat, TKey, TParams } from './types';

export const dictionaries: Record<Locale, Dictionary> = { en, de };

/** BCP 47 tags used for Intl formatting. English means en-GB, day first. */
export const intlTag: Record<Locale, string> = { en: 'en-GB', de: 'de-DE' };

export function detectLocale(navigatorLanguage: string | undefined): Locale {
  return navigatorLanguage?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

interface LocaleState {
  locale: Locale;
  setLocale: (l: Locale) => void;
}
export const useLocaleStore = create<LocaleState>((set) => ({
  locale: 'en',
  setLocale: (locale) => {
    set({ locale });
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
  },
}));

const pluralRules: Partial<Record<Locale, Intl.PluralRules>> = {};
function pluralCategory(locale: Locale, n: number): 'zero' | 'one' | 'other' {
  const rules = (pluralRules[locale] ??= new Intl.PluralRules(intlTag[locale]));
  const cat = rules.select(n);
  return cat === 'one' ? 'one' : cat === 'zero' ? 'zero' : 'other';
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
  const leaf = lookup(dictionaries[locale], key) ?? lookup(dictionaries.en, key);
  if (leaf === undefined) {
    if (import.meta.env.DEV) console.warn(`Missing i18n key: ${key}`);
    return key;
  }
  if (typeof leaf === 'string') return interpolate(leaf, params);
  const count = typeof params?.count === 'number' ? params.count : Number(params?.count ?? 0);
  const cat = pluralCategory(locale, count);
  const form = (cat === 'zero' && leaf.zero) || (cat === 'one' ? leaf.one : leaf.other);
  return interpolate(form, { ...params, count: formatNumber(locale, count) });
}

/** Translate in the currently active locale. */
export function t(key: TKey, params?: TParams): string {
  return translate(useLocaleStore.getState().locale, key, params);
}

/** React hook: returns a `t` bound to the active locale and re-renders on change. */
export function useT(): { t: (key: TKey, params?: TParams) => string; locale: Locale } {
  const locale = useLocaleStore((s) => s.locale);
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
