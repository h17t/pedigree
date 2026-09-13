import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import { de } from '@/i18n/de';
import { translate, detectLocale, formatBytes } from '@/i18n';

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
  it('de and en have exactly the same keys', () => {
    expect(keysOf(de)).toEqual(keysOf(en));
  });

  it('every leaf uses the same placeholders in both languages', () => {
    const enLeaves = new Map(leaves(en));
    for (const [key, value] of leaves(de)) {
      expect(placeholders(value), key).toEqual(placeholders(enLeaves.get(key) ?? ''));
    }
  });

  it('no leaf is empty except the exact-date qualifier', () => {
    for (const dict of [en, de]) {
      for (const [key, value] of leaves(dict)) {
        if (key.endsWith('qualifier.exact')) continue;
        expect(value.trim().length, key).toBeGreaterThan(0);
      }
    }
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
    expect(detectLocale('fr-FR')).toBe('en');
    expect(detectLocale(undefined)).toBe('en');
  });
  it('formats bytes', () => {
    expect(formatBytes('en', 512)).toBe('512 B');
    expect(formatBytes('en', 4 * 1024 * 1024 + 200 * 1024)).toBe('4.2 MB');
    expect(formatBytes('de', 4 * 1024 * 1024 + 200 * 1024)).toBe('4,2 MB');
  });
});
