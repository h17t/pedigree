import { describe, expect, it } from 'vitest';
import { PAPER, sheetFor, mmToPx, pxToPt, PX_PER_MM } from '@/print/paper';
import { fitToSheet, isLegible, smallestTextAt, LEGIBILITY_PT } from '@/print/scale';
import { tile, sheetCount, MAX_SHEETS } from '@/print/tiling';
import { pngSize, PNG_MAX_EDGE } from '@/print/png';
import { chunksFor, fontFaceCss, fontFaceCssWithSize, toBase64 } from '@/print/fonts';

describe('paper', () => {
  it('knows ISO sizes, orientation and margins', () => {
    expect(PAPER.A4).toEqual({ w: 210, h: 297 });
    const s = sheetFor('A4', 'landscape', 10);
    expect(s).toEqual({ width: 297, height: 210, margin: 10, areaW: 277, areaH: 190 });
    expect(sheetFor('A5', 'portrait', 500).margin).toBe(37);
    expect(mmToPx(25.4)).toBeCloseTo(96);
    expect(pxToPt(16)).toBe(12);
    expect(PX_PER_MM).toBeCloseTo(3.7795, 3);
  });
});

describe('fit to one page', () => {
  it('scales a wide drawing to the printable width and centres it', () => {
    const sheet = sheetFor('A4', 'landscape', 10);
    const bounds = { x: 100, y: 50, w: 2000, h: 500 };
    const f = fitToSheet(bounds, sheet);
    expect(f.scale).toBeCloseTo(mmToPx(277) / 2048, 4);
    expect(f.viewBox.w).toBeCloseTo(2048, 1);
    expect(f.viewBox.x).toBeCloseTo(76, 1);
    const drawingH = 548;
    expect(f.viewBox.y + f.viewBox.h / 2).toBeCloseTo(26 + drawingH / 2, 1);
    expect(f.viewBox.w / f.viewBox.h).toBeCloseTo(277 / 190, 3);
  });
  it('reports the smallest text size and legibility', () => {
    const sheet = sheetFor('A4', 'portrait', 10);
    const small = fitToSheet({ x: 0, y: 0, w: 200, h: 100 }, sheet);
    expect(small.smallestTextPt).toBeGreaterThan(LEGIBILITY_PT);
    const huge = fitToSheet({ x: 0, y: 0, w: 20000, h: 4000 }, sheet);
    expect(huge.smallestTextPt).toBeLessThan(LEGIBILITY_PT);
    expect(isLegible(huge.smallestTextPt)).toBe(false);
    expect(smallestTextAt(1)).toBe(11.25);
  });
});

describe('tiling', () => {
  it('splits a drawing into sheets at 100 % with overlap and numbers them row by row', () => {
    const sheet = sheetFor('A4', 'portrait', 10);
    const bounds = { x: 0, y: 0, w: 2000, h: 1000 };
    const t = tile(bounds, sheet, 1, 10);
    // printable area 190 x 277 mm = 718 x 1047 px; the drawing is 2048 x 1048 px incl. padding
    expect(t.cols).toBe(3);
    expect(t.rows).toBe(2);
    expect(t.tiles).toHaveLength(6);
    expect(t.tiles[0]).toMatchObject({ index: 1, col: 0, row: 0 });
    expect(t.tiles[3]).toMatchObject({ index: 4, col: 0, row: 1 });
    const step = t.tiles[1]!.viewBox.x - t.tiles[0]!.viewBox.x;
    expect(t.tiles[0]!.viewBox.w - step).toBeCloseTo(mmToPx(10), 3);
    const last = t.tiles[t.tiles.length - 1]!;
    expect(last.viewBox.x + last.viewBox.w).toBeGreaterThanOrEqual(2000 + 24);
    expect(last.viewBox.y + last.viewBox.h).toBeGreaterThanOrEqual(1000 + 24);
  });
  it('a smaller scale needs fewer sheets and the count helper agrees', () => {
    const sheet = sheetFor('A3', 'landscape', 10);
    const bounds = { x: 0, y: 0, w: 3000, h: 1500 };
    expect(sheetCount(bounds, sheet, 1, 10)).toBeGreaterThan(sheetCount(bounds, sheet, 0.5, 10));
    expect(sheetCount({ x: 0, y: 0, w: 100, h: 100 }, sheet, 1, 10)).toBe(1);
    expect(MAX_SHEETS).toBe(60);
  });
});

describe('png cap', () => {
  it('computes pixel sizes and refuses more than 8000 px on the long edge', () => {
    expect(pngSize(297, 210, 300)).toEqual({ width: 3508, height: 2480, allowed: true });
    expect(pngSize(841, 594, 600).allowed).toBe(false);
    expect(pngSize(841, 594, 600).width).toBeGreaterThan(PNG_MAX_EDGE);
    expect(pngSize(841, 594, 150).allowed).toBe(true);
  });
});

describe('font chunks', () => {
  it('selects only the chunks the text needs, per weight', () => {
    expect(chunksFor('Karl Weber 1878', [400, 700]).map((c) => `${c.weight}/${c.range}`)).toEqual(['400/latin', '700/latin']);
    expect(chunksFor('Großmann † 1930', [700]).map((c) => `${c.weight}/${c.range}`)).toEqual(['700/latin', '700/latin-ext']);
    expect(chunksFor('Łódź', [400]).map((c) => c.range)).toEqual(['latin', 'latin-ext']);
    expect(chunksFor('', [400])).toEqual([]);
  });
  it('builds @font-face rules with base64 data', async () => {
    const css = await fontFaceCss(chunksFor('abc', [400]), () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer));
    expect(css).toContain('font-weight:400');
    expect(css).toContain('data:font/woff2;base64,AQID');
    expect(css).toContain('unicode-range:U+0000-00FF');
    expect(toBase64(new Uint8Array([255, 0, 128]).buffer)).toBe('/wCA');
  });
  it('reports the size the fonts actually add to the file, not the raw bytes', async () => {
    // 3000 raw bytes embed as 4000 base64 characters; the warning threshold is about the file.
    const { bytes, css } = await fontFaceCssWithSize(chunksFor('abc', [400]), () => Promise.resolve(new Uint8Array(3000).buffer));
    expect(bytes).toBe(4000);
    expect(css.length).toBeGreaterThan(bytes);
  });
});
