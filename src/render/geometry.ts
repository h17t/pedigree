/**
 * Card geometry and the text lines each detail level shows. The same functions drive the
 * screen canvas and the print output so both agree exactly.
 */
import { card } from '@/design/tokens';
import type { CardVariant } from '@/design/tokens';
import type { CardAppearance, Person, Union } from '@/model/types';
import { defaultCardAppearance } from '@/model/types';
import { displayName, effectiveLifeStatus } from '@/model/types';
import { formatDateWithQualifier, formatYearWithQualifier } from '@/model/dates';
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

/** The card box; `scale` is the per-generation factor of "Balance generations" (1 = full size). */
export function cardBox(x: number, y: number, level: DetailLevel, print = false, scale = 1): Box {
  return { x, y, w: card.width * scale, h: cardHeight(level, print) * scale };
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
  // Genealogical convention: * for born, † for died.
  const b = p.birth.date ? `* ${formatYearWithQualifier(p.birth)}` : '';
  const d = p.death.date ? `† ${formatYearWithQualifier(p.death)}` : effectiveLifeStatus(p) === 'deceased' ? '†' : '';
  void locale;
  return [b, d].filter(Boolean).join(' – ');
}

/**
 * Builds the text content of a card at a detail level. Never changes the card height: a line the
 * appearance setting leaves out stays empty, so the same person always occupies the same box.
 */
export function cardText(p: Person, level: DetailLevel, locale: Locale, print = false, labels?: { née: string; living: string; unknownDate: string }, cards: CardAppearance = defaultCardAppearance()): CardText {
  const nameW = textWidth - card.marker - 6;
  const name = wrapText(displayName(p, labels?.née ?? 'née') || '—', nameW, card.name.maxLines, card.name.size, card.name.weight);
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
    const place = (s: string) => (cards.places && s ? `, ${s}` : '');
    const birth = p.birth.date ? `* ${formatDateWithQualifier(locale, p.birth.date, p.birth.qualifier, 'short', p.birth.dateEnd)}${place(p.birth.place)}` : cards.places && p.birth.place ? `* ${p.birth.place}` : '';
    // Living people carry no label: the absence of a death date is enough.
    const death = p.death.date ? `† ${formatDateWithQualifier(locale, p.death.date, p.death.qualifier, 'short', p.death.dateEnd)}${place(p.death.place)}` : status === 'deceased' ? '†' : '';
    push(birth);
    push(death);
    push(cards.occupation ? p.occupation : '');
    if (level === 'full') {
      push(p.nickname ? `„${p.nickname}“` : '');
      push(p.residence);
    }
  }

  let noteLines: string[] = [];
  let notesTruncated = false;
  if (level === 'full' && print) {
    // Two lines for events / custom fields, then the clamped notes.
    const extras = [
      ...p.events.map((e) => `${e.type === 'other' ? e.label : e.type}${e.date ? ` ${formatDateWithQualifier(locale, e.date, e.qualifier, 'short', e.dateEnd)}` : ''}${e.place ? `, ${e.place}` : ''}`),
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
