/** PNG export sizes: dpi choice with a hard cap on the longer edge. */
export const PNG_DPIS = [150, 300, 600] as const;
export type PngDpi = (typeof PNG_DPIS)[number];
export const PNG_MAX_EDGE = 8000;

export interface PngSize {
  width: number;
  height: number;
  /** false when the longer edge would exceed the cap. */
  allowed: boolean;
}

export function pngSize(sheetWmm: number, sheetHmm: number, dpi: PngDpi): PngSize {
  const width = Math.round((sheetWmm / 25.4) * dpi);
  const height = Math.round((sheetHmm / 25.4) * dpi);
  return { width, height, allowed: Math.max(width, height) <= PNG_MAX_EDGE };
}

/** Render an SVG document string to a PNG blob at the given pixel size (browser only). */
export async function svgToPngBlob(svgText: string, width: number, height: number): Promise<Blob> {
  if (Math.max(width, height) > PNG_MAX_EDGE) throw new Error('png-too-large');
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('svg-load-failed'));
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-canvas');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('png-encode-failed');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
