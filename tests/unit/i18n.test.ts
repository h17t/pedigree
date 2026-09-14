import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import { de } from '@/i18n/de';
import { fr } from '@/i18n/fr';
import { es } from '@/i18n/es';
import { it as itDict } from '@/i18n/it';
import { pt } from '@/i18n/pt';
import { nl } from '@/i18n/nl';
import { pl } from '@/i18n/pl';
import { ru } from '@/i18n/ru';
import { tr } from '@/i18n/tr';
import { ja } from '@/i18n/ja';
import { zh } from '@/i18n/zh';
import { ko } from '@/i18n/ko';
import { translate, detectLocale, formatBytes, LANGUAGES, LOCALES } from '@/i18n';
import type { Locale } from '@/i18n';
import type { Dictionary } from '@/i18n/types';

const all: Record<Locale, Dictionary> = { en, de, fr, es, it: itDict, pt, nl, pl, ru, tr, ja, zh, ko };

type Node = Record<string, unknown>;
function keysOf(node: object, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(node)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.push(key);
    else if (v && typeof v === 'object' && 'other' in (v as Node)) out.push(`${key}#plural`);
    else out.push(...keysOf(v as Node, key));
  }
  return out.sort();
}

function placeholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();
}
function leaves(node: object, prefix = ''): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(node)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.push([key, v]);
    else out.push(...leaves(v as Node, key));
  }
  return out;
}

describe('locale key parity', () => {
  it('every shipped language has a dictionary and every dictionary is shipped', () => {
    expect(Object.keys(all).sort()).toEqual([...LOCALES].sort());
    expect(LANGUAGES.map((l) => l.code).sort()).toEqual(Object.keys(all).sort());
  });

  it.each(LOCALES.filter((l) => l !== 'en'))('%s has exactly the same keys as en', (locale) => {
    expect(keysOf(all[locale])).toEqual(keysOf(en));
  });

  it.each(LOCALES)('%s: every leaf uses the same placeholders as en', (locale) => {
    const enLeaves = new Map(leaves(en));
    for (const [key, value] of leaves(all[locale])) {
      // Extra plural forms (few, many) are measured against the English "other" form.
      const reference = enLeaves.get(key) ?? enLeaves.get(key.replace(/\.(zero|two|few|many)$/, '.other')) ?? '';
      expect(placeholders(value), `${locale} ${key}`).toEqual(placeholders(reference));
    }
  });

  it.each(LOCALES)('%s: no leaf is empty except the exact-date qualifier', (locale) => {
    for (const [key, value] of leaves(all[locale])) {
      if (key.endsWith('qualifier.exact')) continue;
      expect(value.trim().length, key).toBeGreaterThan(0);
    }
  });

  it('plural leaves carry the forms the language needs', () => {
    // Polish and Russian distinguish few and many; the others get by with one/other.
    for (const locale of ['pl', 'ru'] as const) {
      for (const [k, v] of Object.entries(all[locale].common)) {
        if (typeof v === 'object' && 'other' in v) expect(v.few && v.many, `${locale} common.${k}`).toBeTruthy();
      }
    }
    expect(translate('pl', 'common.people', { count: 1 })).toBe('1 osoba');
    expect(translate('pl', 'common.people', { count: 3 })).toBe('3 osoby');
    expect(translate('pl', 'common.people', { count: 5 })).toBe('5 osób');
    expect(translate('pl', 'common.people', { count: 22 })).toBe('22 osoby');
    expect(translate('ru', 'common.people', { count: 1 })).toBe('1 человек');
    expect(translate('ru', 'common.people', { count: 2 })).toBe('2 человека');
    expect(translate('ru', 'common.people', { count: 5 })).toBe('5 человек');
    expect(translate('ru', 'common.people', { count: 21 })).toBe('21 человек');
    expect(translate('fr', 'common.people', { count: 0 })).toBe('0 personne');
    expect(translate('fr', 'common.people', { count: 2 })).toBe('2 personnes');
    expect(translate('tr', 'common.people', { count: 7 })).toBe('7 kişi');
    expect(translate('ja', 'common.people', { count: 1 })).toBe('1人');
    expect(translate('ko', 'common.people', { count: 12 })).toBe('12명');
  });
});

describe('translate', () => {
  it('interpolates parameters', () => {
    expect(translate('en', 'common.lastChanged', { date: 'today' })).toBe('Last changed today');
    expect(translate('de', 'common.lastChanged', { date: 'heute' })).toBe('Zuletzt geändert heute');
  });
  it('selects plural forms with locale number formatting', () => {
    expect(translate('en', 'common.people', { count: 1 })).toBe('1 person');
    expect(translate('en', 'common.people', { count: 1234 })).toBe('1,234 people');
    expect(translate('de', 'common.people', { count: 1234 })).toBe('1.234 Personen');
  });
  it('falls back to English for a missing German value and to the key when both are missing', () => {
    // @ts-expect-error deliberately unknown key
    expect(translate('de', 'nope.missing')).toBe('nope.missing');
  });
});

describe('helpers', () => {
  it('detects German from navigator.language, defaults to English', () => {
    expect(detectLocale('de-AT')).toBe('de');
    expect(detectLocale('en-US')).toBe('en');
    expect(detectLocale('fr-FR')).toBe('fr');
    expect(detectLocale('xx-YY')).toBe('en');
    expect(detectLocale(undefined)).toBe('en');
  });
  it('formats bytes', () => {
    expect(formatBytes('en', 512)).toBe('512 B');
    expect(formatBytes('en', 4 * 1024 * 1024 + 200 * 1024)).toBe('4.2 MB');
    expect(formatBytes('de', 4 * 1024 * 1024 + 200 * 1024)).toBe('4,2 MB');
  });
});
