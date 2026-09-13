/** Viewport maths: pan/zoom transform, fit-to-bounds, zoom around a point. Pure. */
import type { Box } from './geometry';

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 3;

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** Zoom so that the screen point (sx, sy) stays fixed. */
export function zoomAt(v: Viewport, factor: number, sx: number, sy: number): Viewport {
  const zoom = clampZoom(v.zoom * factor);
  const k = zoom / v.zoom;
  return { zoom, x: sx - (sx - v.x) * k, y: sy - (sy - v.y) * k };
}

/** Fit `bounds` (world units) into a screen of `width`×`height` with `padding` px. */
export function fitTo(bounds: Box | null, width: number, height: number, padding = 40): Viewport {
  if (!bounds || bounds.w === 0 || bounds.h === 0 || width <= 0 || height <= 0) return { x: padding, y: padding, zoom: 1 };
  const zoom = clampZoom(Math.min((width - 2 * padding) / bounds.w, (height - 2 * padding) / bounds.h, 1.5));
  return {
    zoom,
    x: (width - bounds.w * zoom) / 2 - bounds.x * zoom,
    y: (height - bounds.h * zoom) / 2 - bounds.y * zoom,
  };
}

/** Pan so that the world point is centred. */
export function centerOn(v: Viewport, wx: number, wy: number, width: number, height: number): Viewport {
  return { zoom: v.zoom, x: width / 2 - wx * v.zoom, y: height / 2 - wy * v.zoom };
}

export function toWorld(v: Viewport, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - v.x) / v.zoom, y: (sy - v.y) / v.zoom };
}

export function snap(n: number, grid: number): number {
  return Math.round(n / grid) * grid;
}
