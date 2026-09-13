/**
 * GEDCOM 5.5.1 date grammar → internal { date, qualifier } plus a verbatim `gedcomDate` when
 * the value cannot be represented exactly (ranges, periods, Julian/dual years, BC, phrases).
 */
import type { DateQualifier, PartialDate } from '@/model/types';

const MONTHS: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export interface GedcomDate {
  date: PartialDate;
  qualifier: DateQualifier;
  /** Set when the original could not be represented exactly. */
  gedcomDate?: string;
  /** Whether the interpretation is approximate (for the report). */
  uncertain: boolean;
}

function validDay(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function simple(s: string): { date: PartialDate; exact: boolean } | null {
  let t = s.trim().toUpperCase();
  let exact = true;
  // calendar escapes
  const esc = t.match(/^@#D(\w+)@\s*(.*)$/);
  if (esc) {
    if (esc[1] !== 'GREGORIAN') exact = false;
    t = esc[2]!;
  }
  if (/\bB\.?C\.?$/.test(t)) return { date: null, exact: false };
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{3,4})(?:\/(\d{2}))?$/))) {
    const mo = MONTHS[m[2]!];
    if (!mo || !validDay(Number(m[3]), mo, Number(m[1]))) return null;
    return { date: `${m[3]!.padStart(4, '0')}-${String(mo).padStart(2, '0')}-${m[1]!.padStart(2, '0')}`, exact: exact && !m[4] };
  }
  if ((m = t.match(/^([A-Z]{3})\s+(\d{3,4})(?:\/(\d{2}))?$/))) {
    const mo = MONTHS[m[1]!];
    if (!mo) return null;
    return { date: `${m[2]!.padStart(4, '0')}-${String(mo).padStart(2, '0')}`, exact: exact && !m[3] };
  }
  if ((m = t.match(/^(\d{3,4})(?:\/(\d{2}))?$/))) return { date: m[1]!.padStart(4, '0'), exact: exact && !m[2] };
  // Numeric fallbacks some programs write (14.03.1923, 1923-03-14)
  if ((m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) {
    if (!validDay(Number(m[3]), Number(m[2]), Number(m[1]))) return null;
    return { date: `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`, exact: false };
  }
  if ((m = t.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/))) return { date: m[3] ? `${m[1]}-${m[2]}-${m[3]}` : `${m[1]}-${m[2]}`, exact: false };
  return null;
}

export function parseGedcomDate(value: string): GedcomDate {
  const v = value.trim();
  if (v === '') return { date: null, qualifier: 'exact', uncertain: false };
  const up = v.toUpperCase();
  let m: RegExpMatchArray | null;
  const keep = (date: PartialDate, qualifier: DateQualifier, exactRepr: boolean): GedcomDate =>
    exactRepr ? { date, qualifier, uncertain: qualifier !== 'exact' } : { date, qualifier, gedcomDate: v, uncertain: true };

  if ((m = up.match(/^(ABT|EST|CAL|BEF|AFT)\.?\s+(.+)$/))) {
    const s = simple(m[2]!);
    const q: DateQualifier = m[1] === 'ABT' ? 'about' : m[1] === 'EST' ? 'estimated' : m[1] === 'CAL' ? 'about' : m[1] === 'BEF' ? 'before' : 'after';
    if (!s) return { date: null, qualifier: q, gedcomDate: v, uncertain: true };
    return keep(s.date, q, s.exact && m[1] !== 'CAL');
  }
  if ((m = up.match(/^BET\.?\s+(.+?)\s+AND\s+(.+)$/))) {
    const s = simple(m[1]!);
    return { date: s?.date ?? null, qualifier: 'about', gedcomDate: v, uncertain: true };
  }
  if ((m = up.match(/^FROM\s+(.+?)\s+TO\s+(.+)$/)) || (m = up.match(/^(?:FROM|TO)\s+(.+)$/))) {
    const s = simple(m[1]!);
    return { date: s?.date ?? null, qualifier: 'exact', gedcomDate: v, uncertain: true };
  }
  if ((m = up.match(/^INT\.?\s+(.+?)\s*\((.*)\)$/))) {
    const s = simple(m[1]!);
    return { date: s?.date ?? null, qualifier: 'estimated', gedcomDate: v, uncertain: true };
  }
  if (up.startsWith('(') && up.endsWith(')')) return { date: null, qualifier: 'exact', gedcomDate: v, uncertain: true };
  const s = simple(v);
  if (!s) return { date: null, qualifier: 'exact', gedcomDate: v, uncertain: true };
  return keep(s.date, 'exact', s.exact);
}

/** Internal → GEDCOM date value. Uses the verbatim original when present. */
export function formatGedcomDate(date: PartialDate, qualifier: DateQualifier, verbatim?: string): string {
  if (verbatim) return verbatim;
  if (!date) return '';
  const [y, mo, d] = date.split('-');
  const core = d ? `${Number(d)} ${MONTH_NAMES[Number(mo) - 1]} ${y}` : mo ? `${MONTH_NAMES[Number(mo) - 1]} ${y}` : y!;
  const prefix = qualifier === 'about' ? 'ABT ' : qualifier === 'estimated' ? 'EST ' : qualifier === 'before' ? 'BEF ' : qualifier === 'after' ? 'AFT ' : '';
  return prefix + core;
}
