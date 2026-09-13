/**
 * Poster mode: keep a chosen scale and split the drawing across several sheets with an
 * overlap, crop marks and an assembly diagram. Maths in user units (px) and mm.
 */
import type { Box } from '@/render/geometry';
import { mmToPx } from './paper';
import type { Sheet } from './paper';
import { DRAWING_PAD } from './scale';

export interface Tile {
  index: number;
  col: number;
  row: number;
  /** viewBox of this sheet in drawing units. */
  viewBox: { x: number; y: number; w: number; h: number };
}

export interface Tiling {
  cols: number;
  rows: number;
  tiles: Tile[];
  areaPx: { w: number; h: number };
  overlapPx: number;
  scale: number;
  drawing: Box;
}

export const MAX_SHEETS = 60;

export function tile(bounds: Box, sheet: Sheet, scale: number, overlapMm: number, headerPx = 0): Tiling {
  const areaPx = { w: mmToPx(sheet.areaW), h: mmToPx(sheet.areaH) - headerPx };
  const drawing: Box = { x: bounds.x - DRAWING_PAD, y: bounds.y - DRAWING_PAD, w: bounds.w + 2 * DRAWING_PAD, h: bounds.h + 2 * DRAWING_PAD };
  const stepW = areaPx.w / scale, stepH = areaPx.h / scale;
  const overlap = mmToPx(overlapMm) / scale;
  const advanceW = Math.max(1, stepW - overlap), advanceH = Math.max(1, stepH - overlap);
  const cols = Math.max(1, Math.ceil((drawing.w - overlap) / advanceW));
  const rows = Math.max(1, Math.ceil((drawing.h - overlap) / advanceH));
  const tiles: Tile[] = [];
  let index = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push({ index: ++index, col: c, row: r, viewBox: { x: drawing.x + c * advanceW, y: drawing.y + r * advanceH, w: stepW, h: stepH } });
    }
  }
  return { cols, rows, tiles, areaPx, overlapPx: mmToPx(overlapMm), scale, drawing };
}

export function sheetCount(bounds: Box, sheet: Sheet, scale: number, overlapMm: number, headerPx = 0): number {
  const t = tile(bounds, sheet, scale, overlapMm, headerPx);
  return t.cols * t.rows;
}
