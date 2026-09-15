/**
 * PDF export of the print sheets. One page per sheet, drawn from the very SVG the SVG export
 * writes, so paper, preview, SVG and PDF are the same drawing. Text is text: the fonts travel
 * inside the file and every string carries its characters, so the PDF can be searched and the
 * names copied out of it.
 *
 * East Asian text is the one thing this cannot do: those fonts are megabytes as TrueType, far
 * too much to put in a family tree. The dialog then points at the browser's own print-to-PDF,
 * which has the fonts already.
 */
import type { FontChunk, FontWeight } from '../fonts';
import { chunksFor } from '../fonts';
import { cjkFamiliesIn, useFontState } from '@/design/cjkFonts';
import { readFont } from './sfnt';
import type { FontMetrics } from './sfnt';
import { woffToTrueType } from './woff';
import { buildPdf, MM_TO_PT } from './writer';
import type { EmbeddedFont, PdfPage } from './writer';
import { sheetToPdf } from './svg';

export class CjkNotSupported extends Error {
  constructor() {
    super('PDF export cannot embed the East Asian fonts');
    this.name = 'CjkNotSupported';
  }
}

export interface PdfSheet {
  svg: string;
  widthMm: number;
  heightMm: number;
}

export interface PdfExportOptions {
  sheets: PdfSheet[];
  /** Every character the sheets can contain, used to pick the font chunks. */
  text: string;
  weights: FontWeight[];
  /** Where the font files live (the app's base path). */
  base: string;
  title: string;
  creator: string;
}

/** A PDF name has to be one token; the chunk file name makes a readable, unique one. */
const keyOf = (chunk: FontChunk) => `${chunk.range.replace(/[^A-Za-z0-9]/g, '')}${chunk.weight}`;

/** Parses a `U+xxxx-yyyy, …` list into pairs. */
function ranges(spec: string): [number, number][] {
  return spec
    .split(',')
    .map((part) => {
      const m = /^U\+([0-9a-f]+)(?:-([0-9a-f]+))?$/i.exec(part.trim());
      return m ? ([parseInt(m[1]!, 16), m[2] ? parseInt(m[2], 16) : parseInt(m[1]!, 16)] as [number, number]) : ([0, -1] as [number, number]);
    })
    .filter(([a, b]) => b >= a);
}

export async function exportPdf(o: PdfExportOptions, load: (file: string) => Promise<ArrayBuffer>, parse: (svg: string) => Document): Promise<Uint8Array> {
  if (cjkFamiliesIn(o.text, useFontState.getState().preferred ?? 'sc').length > 0) throw new CjkNotSupported();
  // The same chunks the SVG export embeds, as WOFF (a PDF cannot read WOFF2).
  const chunks = chunksFor(o.text, o.weights);
  const loaded: { chunk: FontChunk; key: string; metrics: FontMetrics; ranges: [number, number][] }[] = [];
  const fonts = new Map<string, EmbeddedFont>();
  for (const chunk of chunks) {
    const key = keyOf(chunk);
    if (fonts.has(key)) continue;
    const metrics = readFont(await woffToTrueType(await load(chunk.file.replace(/\.woff2$/, '.woff'))));
    fonts.set(key, { key, metrics, used: new Map() });
    loaded.push({ chunk, key, metrics, ranges: ranges(chunk.unicodeRange) });
  }

  const chooseFont = (codePoint: number, weight: number) => {
    const wanted = weight >= 700 ? 700 : weight >= 500 ? 500 : 400;
    const has = (e: (typeof loaded)[number]) => e.metrics.glyph(codePoint) !== 0;
    const inRange = (e: (typeof loaded)[number]) => e.ranges.some(([a, b]) => codePoint >= a && codePoint <= b);
    // The weight asked for, then any weight: a missing glyph is worse than a wrong thickness.
    const candidates = [...loaded.filter((e) => e.chunk.weight === wanted), ...loaded];
    const hit = candidates.find((e) => inRange(e) && has(e)) ?? candidates.find(has);
    return hit ? { key: hit.key, metrics: hit.metrics } : null;
  };

  const pages: PdfPage[] = o.sheets.map((sheet) => {
    const widthPt = sheet.widthMm * MM_TO_PT, heightPt = sheet.heightMm * MM_TO_PT;
    const r = sheetToPdf({ svg: sheet.svg, widthPt, heightPt, chooseFont, fonts, parse });
    return { widthPt, heightPt, content: r.content, fonts: r.fonts, patterns: r.patterns };
  });
  return buildPdf(pages, [...fonts.values()], { title: o.title, creator: o.creator });
}
