/**
 * Fit-to-one-page scaling: fit a bounding box (SVG user units = CSS px) into the printable
 * area via the viewBox, never CSS transforms. Also the legibility check.
 */
import type { Box } from '@/render/geometry';
import { card } from '@/design/tokens';
import { mmToPx, pxToPt } from './paper';
import type { Sheet } from './paper';

export interface FitResult {
  /** Scale factor applied to the drawing (1 = 100 %). */
  scale: number;
  /** viewBox in user units that maps exactly onto the printable area (drawing centred). */
  viewBox: { x: number; y: number; w: number; h: number };
  /** Printable area in px. */
  areaPx: { w: number; h: number };
  /** Smallest text on the cards after scaling, in pt. */
  smallestTextPt: number;
}

/** Padding around the drawing inside the printable area, in user units. */
export const DRAWING_PAD = 24;
/** Below this the print is considered illegible. */
export const LEGIBILITY_PT = 6;

export function fitToSheet(bounds: Box, sheet: Sheet, headerPx = 0): FitResult {
  const areaPx = { w: mmToPx(sheet.areaW), h: mmToPx(sheet.areaH) - headerPx };
  const w = bounds.w + 2 * DRAWING_PAD, h = bounds.h + 2 * DRAWING_PAD;
  const scale = Math.min(areaPx.w / w, areaPx.h / h);
  const vbW = areaPx.w / scale, vbH = areaPx.h / scale;
  const viewBox = { x: bounds.x - DRAWING_PAD - (vbW - w) / 2, y: bounds.y - DRAWING_PAD - (vbH - h) / 2, w: vbW, h: vbH };
  return { scale, viewBox, areaPx, smallestTextPt: pxToPt(card.secondary.size * scale) };
}

/** Smallest text at an explicit scale (tiling mode). */
export function smallestTextAt(scale: number): number {
  return pxToPt(card.secondary.size * scale);
}

export function isLegible(pt: number): boolean {
  return pt >= LEGIBILITY_PT;
}
