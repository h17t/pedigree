import { describe, expect, it } from 'vitest';
import { contrast, DEFAULT_TINTS, isHexColour, luminance, TINT_BANDS, tintFor } from '@/design/tint';
import { color, darkColor } from '@/design/tokens';

/** Every hue, at saturations from grey to full. */
const picks = (): string[] => {
  const out: string[] = [];
  for (let h = 0; h < 360; h += 1) {
    for (const s of [0, 0.1, 0.3, 0.6, 1]) {
      // HSL → a hex to hand in, built the long way so the test does not reuse the code it checks.
      const c = (1 - Math.abs(2 * 0.5 - 1)) * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = 0.5 - c / 2;
      const [r, g, b] =
        h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
      out.push(`#${[r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`);
    }
  }
  return out;
};

describe('tints derived from a picked colour', () => {
  it('keeps the text readable on every hue, in both themes', () => {
    for (const pick of picks()) {
      const light = tintFor(pick, false);
      expect(contrast(light, color.ink)).toBeGreaterThanOrEqual(12);
      expect(contrast(light, color.slate)).toBeGreaterThanOrEqual(4.5);
      const dark = tintFor(pick, true);
      expect(contrast(dark, darkColor.ink)).toBeGreaterThanOrEqual(8);
      expect(contrast(dark, darkColor.slate)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('stays a whisper, but never so faint that it cannot be seen', () => {
    for (const pick of picks()) {
      const light = contrast(tintFor(pick, false), TINT_BANDS.light.paper);
      expect(light).toBeGreaterThanOrEqual(TINT_BANDS.light.minAgainstPaper);
      expect(light).toBeLessThan(1.45);
      const dark = contrast(tintFor(pick, true), TINT_BANDS.dark.paper);
      expect(dark).toBeGreaterThanOrEqual(TINT_BANDS.dark.minAgainstPaper);
      expect(dark).toBeLessThan(2);
    }
  });

  it('keeps the hue that was picked: a blue pick stays blue, a red one red', () => {
    const blue = tintFor('#2F6FB5');
    expect(luminance(blue)).toBeGreaterThan(0.5);
    const [blueR, blueB] = [1, 5].map((i) => parseInt(blue.slice(i, i + 2), 16));
    expect(blueB!).toBeGreaterThan(blueR!);
    const red = tintFor('#C2456B');
    const [redR, redB] = [1, 5].map((i) => parseInt(red.slice(i, i + 2), 16));
    expect(redR!).toBeGreaterThan(redB!);
  });

  it('is light on paper and deep on a dark screen, from the same pick', () => {
    for (const pick of Object.values(DEFAULT_TINTS)) {
      expect(luminance(tintFor(pick, false))).toBeGreaterThan(0.7);
      expect(luminance(tintFor(pick, true))).toBeLessThan(0.1);
    }
  });

  it('falls back to the paper when the stored value is not a colour', () => {
    expect(isHexColour('#ABCDEF')).toBe(true);
    expect(isHexColour('red')).toBe(false);
    expect(tintFor('nonsense')).toBe(TINT_BANDS.light.paper);
    expect(tintFor('#xyzxyz', true)).toBe(TINT_BANDS.dark.paper);
  });
});
