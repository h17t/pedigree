/**
 * Font embedding for exported SVG: the bundled WOFF2 chunks (Latin, Latin Extended) per weight
 * are embedded as base64 @font-face rules, but only the chunks whose ranges the text uses.
 * See DECISIONS.md #42 (chunk-level subsetting). Ranges are built from code points so the
 * source stays plain ASCII.
 */
export type FontWeight = 400 | 500 | 700;
export type FontRange = 'latin' | 'latin-ext' | 'cyrillic' | 'cyrillic-ext';

type Range = [number, number];
const LATIN_RANGES: Range[] = [[0x0000, 0x00ff], [0x0131, 0x0131], [0x0152, 0x0153], [0x02bb, 0x02bc], [0x02c6, 0x02c6], [0x02da, 0x02da], [0x02dc, 0x02dc], [0x0304, 0x0304], [0x0308, 0x0308], [0x0329, 0x0329], [0x2000, 0x206f], [0x20ac, 0x20ac], [0x2122, 0x2122], [0x2191, 0x2191], [0x2193, 0x2193], [0x2212, 0x2212], [0x2215, 0x2215], [0xfeff, 0xfeff], [0xfffd, 0xfffd]];
const CYRILLIC_RANGES: Range[] = [[0x0301, 0x0301], [0x0400, 0x045f], [0x0490, 0x0491], [0x04b0, 0x04b1], [0x2116, 0x2116]];
const CYRILLIC_EXT_RANGES: Range[] = [[0x0460, 0x052f], [0x1c80, 0x1c8a], [0x20b4, 0x20b4], [0x2de0, 0x2dff], [0xa640, 0xa69f], [0xfe2e, 0xfe2f]];
const LATIN_EXT_RANGES: Range[] = [[0x0100, 0x02ba], [0x02bd, 0x02c5], [0x02c7, 0x02cc], [0x02ce, 0x02d7], [0x02dd, 0x02ff], [0x1d00, 0x1dbf], [0x1e00, 0x1e9f], [0x1ef2, 0x1eff], [0x2020, 0x2020], [0x20a0, 0x20ab], [0x20ad, 0x20c0], [0x2113, 0x2113], [0x2c60, 0x2c7f], [0xa720, 0xa7ff]];

function inRanges(text: string, ranges: Range[]): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    for (const [a, b] of ranges) if (cp >= a && cp <= b) return true;
  }
  return false;
}

const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');
const unicodeRangeOf = (ranges: Range[]) => ranges.map(([a, b]) => (a === b ? `U+${hex(a)}` : `U+${hex(a)}-${hex(b)}`)).join(', ');

export interface FontChunk {
  weight: FontWeight;
  /** A FontRange of the main font, or `cjk-<family>` for a Noto chunk. */
  range: string;
  file: string;
  unicodeRange: string;
  /** Font family the @font-face declares; Atkinson Hyperlegible Next unless set. */
  family?: string;
}

/** The chunk table of the East Asian fonts (public/fonts/cjk-chunks.json). */
export type CjkChunkTable = Record<string, { family: string; chunks: { weight: number; file: string; unicodeRange: string }[] }>;

function parseUnicodeRange(s: string): Range[] {
  return s.split(',').map((part) => {
    const m = part.trim().match(/^U\+([0-9a-f]+)(?:-([0-9a-f]+))?$/i);
    if (!m) return [0, -1];
    const a = parseInt(m[1]!, 16);
    return [a, m[2] ? parseInt(m[2], 16) : a];
  });
}

/** The East Asian chunks a text needs from the families listed, per weight (500 falls back to 400). */
export function cjkChunksFor(text: string, weights: FontWeight[], families: string[], table: CjkChunkTable): FontChunk[] {
  const out: FontChunk[] = [];
  const wanted = new Set<number>(weights.map((w) => (w === 500 ? 400 : w)));
  for (const key of families) {
    const entry = table[key];
    if (!entry) continue;
    for (const c of entry.chunks) {
      if (!wanted.has(c.weight)) continue;
      if (!inRanges(text, parseUnicodeRange(c.unicodeRange))) continue;
      out.push({ weight: c.weight as FontWeight, range: `cjk-${key}`, file: c.file, unicodeRange: c.unicodeRange, family: entry.family });
    }
  }
  return out;
}

const UNICODE_RANGE: Record<FontRange, string> = { latin: unicodeRangeOf(LATIN_RANGES), 'latin-ext': unicodeRangeOf(LATIN_EXT_RANGES), cyrillic: unicodeRangeOf(CYRILLIC_RANGES), 'cyrillic-ext': unicodeRangeOf(CYRILLIC_EXT_RANGES) };
const RANGES: Record<FontRange, Range[]> = { latin: LATIN_RANGES, 'latin-ext': LATIN_EXT_RANGES, cyrillic: CYRILLIC_RANGES, 'cyrillic-ext': CYRILLIC_EXT_RANGES };

/** The Cyrillic chunks come from Noto Sans (see tokens.css); the Latin ones from Atkinson Hyperlegible Next. */
export function fileFor(weight: FontWeight, range: FontRange): string {
  return range.startsWith('cyrillic') ? `fonts/noto-sans-${range}-${weight}-normal.woff2` : `fonts/atkinson-hyperlegible-next-${range}-${weight}-normal.woff2`;
}

/** Which chunks a text needs, per weight used. */
export function chunksFor(text: string, weights: FontWeight[]): FontChunk[] {
  // The dagger (U+2020) sits in the Latin Extended chunk only.
  const needed = (Object.keys(RANGES) as FontRange[]).filter((r) => inRanges(text, RANGES[r]));
  const out: FontChunk[] = [];
  for (const weight of [...new Set(weights)].sort()) {
    for (const range of needed) out.push({ weight, range, file: fileFor(weight, range), unicodeRange: UNICODE_RANGE[range] });
  }
  return out;
}

/** @font-face CSS with base64 data for the given chunks. `load` fetches a file's bytes. */
export async function fontFaceCss(chunks: FontChunk[], load: (file: string) => Promise<ArrayBuffer>): Promise<string> {
  return (await fontFaceCssWithSize(chunks, load)).css;
}

/** Same, also reporting the font bytes embedded (before base64). */
export async function fontFaceCssWithSize(chunks: FontChunk[], load: (file: string) => Promise<ArrayBuffer>): Promise<{ css: string; bytes: number }> {
  const rules: string[] = [];
  let bytes = 0;
  for (const c of chunks) {
    const buf = await load(c.file);
    bytes += buf.byteLength;
    rules.push(`@font-face{font-family:"${c.family ?? 'Atkinson Hyperlegible Next'}";font-style:normal;font-weight:${c.weight};src:url(data:font/woff2;base64,${toBase64(buf)}) format("woff2");unicode-range:${c.unicodeRange};}`);
  }
  return { css: rules.join('\n'), bytes };
}

export function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
}
