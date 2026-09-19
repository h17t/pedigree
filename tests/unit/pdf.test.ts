import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { woffToTrueType } from '@/print/pdf/woff';
import { readFont } from '@/print/pdf/sfnt';
import { multiply, parseTransform, pathOps, sheetToPdf } from '@/print/pdf/svg';
import { buildPdf, MM_TO_PT } from '@/print/pdf/writer';
import type { EmbeddedFont } from '@/print/pdf/writer';
import { exportPdf, FontsUnavailable } from '@/print/pdf';
import { treeContent, svgDocument } from '@/print/svgDocument';
import { migrateProject } from '@/model/schema';
import sample from '@/fixtures/sample-family.json';
import { layoutAll } from '@/render/layout';

const fontFile = (file: string): ArrayBuffer => {
  const b = readFileSync(file.replace(/^fonts\//, 'public/fonts/'));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
const load = (file: string) => Promise.resolve(fontFile(file));
const parse = (svg: string) => new DOMParser().parseFromString(svg, 'image/svg+xml');

/** The drawing operators, which the file keeps Flate-compressed. */
async function contentStreams(bytes: Uint8Array): Promise<string> {
  const text = new TextDecoder('latin1').decode(bytes);
  const out: string[] = [];
  // Each stream states its length, so the compressed bytes are taken exactly, never searched for.
  for (const m of text.matchAll(/<< \/Length (\d+) [^>]*>>\nstream\n/g)) {
    // A font file is compressed the same way but is not drawing operators; /Length1 marks it.
    if (m[0].includes('/Length1')) continue;
    const from = m.index + m[0].length;
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    void writer
      .write(bytes.slice(from, from + Number(m[1])))
      .then(() => writer.close())
      .catch(() => undefined);
    out.push(new TextDecoder('latin1').decode(await new Response(ds.readable).arrayBuffer()));
  }
  return out.join('\n');
}

describe('woff → truetype', () => {
  it('rebuilds the TrueType file the web font was made from', async () => {
    const ttf = await woffToTrueType(fontFile('fonts/atkinson-hyperlegible-next-latin-400-normal.woff'));
    // A sfnt starts with the version TrueType outlines use.
    expect(new DataView(ttf.buffer, ttf.byteOffset).getUint32(0)).toBe(0x00010000);
    const font = readFont(ttf);
    expect(font.unitsPerEm).toBe(1000);
    expect(font.ascent).toBeGreaterThan(0);
    expect(font.descent).toBeLessThan(0);
    // The glyphs a card needs: a letter, a space, an umlaut and the "born" star.
    for (const cp of [0x41, 0x20, 0xe4, 0x2a]) expect(font.glyph(cp)).toBeGreaterThan(0);
    expect(font.advance(font.glyph(0x41))).toBeGreaterThan(0);
    // The dagger lives in the Latin Extended chunk, not this one.
    expect(font.glyph(0x2020)).toBe(0);
  });

  it('refuses anything that is not a WOFF', async () => {
    await expect(woffToTrueType(new Uint8Array([1, 2, 3, 4]).buffer)).rejects.toThrow(/not a WOFF/);
  });
});

describe('svg → pdf operators', () => {
  it('reads the transforms the sheets use', () => {
    expect(parseTransform(null)).toEqual([1, 0, 0, 1, 0, 0]);
    expect(parseTransform('translate(10 20)')).toEqual([1, 0, 0, 1, 10, 20]);
    expect(parseTransform('scale(2)')).toEqual([2, 0, 0, 2, 0, 0]);
    expect(parseTransform('translate(5 5) scale(3)')).toEqual([3, 0, 0, 3, 5, 5]);
    const r = parseTransform('rotate(90)');
    expect(r[0]).toBeCloseTo(0);
    expect(r[1]).toBeCloseTo(1);
    expect(multiply([1, 0, 0, 1, 4, 6], [2, 0, 0, 2, 0, 0])).toEqual([2, 0, 0, 2, 4, 6]);
  });

  it('turns every path command the drawing uses into operators', () => {
    expect(pathOps('M10 20 H30 V40 L50 60 Z').split('\n').filter(Boolean)).toEqual(['10 20 m', '30 20 l', '30 40 l', '50 60 l', 'h']);
    // Relative commands continue from the point reached.
    expect(pathOps('M0 0 h8 v8').split('\n').filter(Boolean)).toEqual(['0 0 m', '8 0 l', '8 8 l']);
    // An arc has no PDF operator: it becomes Béziers that end where the arc ends.
    const arc = pathOps('M2 4 A2.5 2.5 0 0 1 7 4');
    expect(arc).toContain(' c');
    expect(arc.trim().split('\n').pop()).toMatch(/^[\d.]+ [\d.]+ [\d.]+ [\d.]+ 7 4 c$/);
  });

  it('draws a rectangle, a circle and a line, flipping the page so y points down', () => {
    const fonts = new Map<string, EmbeddedFont>();
    const r = sheetToPdf({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="20" width="30" height="40" fill="#FF0000"/><circle cx="50" cy="50" r="5" fill="#00FF00"/><line x1="0" y1="0" x2="10" y2="10" stroke="#0000FF" stroke-width="2"/></svg>',
      widthPt: 100,
      heightPt: 100,
      chooseFont: () => null,
      fonts,
      parse,
    });
    expect(r.content).toContain('q 1 0 0 -1 0 100 cm');
    expect(r.content).toContain('1 0 0 rg');
    expect(r.content).toContain('10 20 30 40 re');
    expect(r.content).toContain('0 1 0 rg');
    expect(r.content).toContain('0 0 1 RG');
    expect(r.content).toContain('2 w');
  });

  it('writes text as glyphs of the font that has them, honouring the anchor', async () => {
    const latin = readFont(await woffToTrueType(fontFile('fonts/atkinson-hyperlegible-next-latin-400-normal.woff')));
    const fonts = new Map<string, EmbeddedFont>([['latin400', { key: 'latin400', metrics: latin, used: new Map() }]]);
    const r = sheetToPdf({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><text x="100" y="50" font-size="10" text-anchor="end" fill="#000000">Ida</text></svg>',
      widthPt: 200,
      heightPt: 100,
      chooseFont: () => ({ key: 'latin400', metrics: latin }),
      fonts,
      parse,
    });
    expect(r.fonts).toEqual(['latin400']);
    // Three glyphs, and each is remembered with the character it stands for.
    expect(fonts.get('latin400')!.used.size).toBe(3);
    expect([...fonts.get('latin400')!.used.values()].sort((a, b) => a - b)).toEqual([0x49, 0x61, 0x64]);
    const tm = /1 0 0 -1 ([\d.]+) 50 Tm/.exec(r.content);
    expect(tm).not.toBeNull();
    // "end" puts the string's width to the left of the anchor.
    expect(Number(tm![1])).toBeLessThan(100);
    expect(Number(tm![1])).toBeGreaterThan(70);
  });
});

describe('the finished file', () => {
  const buildSheet = (blackAndWhite = false, onlyPerson?: string) => {
    const r = migrateProject(sample);
    if (!r.ok) throw new Error('the sample fixture does not load');
    let project = r.project;
    if (onlyPerson !== undefined) {
      // One person, named in the script under test, so the drawing really contains those letters.
      const [id, person] = Object.entries(project.persons)[0]!;
      project = { ...project, persons: { [id]: { ...person, givenNames: onlyPerson, surname: '', birthName: '', nickname: '', occupation: '', residence: '' } }, unions: {}, childLinks: {} };
    }
    const positions = layoutAll(project, 'standard');
    const visible = new Set(Object.keys(project.persons));
    const content = treeContent({
      project,
      positions,
      visible,
      level: 'standard',
      locale: 'en',
      labels: { née: 'née', living: '', unknownDate: '', warning: 'w', private: 'p', unknownParents: 'Parents unknown' },
      header: null,
      legend: null,
      blackAndWhite,
    });
    const sheetPx = { w: 1122, h: 794 };
    const svg = svgDocument({
      widthMm: 297,
      heightMm: 210,
      viewBox: { x: content.bounds.x, y: content.bounds.y, w: content.bounds.w, h: content.bounds.h },
      content: content.markup,
      fontCss: '',
      title: 'Weber',
      areaPx: { w: sheetPx.w - 76, h: sheetPx.h - 76 },
      marginPx: 38,
      headerPx: 0,
      legendPx: 0,
      sheetPx,
    });
    return { svg, text: content.text };
  };

  it('is a PDF with one page per sheet, at the sheet size', async () => {
    const { svg, text } = buildSheet();
    const bytes = await exportPdf({ sheets: [{ svg, widthMm: 297, heightMm: 210 }, { svg, widthMm: 297, heightMm: 210 }], text, weights: [400, 500, 700], base: '', title: 'Weber', creator: 'Pedigree' }, load, parse);
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, 9));
    expect(head).toBe('%PDF-1.7\n');
    const all = new TextDecoder('latin1').decode(bytes);
    expect(all.match(/\/Type \/Page\b/g)).toHaveLength(2);
    expect(all).toContain(`/MediaBox [0 0 ${(297 * MM_TO_PT).toFixed(2)} ${(210 * MM_TO_PT).toFixed(2)}]`);
    // The fonts travel inside the file, and the text can be read back out of it.
    expect(all).toContain('/FontFile2');
    expect(all).toContain('/Subtype /Type0');
    expect(all).toContain('/Encoding /Identity-H');
    expect(all).toContain('/ToUnicode');
    expect(all.endsWith('%%EOF\n')).toBe(true);
  });

  it('carries the black-and-white stripes over as tiling patterns', async () => {
    const { svg, text } = buildSheet(true);
    const bytes = await exportPdf({ sheets: [{ svg, widthMm: 297, heightMm: 210 }], text, weights: [400, 500, 700], base: '', title: 'Weber', creator: 'Pedigree' }, load, parse);
    const all = new TextDecoder('latin1').decode(bytes);
    // The colour groups become hatch / dot / line tiles, declared and then used by name.
    expect(all).toContain('/PatternType 1');
    expect(all).toContain('/Pattern <<');
    const drawing = await contentStreams(bytes);
    expect(drawing).toContain('/Pattern cs');
    // No tint survives into a black-and-white sheet, but the cards are still drawn.
    expect(drawing).not.toMatch(/0\.9\d+ 0\.9\d+ 0\.9\d+ rg/);
    expect(drawing).toContain(' re');
  });

  it('embeds the East Asian chunks a Japanese tree needs, and only those', async () => {
    // Kana settles the family; Han alone would follow the language's preferred one.
    const japanese = '田中 はなこ';
    const { svg } = buildSheet(false, japanese);
    const bytes = await exportPdf({ sheets: [{ svg, widthMm: 297, heightMm: 210 }], text: japanese, weights: [400, 700], base: '', title: 'x', creator: 'Pedigree' }, load, parse);
    const all = new TextDecoder('latin1').decode(bytes);
    const embedded = [...all.matchAll(/\/FontName \/(\w+)/g)].map((m) => m[1]!);
    expect(embedded.some((name) => name.startsWith('notosansjp'))).toBe(true);
    // Four characters fall into very few chunks; the whole font is 550 of them.
    expect(embedded.length).toBeLessThan(14);
    expect(all).toContain('/FontFile2');
  });

  it('says which file is missing rather than writing a PDF with gaps where the names should be', async () => {
    const { svg, text } = buildSheet();
    const refuse = (file: string) => (file.includes('cjk') ? Promise.reject(new Error('offline')) : load(file));
    await expect(exportPdf({ sheets: [{ svg, widthMm: 297, heightMm: 210 }], text: `${text}田中`, weights: [400], base: '', title: 'x', creator: 'Pedigree' }, refuse, parse)).rejects.toBeInstanceOf(FontsUnavailable);
  });

  it('keeps a name written in another script readable in the metadata of the file', async () => {
    const bytes = await buildPdf([{ widthPt: 100, heightPt: 100, content: '', fonts: [], patterns: [] }], [], { title: '田中家', creator: 'Pedigree' });
    const text = new TextDecoder('latin1').decode(bytes);
    // UTF-16 big-endian with a byte order mark, in hex: the only form a PDF string has for this.
    expect(text).toContain('/Title <FEFF75304E2D5BB6>');
    // Plain ASCII stays legible in the file.
    expect(text).toContain('/Creator (Pedigree)');
  });

  it('lays the cross-reference table out so every object can be found', async () => {
    const bytes = await buildPdf([{ widthPt: 100, heightPt: 100, content: '', fonts: [], patterns: [] }], [], { title: 'T', creator: 'Pedigree' });
    const text = new TextDecoder('latin1').decode(bytes);
    const size = Number(/\/Size (\d+)/.exec(text)![1]);
    const start = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(start, start + 4)).toBe('xref');
    const offsets = [...text.slice(start).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(size - 1);
    // Every offset points at the object that claims that number.
    offsets.forEach((at, i) => expect(text.slice(at, at + String(i + 1).length + 6)).toBe(`${i + 1} 0 obj`));
  });
});

describe('when the input is not a sheet', () => {
  it('says so instead of writing an empty page', () => {
    expect(() =>
      sheetToPdf({ svg: '<not-svg/>', widthPt: 10, heightPt: 10, chooseFont: () => null, fonts: new Map<string, EmbeddedFont>(), parse }),
    ).toThrow(/not an SVG/);
  });
});

describe('arcs', () => {
  /** The point a cubic Bézier reaches at t. */
  const bezier = (p: number[][], t: number) => {
    const u = 1 - t;
    return [0, 1].map((i) => u ** 3 * p[0]![i]! + 3 * u ** 2 * t * p[1]![i]! + 3 * u * t ** 2 * p[2]![i]! + t ** 3 * p[3]![i]!);
  };

  it('bends the right way: a quarter-circle arc stays on the circle', () => {
    // From (10,0) to (0,10) around the origin, the short way.
    const ops = pathOps('M10 0 A10 10 0 0 1 0 10');
    const numbers = [...ops.matchAll(/-?[\d.]+/g)].map((m) => Number(m[0]));
    expect(ops).toContain(' c');
    const points = [[10, 0], [numbers[2]!, numbers[3]!], [numbers[4]!, numbers[5]!], [numbers[6]!, numbers[7]!]];
    // Every point of the curve is one radius from the centre, to within a thousandth.
    for (const t of [0.25, 0.5, 0.75]) {
      const [x, y] = bezier(points, t);
      expect(Math.hypot(x!, y!)).toBeCloseTo(10, 2);
    }
    // And it goes the way it was told: through the first quadrant, not the third.
    const [mx, my] = bezier(points, 0.5);
    expect(mx!).toBeGreaterThan(0);
    expect(my!).toBeGreaterThan(0);
  });
});

describe('graphics state', () => {
  it('states the cap and join on every stroke, so one element cannot change the next', () => {
    const r = sheetToPdf({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0 L9 9" stroke="#000000" stroke-linecap="round"/><path d="M0 9 L9 0" stroke="#000000"/></svg>',
      widthPt: 100,
      heightPt: 100,
      chooseFont: () => null,
      fonts: new Map<string, EmbeddedFont>(),
      parse,
    });
    // The round cap of the first path, then the default put back for the second.
    const caps = [...r.content.matchAll(/^(\d) J$/gm)].map((m) => m[1]);
    expect(caps).toEqual(['1', '0']);
  });
});
