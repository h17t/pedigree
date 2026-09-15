/**
 * The colour behind a card, derived from a colour the user picked.
 *
 * A picked colour is kept as picked — a proper, saturated colour, which is what a colour control
 * should show — and toned down here into a whisper behind the card: its hue and (clamped)
 * saturation with the lightness set to a band that keeps the text readable. The band differs by
 * theme, which is also how one stored choice can serve both: pale on paper, deep on a dark screen.
 *
 * The bands are chosen so that, for every hue and saturation, ink keeps at least 12:1 on a light
 * tint and 8:1 on a dark one, slate at least 4.5:1 on either, and the tint is never so close to
 * the paper that it cannot be seen. `tests/unit/tint.test.ts` sweeps all 360 hues to hold this.
 */

export interface TintBand {
  /** Where the lightness starts. */
  lightness: number;
  /** Saturation is clamped here, so no pick can shout. */
  maxSaturation: number;
  /** Lightness moves by this much per step while the tint is still too close to the paper. */
  step: number;
  /** As far as the lightness may move. */
  limit: number;
  /** Smallest contrast against the paper that still reads as a tint. */
  minAgainstPaper: number;
  paper: string;
}

export const TINT_BANDS: Record<'light' | 'dark', TintBand> = {
  light: { lightness: 0.955, maxSaturation: 0.85, step: -0.005, limit: 0.9, minAgainstPaper: 1.045, paper: '#FFFFFF' },
  dark: { lightness: 0.19, maxSaturation: 0.45, step: 0.01, limit: 0.3, minAgainstPaper: 1.12, paper: '#1E262E' },
};

/** The colours a new tree starts with: the pedigree convention, but only a suggestion. */
export const DEFAULT_TINTS = { male: '#2F6FB5', female: '#C2456B', diverse: '#6A4FC2' } as const;

export const isHexColour = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const toHex = (rgb: Rgb) => `#${rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

function toHsl(rgb: Rgb): [number, number, number] {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function toRgbFromHsl(h: number, s: number, l: number): Rgb {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    const x = (t + 1) % 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
}

const channelLuminance = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map(channelLuminance) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, the larger over the smaller. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The card colour for a picked colour, in the given theme. An unreadable or missing value falls
 * back to the paper, so a hand-edited file can never make a card illegible.
 */
export function tintFor(picked: string, dark = false): string {
  const band = TINT_BANDS[dark ? 'dark' : 'light'];
  if (!isHexColour(picked)) return band.paper;
  const [h, s] = toHsl(toRgb(picked));
  const saturation = Math.min(s, band.maxSaturation);
  let lightness = band.lightness;
  for (let i = 0; i < 60; i++) {
    const hex = toHex(toRgbFromHsl(h, saturation, lightness));
    // Too close to the paper to be seen: move the lightness away from it and look again.
    if (contrast(hex, band.paper) >= band.minAgainstPaper) return hex;
    lightness += band.step;
    if (band.step > 0 ? lightness > band.limit : lightness < band.limit) break;
  }
  return toHex(toRgbFromHsl(h, saturation, band.limit));
}
