/**
 * Just enough TrueType to place text in a PDF: which glyph a character maps to (`cmap`), how
 * wide that glyph is (`hmtx`), and the handful of numbers the font descriptor asks for
 * (`head`, `hhea`, `OS/2`, `post`). Nothing here draws an outline — the glyph data travels
 * verbatim inside the embedded file.
 */

export interface FontMetrics {
  /** The whole TrueType file, embedded as it is. */
  data: Uint8Array;
  unitsPerEm: number;
  bbox: [number, number, number, number];
  ascent: number;
  descent: number;
  capHeight: number;
  italicAngle: number;
  /** Glyph id for a code point, or 0 when the font has no glyph for it. */
  glyph(codePoint: number): number;
  /** Advance width of a glyph in font units. */
  advance(glyph: number): number;
}

const tag = (s: string) => (s.charCodeAt(0) << 24) | (s.charCodeAt(1) << 16) | (s.charCodeAt(2) << 8) | s.charCodeAt(3);

function tables(view: DataView): Map<number, { offset: number; length: number }> {
  const out = new Map<number, { offset: number; length: number }>();
  const n = view.getUint16(4);
  for (let i = 0; i < n; i++) {
    const at = 12 + i * 16;
    out.set(view.getUint32(at), { offset: view.getUint32(at + 8), length: view.getUint32(at + 12) });
  }
  return out;
}

/** Character → glyph from the best available Unicode subtable (format 12, else format 4). */
function readCmap(view: DataView, start: number): Map<number, number> {
  const map = new Map<number, number>();
  const n = view.getUint16(start + 2);
  let best = -1, bestScore = -1;
  for (let i = 0; i < n; i++) {
    const at = start + 4 + i * 8;
    const platform = view.getUint16(at), encoding = view.getUint16(at + 2);
    const offset = view.getUint32(at + 4);
    const format = view.getUint16(start + offset);
    // Prefer a full Unicode table (format 12), then the usual BMP one (format 4).
    const unicode = platform === 3 ? encoding === 10 || encoding === 1 : platform === 0;
    if (!unicode) continue;
    const score = format === 12 ? 2 : format === 4 ? 1 : 0;
    if (score > bestScore) {
      bestScore = score;
      best = start + offset;
    }
  }
  if (best < 0) return map;
  const format = view.getUint16(best);
  if (format === 4) {
    const segX2 = view.getUint16(best + 6);
    const ends = best + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
    for (let s = 0; s < segX2 / 2; s++) {
      const end = view.getUint16(ends + s * 2);
      const from = view.getUint16(starts + s * 2);
      const delta = view.getInt16(deltas + s * 2);
      const rangeOffset = view.getUint16(ranges + s * 2);
      if (from > end) continue;
      for (let c = from; c <= end && c !== 0xffff; c++) {
        let g: number;
        if (rangeOffset === 0) g = (c + delta) & 0xffff;
        else {
          const at = ranges + s * 2 + rangeOffset + (c - from) * 2;
          if (at + 1 >= view.byteLength) continue;
          g = view.getUint16(at);
          if (g !== 0) g = (g + delta) & 0xffff;
        }
        if (g !== 0) map.set(c, g);
      }
    }
  } else if (format === 12) {
    const groups = view.getUint32(best + 12);
    for (let i = 0; i < groups; i++) {
      const at = best + 16 + i * 12;
      const from = view.getUint32(at), to = view.getUint32(at + 4), first = view.getUint32(at + 8);
      // A single group can span a whole plane; only the code points a tree actually uses matter,
      // so the map stays a plain lookup and very long groups are clamped.
      for (let c = from; c <= Math.min(to, from + 0xffff); c++) map.set(c, first + (c - from));
    }
  }
  return map;
}

/** Reads the tables a PDF needs. Throws when the file is not TrueType-shaped. */
export function readFont(data: Uint8Array): FontMetrics {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const t = tables(view);
  const head = t.get(tag('head')), hhea = t.get(tag('hhea')), hmtx = t.get(tag('hmtx')), cmap = t.get(tag('cmap'));
  if (!head || !hhea || !hmtx || !cmap) throw new Error('font is missing a required table');
  const unitsPerEm = view.getUint16(head.offset + 18) || 1000;
  const bbox: [number, number, number, number] = [view.getInt16(head.offset + 36), view.getInt16(head.offset + 38), view.getInt16(head.offset + 40), view.getInt16(head.offset + 42)];
  const numberOfHMetrics = view.getUint16(hhea.offset + 34);
  const os2 = t.get(tag('OS/2'));
  const post = t.get(tag('post'));
  const ascent = os2 && os2.length >= 70 ? view.getInt16(os2.offset + 68) : view.getInt16(hhea.offset + 4);
  const descent = os2 && os2.length >= 72 ? view.getInt16(os2.offset + 70) : view.getInt16(hhea.offset + 6);
  // sCapHeight only exists from version 2 of OS/2; the ascender is a serviceable stand-in.
  const capHeight = os2 && view.getUint16(os2.offset) >= 2 && os2.length >= 90 ? view.getInt16(os2.offset + 88) : ascent;
  const italicAngle = post ? view.getInt32(post.offset + 4) / 65536 : 0;
  const chars = readCmap(view, cmap.offset);
  const widths = new Map<number, number>();
  const advance = (glyph: number): number => {
    const cached = widths.get(glyph);
    if (cached !== undefined) return cached;
    // Past the last full metric every glyph repeats the last advance (the table stores only
    // left side bearings from there on).
    const index = Math.min(glyph, numberOfHMetrics - 1);
    const at = hmtx.offset + index * 4;
    const w = at + 1 < view.byteLength ? view.getUint16(at) : 0;
    widths.set(glyph, w);
    return w;
  };
  return { data, unitsPerEm, bbox, ascent, descent, capHeight, italicAngle, glyph: (cp) => chars.get(cp) ?? 0, advance };
}
