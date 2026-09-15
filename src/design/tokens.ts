/**
 * Design tokens. This file is the single source of truth: `tokens.css` mirrors these values
 * as CSS custom properties for the DOM, and the SVG renderer and the export module read them
 * from here so that on-screen, printed and exported output all agree.
 *
 * See docs/DESIGN_PLAN.md for the rationale and the contrast table.
 */

/**
 * The light palette. Print, SVG and PNG output always use these literal values; the DOM and
 * the on-screen canvas use the CSS custom properties (`cssColor`), which the theme switches.
 */
export const color = {
  ink: '#1B2733',
  slate: '#4A5A6A',
  rule: '#6F7C89',
  paper: '#FFFFFF',
  chrome: '#F3F4F2',
  ground: '#E9EEEC',
  line: '#1E6B5A',
  select: '#2456C4',
  selectBg: '#E4ECFB',
  warn: '#8A5A00',
  warnBg: '#FFF3D6',
  danger: '#A3212B',
  dangerBg: '#FBE9EA',
  lineBg: '#E2F0EC',
  // A whisper of colour behind a card, by sex. Ink keeps 13:1 on each, slate 6:1; the square /
  // circle / diamond marker carries the same information for anyone who cannot see the tint.
  tintMale: '#E8F1FA',
  tintFemale: '#FBEDF1',
  tintDiverse: '#F1EDFA',
} as const;
export type Palette = { [K in keyof typeof color]: string };

/**
 * The dark palette (same roles). Text colours keep at least 7:1 on `paper` and `chrome`,
 * `slate` at least 4.5:1, and the accent colours are lightened so they read on dark ground.
 * `tokens.css` mirrors these values under `[data-theme="dark"]`.
 */
export const darkColor: Palette = {
  ink: '#E6EBEF',
  slate: '#AEBAC6',
  rule: '#7C8996',
  paper: '#1E262E',
  chrome: '#161C22',
  ground: '#11161B',
  line: '#5FC4A8',
  select: '#8FB4FF',
  selectBg: '#23324A',
  warn: '#F2B84B',
  warnBg: '#3B2E10',
  danger: '#FF8C96',
  dangerBg: '#3F1F24',
  lineBg: '#1C3A33',
  tintMale: '#233549',
  tintFemale: '#3D2A33',
  tintDiverse: '#2E2A45',
};

/** The same roles as CSS custom properties, for everything drawn on screen. */
export const cssColor: Palette = {
  ink: 'var(--ink)',
  slate: 'var(--slate)',
  rule: 'var(--rule)',
  paper: 'var(--paper)',
  chrome: 'var(--chrome)',
  ground: 'var(--ground)',
  line: 'var(--line)',
  select: 'var(--select)',
  selectBg: 'var(--select-bg)',
  warn: 'var(--warn)',
  warnBg: 'var(--warn-bg)',
  danger: 'var(--danger)',
  dangerBg: 'var(--danger-bg)',
  lineBg: 'var(--line-bg)',
  tintMale: 'var(--tint-male)',
  tintFemale: 'var(--tint-female)',
  tintDiverse: 'var(--tint-diverse)',
};

export type Theme = 'system' | 'light' | 'dark';

/** Branch-tag colours; every tag is always rendered with a text label as well. */
export const tagColor = {
  green: '#1E6B5A',
  amber: '#8A5A00',
  plum: '#7A3E9D',
  red: '#A3212B',
  steel: '#3A6B8A',
  blue: '#2456C4',
} as const;
export type TagColor = keyof typeof tagColor;

/** Black-and-white substitutes for the tag colours (SVG pattern ids). */
export const tagPattern: Record<TagColor, 'solid' | 'hatch' | 'dots' | 'hlines' | 'cross' | 'vlines'> = {
  green: 'solid',
  amber: 'hatch',
  plum: 'dots',
  red: 'hlines',
  steel: 'cross',
  blue: 'vlines',
};

export const fontFamily =
  '"Atkinson Hyperlegible Next", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", "Atkinson Hyperlegible", "Source Sans 3", "Segoe UI", system-ui, sans-serif';

/** Type scale: [font size px, line height px, weight]. */
export const type = {
  xs: { size: 14, line: 18, weight: 400 },
  sm: { size: 15, line: 20, weight: 400 },
  base: { size: 17, line: 26, weight: 400 },
  md: { size: 19, line: 28, weight: 500 },
  lg: { size: 22, line: 30, weight: 700 },
  xl: { size: 26, line: 34, weight: 700 },
  xxl: { size: 32, line: 40, weight: 700 },
} as const;

/** Spacing scale in px. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 14: 56 } as const;

export const radius = { card: 4, control: 6, sheet: 12 } as const;

/** Minimum touch targets (CSS px). */
export const touch = { min: 48, primary: 56, gap: 8 } as const;

/**
 * Person card geometry in SVG user units (= CSS px at 100 % zoom). Fixed width, four height
 * variants. `tall` is used only by the `full` detail level in print. See DESIGN_PLAN.md §3.
 */
export const card = {
  width: 220,
  height: { minimal: 84, standard: 124, full: 164, tall: 280 } as const,
  padding: { top: 10, right: 10, bottom: 10, left: 12 },
  stripeWidth: 6,
  border: 1.5,
  radius: 4,
  name: { size: 17, line: 22, weight: 700, maxLines: 2 },
  secondary: { size: 15, line: 20, weight: 400 },
  notes: { size: 14, line: 18, weight: 400, maxLines: 4 },
  marker: 10,
} as const;
export type CardVariant = keyof typeof card.height;

/** Layout spacing on the canvas (SVG user units). */
export const layout = { grid: 20, columnGap: 40, generationGap: 80, clusterGutter: 160 } as const;
/** Gaps of the automatic arrangement per spacing setting (column gap between cards, gap between generations). */
export const spacingGaps = { compact: { columnGap: 16, generationGap: 56 }, normal: { columnGap: 40, generationGap: 80 }, wide: { columnGap: 80, generationGap: 120 } } as const;

export const motion = { fast: 120, sheet: 200, glide: 250 } as const;
