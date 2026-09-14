/**
 * Text measurement and wrapping for SVG cards. SVG has no automatic line wrapping, so lines
 * are computed here. Measurement uses a 2D canvas with the real font when available (browser)
 * and a per-character estimate otherwise (tests, or before the font has loaded).
 */
import { fontStack, useFontState } from '@/design/cjkFonts';

let ctx: CanvasRenderingContext2D | null | undefined;
const cache = new Map<string, number>();

function context(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx;
  try {
    const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    ctx = c ? c.getContext('2d') : null;
  } catch {
    ctx = null;
  }
  return ctx;
}

const FULL_WIDTH = /[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/u;
const CYRILLIC = /[\u0400-\u052f]/u;

/** Rough per-glyph widths (em) for the estimate path; East Asian glyphs are full-width. */
export function estimateWidth(text: string, size: number, weight: number): number {
  let w = 0;
  for (const ch of text) {
    if (FULL_WIDTH.test(ch)) w += 1.0;
    else if (CYRILLIC.test(ch)) w += ch === ch.toUpperCase() ? 0.68 : 0.58;
    else if (ch === ' ') w += 0.28;
    else if ('iljtfrI.,:;\'!|'.includes(ch)) w += 0.3;
    else if ('mwMW'.includes(ch)) w += 0.85;
    else if (ch >= 'A' && ch <= 'Z') w += 0.66;
    else if (ch >= '0' && ch <= '9') w += 0.56;
    else w += 0.54;
  }
  return w * size * (weight >= 700 ? 1.06 : 1);
}

let cacheVersion = -1;
/** Drop measured widths (a web font finished loading, so the same text now measures differently). */
export function clearMeasureCache(): void {
  cache.clear();
}

export function measureText(text: string, size: number, weight = 400): number {
  if (text === '') return 0;
  const v = useFontState.getState().version;
  if (v !== cacheVersion) {
    cacheVersion = v;
    cache.clear();
  }
  const key = `${weight}|${size}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const c = context();
  let w: number;
  if (c) {
    c.font = `${weight} ${size}px ${fontStack()}`;
    const m = c.measureText(text).width;
    // jsdom returns 0 for everything; fall back to the estimate then.
    w = m > 0 ? m : estimateWidth(text, size, weight);
  } else w = estimateWidth(text, size, weight);
  if (cache.size > 5000) cache.clear();
  cache.set(key, w);
  return w;
}

const ELLIPSIS = '…';

/** Cut a single line to fit `maxWidth`, appending an ellipsis when something was removed. */
export function truncateLine(text: string, maxWidth: number, size: number, weight = 400): { text: string; truncated: boolean } {
  if (measureText(text, size, weight) <= maxWidth) return { text, truncated: false };
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measureText(text.slice(0, mid).trimEnd() + ELLIPSIS, size, weight) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return { text: text.slice(0, lo).trimEnd() + ELLIPSIS, truncated: true };
}

/**
 * Wrap `text` at spaces into at most `maxLines` lines of `maxWidth`; the last line is
 * truncated with an ellipsis if text remains. Words longer than a line are cut mid-word.
 */
export function wrapText(text: string, maxWidth: number, maxLines: number, size: number, weight = 400): { lines: string[]; truncated: boolean } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  let i = 0;
  while (i < words.length) {
    const word = words[i]!;
    const candidate = current ? `${current} ${word}` : word;
    if (measureText(candidate, size, weight) <= maxWidth) {
      current = candidate;
      i++;
      continue;
    }
    if (current === '') {
      // Single word wider than the line: cut it.
      let cut = word.length;
      while (cut > 1 && measureText(word.slice(0, cut), size, weight) > maxWidth) cut--;
      lines.push(word.slice(0, cut));
      words[i] = word.slice(cut);
      if (words[i] === '') i++;
    } else {
      lines.push(current);
      current = '';
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);
  const leftover = i < words.length || (lines.length === maxLines && current !== '' && !lines.includes(current));
  if (leftover) {
    const last = lines[maxLines - 1] ?? '';
    const rest = [current, ...words.slice(i)].filter(Boolean).join(' ');
    const full = last ? `${last} ${rest}` : rest;
    lines[maxLines - 1] = truncateLine(full, maxWidth, size, weight).text;
    return { lines: lines.slice(0, maxLines), truncated: true };
  }
  return { lines, truncated: false };
}
