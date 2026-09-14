/**
 * East Asian fonts (Noto Sans JP / KR / SC, OFL) are not part of the initial payload: their
 * stylesheets are injected only when the language is Japanese, Korean or Chinese, or when the
 * open tree contains such text. Each stylesheet declares ~120 unicode-range chunks per weight, so
 * the browser fetches only the glyph ranges the page actually shows. The preferred family goes
 * first in the font stack so shared Han ideographs take the right regional form.
 */
import { create } from 'zustand';

export type CjkFamily = 'jp' | 'kr' | 'sc';
export const CJK_FAMILY_NAME: Record<CjkFamily, string> = { jp: 'Noto Sans JP', kr: 'Noto Sans KR', sc: 'Noto Sans SC' };
const BASE_STACK = '"Atkinson Hyperlegible", "Source Sans 3", "Segoe UI", system-ui, sans-serif';

interface FontState {
  /** Bumped whenever a web font finished loading, so measured text is laid out again. */
  version: number;
  preferred: CjkFamily | null;
  loaded: CjkFamily[];
}
export const useFontState = create<FontState>(() => ({ version: 0, preferred: null, loaded: [] }));

/** The font stack with the preferred East Asian family first. */
export function fontStack(preferred: CjkFamily | null = useFontState.getState().preferred): string {
  const order: CjkFamily[] = preferred ? [preferred, ...(['jp', 'kr', 'sc'] as CjkFamily[]).filter((f) => f !== preferred)] : ['jp', 'kr', 'sc'];
  return `"Atkinson Hyperlegible Next", ${order.map((f) => `"${CJK_FAMILY_NAME[f]}"`).join(', ')}, ${BASE_STACK}`;
}

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/u;
const KANA = /[぀-ヿㇰ-ㇿ]/u;
const HAN = /[㐀-䶿一-鿿豈-﫿]/u;

/** Which East Asian families a text needs; Han alone goes to `hanDefault` (the language's family). */
export function cjkFamiliesIn(text: string, hanDefault: CjkFamily = 'sc'): CjkFamily[] {
  const out = new Set<CjkFamily>();
  if (HANGUL.test(text)) out.add('kr');
  if (KANA.test(text)) out.add('jp');
  if (HAN.test(text) && out.size === 0) out.add(hanDefault);
  return [...out];
}

export function hasCjk(text: string): boolean {
  return HANGUL.test(text) || KANA.test(text) || HAN.test(text);
}

const base = () => (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.BASE_URL : '/');

/** Inject a family's stylesheet once. */
export function ensureCjkFamily(family: CjkFamily): void {
  if (typeof document === 'undefined') return;
  const id = `cjk-font-${family}`;
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `${base()}fonts/cjk-${family}.css`;
    document.head.appendChild(link);
  }
  const s = useFontState.getState();
  if (!s.loaded.includes(family)) useFontState.setState({ loaded: [...s.loaded, family] });
}

/** The language's own family becomes the preferred one and is loaded up front. */
export function setPreferredCjk(preferred: CjkFamily | null): void {
  if (useFontState.getState().preferred !== preferred) useFontState.setState({ preferred });
  if (preferred) ensureCjkFamily(preferred);
  if (typeof document !== 'undefined') document.documentElement.style.setProperty('--font', fontStack(preferred));
}

/** Called with the text of the open tree: loads whatever families its names need. */
export function ensureCjkFor(text: string): void {
  for (const f of cjkFamiliesIn(text, useFontState.getState().preferred ?? 'sc')) ensureCjkFamily(f);
}

// A finished font load changes text widths: bump the version so cards are measured again.
if (typeof document !== 'undefined' && 'fonts' in document) {
  document.fonts.addEventListener('loadingdone', () => useFontState.setState((s) => ({ version: s.version + 1 })));
}
