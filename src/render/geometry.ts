/**
 * Card geometry and the text lines each detail level shows. The same functions drive the
 * screen canvas and the print output so both agree exactly.
 */
import { card } from '@/design/tokens';
import type { CardVariant } from '@/design/tokens';
import type { Person, Union } from '@/model/types';
import { effectiveLifeStatus, personName } from '@/model/types';
import { formatDateWithQualifier, qualifierMark, yearOf } from '@/model/dates';
import type { Locale } from '@/i18n';
import { wrapText, truncateLine } from './text';

export type DetailLevel = 'minimal' | 'standard' | 'full';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Height variant for a detail level; `tall` is used only by print at `full`. */
export function variantFor(level: DetailLevel, print = false): CardVariant {
  if (level === 'full') return print ? 'tall' : 'full';
  return level;
}

export function cardHeight(level: DetailLevel, print = false): number {
  return card.height[variantFor(level, print)];
}

export function cardBox(x: number, y: number, level: DetailLevel, print = false): Box {
  return { x, y, w: card.width, h: cardHeight(level, print) };
}

/** Text width available inside the card. */
export const textWidth = card.width - card.padding.left - card.padding.right - card.stripeWidth;

export interface CardText {
  nameLines: string[];
  nameTruncated: boolean;
  /** Secondary lines in order (already truncated to one line each). */
  lines: string[];
  /** Note lines (tall only). */
  noteLines: string[];
  notesTruncated: boolean;
  deceased: boolean;
  /** Any secondary line was cut. */
  anyTruncated: boolean;
}

function years(p: Person, locale: Locale): string {
  const b = p.birth.date ? `${qualifierMark(p.birth.qualifier)}${yearOf(p.birth.date)}` : '';
  const d = p.death.date ? `† ${qualifierMark(p.death.qualifier)}${yearOf(p.death.date)}` : effectiveLifeStatus(p) === 'deceased' ? '†' : '';
  void locale;
  return [b, d].filter(Boolean).join(' – ');
}

/** Builds the text content of a card at a detail level. Never changes the card height. */
export function cardText(p: Person, level: DetailLevel, locale: Locale, print = false, labels?: { née: string; living: string; unknownDate: string }): CardText {
  const nameW = textWidth - (p.tag ? 0 : 0) - card.marker - 6;
  const name = wrapText(personName(p) || '—', nameW, card.name.maxLines, card.name.size, card.name.weight);
  const secondary: string[] = [];
  const cut = (s: string) => truncateLine(s, textWidth, card.secondary.size, card.secondary.weight);
  let anyTruncated = false;
  const push = (s: string) => {
    const r = cut(s);
    anyTruncated ||= r.truncated;
    secondary.push(r.text);
  };
  const status = effectiveLifeStatus(p);

  if (level === 'minimal') {
    push(years(p, locale) || (labels?.unknownDate ?? ''));
  } else {
    const birth = p.birth.date ? `* ${formatDateWithQualifier(locale, p.birth.date, p.birth.qualifier)}${p.birth.place ? `, ${p.birth.place}` : ''}` : p.birth.place ? `* ${p.birth.place}` : '';
    const death = p.death.date ? `† ${formatDateWithQualifier(locale, p.death.date, p.death.qualifier)}${p.death.place ? `, ${p.death.place}` : ''}` : status === 'living' ? (labels?.living ?? '') : status === 'deceased' ? '†' : '';
    push(birth);
    push(death);
    push(p.occupation);
    if (level === 'full') {
      const nee = p.birthName ? `${labels?.née ?? 'née'} ${p.birthName}` : p.nickname ? `„${p.nickname}“` : '';
      push(nee);
      push(p.residence);
    }
  }

  let noteLines: string[] = [];
  let notesTruncated = false;
  if (level === 'full' && print) {
    // Two lines for events / custom fields, then the clamped notes.
    const extras = [
      ...p.events.map((e) => `${e.type === 'other' ? e.label : e.type}${e.date ? ` ${formatDateWithQualifier(locale, e.date, e.qualifier)}` : ''}${e.place ? `, ${e.place}` : ''}`),
      ...p.customFields.map((f) => `${f.label}: ${f.value}`),
    ];
    push(extras[0] ?? '');
    push(extras.length > 2 ? `${cut(extras[1] ?? '').text} …` : (extras[1] ?? ''));
    if (p.notes.trim()) {
      const w = wrapText(p.notes.replace(/\s+/g, ' '), textWidth, card.notes.maxLines, card.notes.size, card.notes.weight);
      noteLines = w.lines;
      notesTruncated = w.truncated;
    }
  }

  return { nameLines: name.lines, nameTruncated: name.truncated, lines: secondary, noteLines, notesTruncated, deceased: status === 'deceased', anyTruncated };
}

/** Geometry of a union junction: the small square on the partner line. */
export const junctionSize = 12;
export const unknownParentsBox = { w: 120, h: 32 };

export function isParentsUnknown(u: Union): boolean {
  return u.partnerIds.length === 0;
}
