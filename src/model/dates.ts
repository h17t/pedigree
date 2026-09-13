/**
 * Partial dates and their parsing/formatting.
 *
 * Internal form: 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD' | null plus a qualifier
 * (exact | about | before | after | estimated).
 *
 * The parser accepts both German and English keyword sets and both numeric conventions.
 * The `DateFormat` setting only breaks ties for numeric dates where day and month could be
 * swapped; every result carries a plain-language interpretation and, when ambiguous, the
 * alternative reading so the UI can offer it in one click.
 */
import type { DateQualifier, PartialDate } from './types';
import type { DateFormat, Locale } from '@/i18n/types';
import { intlTag } from '@/i18n';

export interface ParsedDate {
  date: PartialDate;
  qualifier: DateQualifier;
}

export interface DateParseResult {
  ok: true;
  value: ParsedDate;
  /** The other reading when day and month could be swapped, else null. */
  alternative: ParsedDate | null;
}
export interface DateParseError {
  ok: false;
}

const QUALIFIER_WORDS: Record<string, DateQualifier> = {
  // English
  about: 'about', abt: 'about', approx: 'about', approximately: 'about', circa: 'about', ca: 'about', c: 'about',
  before: 'before', bef: 'before',
  after: 'after', aft: 'after',
  estimated: 'estimated', est: 'estimated',
  // German
  um: 'about', ungefähr: 'about', ungefaehr: 'about', etwa: 'about', zirka: 'about',
  vor: 'before',
  nach: 'after',
  geschätzt: 'estimated', geschaetzt: 'estimated', gesch: 'estimated',
};

const MONTHS: Record<string, number> = {
  // English
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
  // German
  januar: 1, jän: 1, jänner: 1, februar: 2, märz: 3, maerz: 3, mär: 3, mrz: 3, mai: 5, juni: 6, juli: 7, okt: 10, oktober: 10,
  dez: 12, dezember: 12,
};

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function valid(y: number, m?: number, d?: number): boolean {
  if (y < 1 || y > 9999) return false;
  if (m !== undefined && (m < 1 || m > 12)) return false;
  if (d !== undefined && m !== undefined && (d < 1 || d > daysInMonth(y, m))) return false;
  return true;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function make(y: number, m?: number, d?: number): PartialDate {
  if (m === undefined) return String(y).padStart(4, '0');
  if (d === undefined) return `${String(y).padStart(4, '0')}-${pad(m)}`;
  return `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}`;
}

/** Parse free text typed by the user. */
export function parseUserDate(input: string, format: DateFormat): DateParseResult | DateParseError {
  let s = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (s === '') return { ok: false };
  let qualifier: DateQualifier = 'exact';

  // Symbol prefixes: ~ < >
  const sym = s.match(/^([~<>])\s*(.*)$/);
  if (sym) {
    qualifier = sym[1] === '~' ? 'about' : sym[1] === '<' ? 'before' : 'after';
    s = sym[2]!;
  } else {
    // Keyword prefix
    const kw = s.match(/^([a-zäöü.]+)\s+(.*)$/);
    const word = kw?.[1]?.replace(/\.+$/, '');
    if (kw && word !== undefined && QUALIFIER_WORDS[word] !== undefined) {
      qualifier = QUALIFIER_WORDS[word]!;
      s = kw[2]!;
    }
  }
  s = s.replace(/[.,]+$/, '').trim();
  if (s === '') return { ok: false };

  let m: RegExpMatchArray | null;

  // Year only
  if ((m = s.match(/^(\d{1,4})$/))) {
    const y = Number(m[1]);
    return valid(y) ? { ok: true, value: { date: make(y), qualifier }, alternative: null } : { ok: false };
  }

  // ISO: 1923-03-14 or 1923-03
  if ((m = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/))) {
    const y = Number(m[1]), mo = Number(m[2]), d = m[3] ? Number(m[3]) : undefined;
    return valid(y, mo, d) ? { ok: true, value: { date: make(y, mo, d), qualifier }, alternative: null } : { ok: false };
  }

  // Month name forms: "14 mar 1923", "14. märz 1923", "mar 14 1923", "march 1923", "14 march, 1923"
  if ((m = s.match(/^(?:(\d{1,2})\.?\s+)?([a-zäöü]+)\.?,?\s+(\d{1,2})?,?\s*(\d{4})$/)) || (m = s.match(/^([a-zäöü]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/))) {
    let d: number | undefined, mo: number | undefined, y: number;
    if (m.length === 5) {
      // form A: [day] month [day] year
      const dayA = m[1] ? Number(m[1]) : undefined;
      const dayB = m[3] ? Number(m[3]) : undefined;
      mo = MONTHS[m[2]!];
      d = dayA ?? dayB;
      y = Number(m[4]);
      if (dayA !== undefined && dayB !== undefined) return { ok: false };
    } else {
      mo = MONTHS[m[1]!];
      d = Number(m[2]);
      y = Number(m[3]);
    }
    if (mo === undefined || !valid(y, mo, d)) return { ok: false };
    return { ok: true, value: { date: make(y, mo, d), qualifier }, alternative: null };
  }

  // Numeric with separators: 14.03.1923, 03.1923, 14/03/1923, 03/1923, 14-03-1923
  if ((m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/))) {
    const a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
    const dot = s.includes('.');
    // Dots are the German convention and always day-first; slashes follow the setting.
    const dayFirst = dot || format === 'dayFirst';
    const [d, mo] = dayFirst ? [a, b] : [b, a];
    const [d2, mo2] = dayFirst ? [b, a] : [a, b];
    const primaryOk = valid(y, mo, d);
    const altOk = a !== b && valid(y, mo2, d2);
    if (primaryOk) {
      return { ok: true, value: { date: make(y, mo, d), qualifier }, alternative: altOk ? { date: make(y, mo2, d2), qualifier } : null };
    }
    if (altOk) return { ok: true, value: { date: make(y, mo2, d2), qualifier }, alternative: null };
    return { ok: false };
  }
  if ((m = s.match(/^(\d{1,2})[./-](\d{4})$/))) {
    const mo = Number(m[1]), y = Number(m[2]);
    return valid(y, mo) ? { ok: true, value: { date: make(y, mo), qualifier }, alternative: null } : { ok: false };
  }

  return { ok: false };
}

