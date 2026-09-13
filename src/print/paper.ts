/** Paper sizes and printable areas. All lengths in millimetres unless named px. */
export type PaperSize = 'A5' | 'A4' | 'A3' | 'A2' | 'A1';
export type Orientation = 'portrait' | 'landscape';

/** ISO 216 sizes, portrait, in mm. */
export const PAPER: Record<PaperSize, { w: number; h: number }> = {
  A5: { w: 148, h: 210 },
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
  A2: { w: 420, h: 594 },
  A1: { w: 594, h: 841 },
};

/** CSS pixels per millimetre (96 dpi). */
export const PX_PER_MM = 96 / 25.4;
export const mmToPx = (mm: number) => mm * PX_PER_MM;
export const pxToMm = (px: number) => px / PX_PER_MM;
/** SVG user units are CSS px; 1 px = 0.75 pt. */
export const pxToPt = (px: number) => px * 0.75;

export interface Sheet {
  width: number;
  height: number;
  margin: number;
  /** Printable area in mm. */
  areaW: number;
  areaH: number;
}

export function sheetFor(size: PaperSize, orientation: Orientation, margin: number): Sheet {
  const p = PAPER[size];
  const [width, height] = orientation === 'portrait' ? [p.w, p.h] : [p.h, p.w];
  const m = Math.max(0, Math.min(margin, Math.min(width, height) / 4));
  return { width, height, margin: m, areaW: width - 2 * m, areaH: height - 2 * m };
}

/** Sizes for which a home printer driver usually has no tray: recommend SVG for a print shop. */
export const LARGE_FORMATS: PaperSize[] = ['A3', 'A2', 'A1'];