/** Split a partial date into its numeric parts. */
export function dateParts(date: PartialDate): { y: number; m?: number; d?: number } | null {
  if (!date) return null;
  const m = date.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
  if (!m) return null;
  return { y: Number(m[1]), m: m[2] ? Number(m[2]) : undefined, d: m[3] ? Number(m[3]) : undefined };
}

export function yearOf(date: PartialDate): number | null {
  return dateParts(date)?.y ?? null;
}

/** Convert to a comparable number (days since epoch, approximate for partial dates). */
export function toOrdinal(date: PartialDate, edge: 'start' | 'end' = 'start'): number | null {
  const p = dateParts(date);
  if (!p) return null;
  const m = p.m ?? (edge === 'start' ? 1 : 12);
  const d = p.d ?? (edge === 'start' ? 1 : daysInMonth(p.y, m));
  return Math.round(Date.UTC(p.y, m - 1, d) / 86_400_000);
}

const QUALIFIER_MARK: Record<DateQualifier, string> = { exact: '', about: '~', before: '<', after: '>', estimated: '~' };

/** Short mark used on cards: ~ < > (estimated shares ~, see DECISIONS.md #44). */
export function qualifierMark(q: DateQualifier): string {
  return QUALIFIER_MARK[q];
}

/** Locale date formatting: 14.03.1923 / 14 Mar 1923; März 1923 / Mar 1923; 1923. */
export function formatPartialDate(locale: Locale, date: PartialDate, style: 'short' | 'long' = 'short'): string {
  const p = dateParts(date);
  if (!p) return '';
  const tag = intlTag[locale];
  const utc = new Date(Date.UTC(p.y, (p.m ?? 1) - 1, p.d ?? 1));
  if (p.m === undefined) return String(p.y);
  if (p.d === undefined) {
    return new Intl.DateTimeFormat(tag, { year: 'numeric', month: style === 'long' ? 'long' : 'short', timeZone: 'UTC' }).format(utc);
  }
  if (style === 'long') {
    return new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(utc);
  }
  return locale === 'de'
    ? `${pad(p.d)}.${pad(p.m)}.${p.y}`
    : new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(utc);
}

/** Date with its qualifier mark, e.g. "~1923" or "<14.03.1923". */
export function formatDateWithQualifier(locale: Locale, date: PartialDate, q: DateQualifier, style: 'short' | 'long' = 'short'): string {
  const f = formatPartialDate(locale, date, style);
  return f ? `${qualifierMark(q)}${f}` : '';
}

/** Age in whole years between two partial dates (uses year-level precision where needed). */
export function yearsBetween(from: PartialDate, to: PartialDate): number | null {
  const a = dateParts(from), b = dateParts(to);
  if (!a || !b) return null;
  let years = b.y - a.y;
  if (a.m !== undefined && b.m !== undefined) {
    if (b.m < a.m || (b.m === a.m && a.d !== undefined && b.d !== undefined && b.d < a.d)) years -= 1;
  }
  return years;
}

/** Today as 'YYYY-MM-DD' (UTC). */
export function todayDate(now = new Date()): string {
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
}
