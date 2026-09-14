/**
 * Builds standalone SVG documents (tree, timeline, statistics sheets) with the same card
 * component as the screen, an optional header (title, subtitle, date), a legend, and the
 * embedded font CSS. Uses React's static renderer so screen and print never diverge.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Position, Project } from '@/model/types';
import { personName } from '@/model/types';
import { color, card, tagColor, tagPattern } from '@/design/tokens';
import type { TagColor } from '@/design/tokens';
import { PersonCard } from '@/render/PersonCard';
import { UnionNode } from '@/render/UnionNode';
import { Connectors } from '@/render/Connectors';
import { Defs } from '@/render/Defs';
import { cardBox, cardText } from '@/render/geometry';
import { personScales, minScaleOf } from '@/render/layout/scale';
import type { Box, DetailLevel } from '@/render/geometry';
import { routeUnions } from '@/render/connectors';
import type { Locale } from '@/i18n';
import { computeTimeline, sortBars } from '@/timeline/timeline';
import { computeStatistics } from '@/timeline/statistics';
import { chunksFor, cjkChunksFor, fontFaceCssWithSize } from './fonts';
import type { CjkChunkTable } from './fonts';
import { cjkFamiliesIn, fontStack, useFontState } from '@/design/cjkFonts';
import type { FontWeight } from './fonts';

export interface Header {
  title: string;
  subtitle: string;
  date: string;
}

export interface LegendLine {
  kind: 'marriage' | 'divorced' | 'dashed' | 'plain' | 'biological' | 'adopted' | 'step' | 'text' | 'swatch';
  text: string;
  /** For 'swatch': the colour group's colour. */
  color?: TagColor;
}

export interface TreeSvgOptions {
  project: Project;
  positions: Map<string, Position>;
  visible: Set<string>;
  level: DetailLevel;
  locale: Locale;
  labels: { née: string; living: string; unknownDate: string; warning: string; private: string; unknownParents: string };
  header: Header | null;
  legend: LegendLine[] | null;
  blackAndWhite: boolean;
  /** Chart mode: extra lines and, for a pedigree, no partnership routing. */
  lines?: { d: string }[];
  useUnions?: boolean;
}

export const HEADER_H = 72;
export const LEGEND_H = 64;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Everything drawn for the tree: the group markup and its bounding box (user units). */
export function treeContent(o: TreeSvgOptions): { markup: string; bounds: Box; text: string; minScale: number } {
  const boxes = new Map<string, Box>();
  const scales = personScales(o.project, o.project.settings.generationScaling ?? 'off');
  for (const id of o.visible) {
    const p = o.positions.get(id);
    if (p) boxes.set(id, cardBox(p.x, p.y, o.level, true, scales.get(id) ?? 1));
  }
  const unions = o.useUnions === false ? [] : routeUnions({ project: o.project, boxes, visible: o.visible });
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of boxes.values()) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  for (const u of unions) {
    if (u.unknownParents) {
      minX = Math.min(minX, u.cx - 60);
      minY = Math.min(minY, u.cy - 16);
    }
  }
  const bounds: Box = Number.isFinite(minX) ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : { x: 0, y: 0, w: 1, h: 1 };
  const labels = { née: o.labels.née, living: o.labels.living, unknownDate: o.labels.unknownDate, warning: o.labels.warning, private: o.labels.private };
  let text = '';
  const cards = [...boxes.entries()].map(([id, b]) => {
    const person = o.project.persons[id]!;
    const ct = cardText(person, o.level, o.locale, true, labels);
    text += ct.nameLines.join(' ') + ct.lines.join(' ') + ct.noteLines.join(' ');
    return createElement(PersonCard, { key: id, person, x: b.x, y: b.y, level: o.level, locale: o.locale, selected: false, hasWarning: false, print: true, blackAndWhite: o.blackAndWhite, scale: scales.get(id) ?? 1, group: person.groupId ? (o.project.groups.find((g) => g.id === person.groupId) ?? null) : null, ariaLabel: personName(person), labels });
  });
  const markup = renderToStaticMarkup(
    createElement('g', null, o.lines && o.lines.length ? createElement('g', { fill: 'none', stroke: color.ink, strokeWidth: 2 }, ...o.lines.map((l, i) => createElement('path', { key: `cl${i}`, d: l.d }))) : null, createElement(Connectors, { unions, background: color.paper }), ...unions.map((u) => createElement(UnionNode, { key: u.unionId, cx: u.cx, cy: u.cy, unknownParents: u.unknownParents, label: o.labels.unknownParents })), ...cards),
  );
  text += o.labels.unknownParents;
  return { markup, bounds, text, minScale: minScaleOf(scales, boxes.keys()) };
}

/** Header (title, subtitle, date) as SVG markup, in a `w`-wide strip at the top of the area. */
export function headerMarkup(h: Header, w: number): string {
  const parts: string[] = [];
  if (h.title) parts.push(`<text x="0" y="26" font-size="26" font-weight="700" fill="${color.ink}">${esc(h.title)}</text>`);
  if (h.subtitle) parts.push(`<text x="0" y="50" font-size="15" fill="${color.slate}">${esc(h.subtitle)}</text>`);
  if (h.date) parts.push(`<text x="${w}" y="50" font-size="13" fill="${color.slate}" text-anchor="end">${esc(h.date)}</text>`);
  parts.push(`<line x1="0" x2="${w}" y1="${HEADER_H - 10}" y2="${HEADER_H - 10}" stroke="${color.rule}" stroke-width="1"/>`);
  return `<g>${parts.join('')}</g>`;
}

/** Legend as SVG markup: line samples and text, wrapped into columns. */
/** Height of the legend block for a given width (items flow into rows, never overlapping). */
export function legendHeight(lines: LegendLine[], w: number): number {
  return legendLayout(lines, w).rows * 22 + 12;
}

function legendLayout(lines: LegendLine[], w: number): { items: { x: number; y: number }[]; rows: number } {
  const items: { x: number; y: number }[] = [];
  let x = 0, row = 0;
  const gap = 28;
  for (const l of lines) {
    const width = (l.kind === 'text' ? 0 : 48) + l.text.length * 6.6;
    if (x > 0 && x + width > w) {
      x = 0;
      row++;
    }
    items.push({ x, y: row * 22 + 14 });
    x += width + gap;
  }
  return { items, rows: row + 1 };
}

export function legendMarkup(lines: LegendLine[], w: number, bw = false): string {
  const { items } = legendLayout(lines, w);
  const parts: string[] = [];
  lines.forEach((l, i) => {
    const cx = items[i]!.x, cy = items[i]!.y;
    let sample = '';
    switch (l.kind) {
      case 'marriage':
        sample = `<line x1="${cx}" x2="${cx + 40}" y1="${cy}" y2="${cy}" stroke="${color.ink}" stroke-width="8"/><line x1="${cx}" x2="${cx + 40}" y1="${cy}" y2="${cy}" stroke="${color.paper}" stroke-width="4"/>`;
        break;
      case 'divorced':
        sample = `<line x1="${cx}" x2="${cx + 40}" y1="${cy}" y2="${cy}" stroke="${color.ink}" stroke-width="8"/><line x1="${cx}" x2="${cx + 40}" y1="${cy}" y2="${cy}" stroke="${color.paper}" stroke-width="4"/><path d="M${cx + 12} ${cy + 9} l7 -18 M${cx + 22} ${cy + 9} l7 -18" stroke="${color.ink}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
        break;
      case 'dashed':
      case 'adopted':
        sample = `<line x1="${cx}" x2="${cx + 40}" y1="${cy}" y2="${cy}" stroke="${color.ink}" stroke-width="2" stroke-dasharray="8 6"/>`;
        break;
      case 'step':
        sample = `<line x1="${cx}" x2="${cx + 40}" y1="${cy}" y2="${cy}" stroke="${color.ink}" stroke-width="2" stroke-dasharray="2 5" stroke-linecap="round"/>`;
        break;
      case 'plain':
      case 'biological':
        sample = `<line x1="${cx}" x2="${cx + 40}" y1="${cy}" y2="${cy}" stroke="${color.ink}" stroke-width="2"/>`;
        break;
      case 'swatch':
        sample = `<rect x="${cx + 10}" y="${cy - 8}" width="20" height="16" rx="2" fill="${color.paper}" stroke="${color.ink}" stroke-width="1"/><rect x="${cx + 11}" y="${cy - 7}" width="5" height="14" fill="${l.color ? (bw ? `url(#pat-${tagPattern[l.color]})` : tagColor[l.color]) : color.ink}"/>`;
        break;
      default:
        sample = '';
    }
    parts.push(`${sample}<text x="${cx + (l.kind === 'text' ? 0 : 48)}" y="${cy + 4}" font-size="12" fill="${color.ink}">${esc(l.text)}</text>`);
  });
  return `<g>${parts.join('')}</g>`;
}

export interface SvgDocOptions {
  /** Physical size in mm (the SVG's width/height attributes). */
  widthMm: number;
  heightMm: number;
  /** viewBox in drawing units for the content area. */
  viewBox: { x: number; y: number; w: number; h: number };
  /** Content markup positioned in drawing units. */
  content: string;
  /** Extra markup drawn in *sheet* units (px of the printable area), e.g. header/legend/crop marks. */
  overlay?: string;
  fontCss: string;
  title?: string;
}

/**
 * Compose the final SVG. The content sits in a nested <svg> mapped to the printable area via
 * its viewBox (never CSS transforms); header/legend/crop marks sit in sheet pixel units.
 */
export function svgDocument(o: SvgDocOptions & { areaPx: { w: number; h: number }; marginPx: number; headerPx: number; legendPx: number; sheetPx: { w: number; h: number } }): string {
  const contentY = o.marginPx + o.headerPx;
  const contentH = o.areaPx.h - o.headerPx - o.legendPx;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${o.widthMm}mm" height="${o.heightMm}mm" viewBox="0 0 ${o.sheetPx.w} ${o.sheetPx.h}" font-family='${fontStack().replace(/"/g, '')}, Arial'>`,
    o.title ? `<title>${esc(o.title)}</title>` : '',
    `<style>${o.fontCss}</style>`,
    `<rect width="${o.sheetPx.w}" height="${o.sheetPx.h}" fill="${color.paper}"/>`,
    `<svg x="${o.marginPx}" y="${contentY}" width="${o.areaPx.w}" height="${contentH}" viewBox="${o.viewBox.x} ${o.viewBox.y} ${o.viewBox.w} ${o.viewBox.h}" preserveAspectRatio="xMidYMid meet">${renderToStaticMarkup(createElement(Defs, { ink: color.ink }))}${o.content}</svg>`,
    o.overlay ?? '',
    '</svg>',
  ].join('');
}

/** Embedded fonts adding more than this to the file make an SVG unwieldy; the dialog then suggests PNG.
 *  Measured as written, i.e. after base64 (see `fontFaceCssWithSize`). */
export const LARGE_FONT_BYTES = 5 * 1024 * 1024;

/**
 * Font CSS for a text sample, loading chunk files relative to the app base path. East Asian
 * text adds only the Noto chunks its characters fall into (the table is fetched on demand).
 */
export async function fontsFor(text: string, weights: FontWeight[], base: string): Promise<{ css: string; bytes: number }> {
  const load = async (file: string) => {
    const res = await fetch(`${base}${file}`);
    return res.arrayBuffer();
  };
  const chunks = chunksFor(text, weights);
  const families = cjkFamiliesIn(text, useFontState.getState().preferred ?? 'sc');
  if (families.length) {
    const table = (await (await fetch(`${base}fonts/cjk-chunks.json`)).json()) as CjkChunkTable;
    chunks.push(...cjkChunksFor(text, weights, families, table));
  }
  return fontFaceCssWithSize(chunks, load);
}

// ---- Timeline sheet ----------------------------------------------------------------------

export function timelineContent(project: Project, locale: Locale, labels: { unnamed: string }): { markup: string; bounds: Box; text: string } {
  const data = computeTimeline(project);
  const bars = sortBars(data.bars, 'birth', project);
  const ROW = 24, LABEL_W = 200, PX = 6;
  const years = Math.max(1, data.maxYear - data.minYear);
  const w = LABEL_W + years * PX + 60;
  const h = 30 + bars.length * ROW + 10;
  const x = (y: number) => LABEL_W + (y - data.minYear) * PX;
  const parts: string[] = [];
  let text = '';
  for (let y = data.minYear; y <= data.maxYear; y += 10) {
    parts.push(`<line x1="${x(y)}" x2="${x(y)}" y1="24" y2="${h - 6}" stroke="${color.ground}" stroke-width="1"/><text x="${x(y)}" y="16" font-size="11" fill="${color.slate}" text-anchor="middle">${y}</text>`);
  }
  bars.forEach((b, i) => {
    const p = project.persons[b.personId]!;
    const y = 30 + i * ROW;
    const name = personName(p) || labels.unnamed;
    const yearsText = cardText(p, 'minimal', locale).lines[0] ?? '';
    text += name + yearsText;
    const stroke = b.kind === 'living' ? color.line : color.ink;
    const bar = b.kind === 'unknownEnd' ? `<rect x="${x(b.start)}" y="${y + 6}" width="${Math.max(3, (b.end - b.start) * PX)}" height="12" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.6"/>` : `<rect x="${x(b.start)}" y="${y + 6}" width="${Math.max(3, (b.end - b.start) * PX)}" height="12" fill="${stroke}" rx="2"/>`;
    parts.push(`<text x="${LABEL_W - 8}" y="${y + 16}" font-size="12" fill="${color.ink}" text-anchor="end">${esc(name.length > 30 ? name.slice(0, 29) + '…' : name)}</text>${bar}<text x="${x(b.end) + 6}" y="${y + 16}" font-size="10" fill="${color.slate}">${esc(yearsText)}</text>`);
  });
  return { markup: `<g>${parts.join('')}</g>`, bounds: { x: 0, y: 0, w, h }, text };
}

// ---- Statistics sheet --------------------------------------------------------------------

export function statisticsContent(project: Project, locale: Locale, L: Record<string, string>): { markup: string; bounds: Box; text: string } {
  const s = computeStatistics(project, 8);
  const W = 800;
  const parts: string[] = [];
  let y = 0;
  let text = '';
  const line = (t: string, size = 13, weight = 400, fill: string = color.ink) => {
    parts.push(`<text x="0" y="${(y += size + 6)}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(t)}</text>`);
    text += t;
  };
  const basis = (base: number, total: number) => `${L.basis ?? 'Basis'}: ${base} / ${total}`;
  line(`${L.people}: ${s.people}   ${L.unions}: ${s.unions}   ${L.generations}: ${s.generations}`, 16, 700);
  y += 6;
  const section = (title: string, rows: [string, string][], b: string) => {
    y += 10;
    line(title, 15, 700);
    line(b, 11, 400, color.slate);
    for (const [k, v] of rows) line(`${k}: ${v}`, 12);
  };
  section(L.ageAtDeath ?? 'Age at death', s.ageAtDeath.value.filter((x) => x.count > 0).map((x) => [x.label, String(x.count)]), basis(s.ageAtDeath.base, s.ageAtDeath.total));
  section(L.lifeExpectancy ?? 'Life expectancy', s.lifeExpectancyByDecade.value.map((d) => [String(d.decade), `${d.all?.mean ?? '-'} (${d.all?.n ?? 0})`]), basis(s.lifeExpectancyByDecade.base, s.lifeExpectancyByDecade.total));
  section(L.childrenPerUnion ?? 'Children per partnership', s.childrenPerUnion.value.filter((x) => x.count > 0).map((x) => [x.label, String(x.count)]), basis(s.childrenPerUnion.base, s.childrenPerUnion.total));
  section(L.givenNames ?? 'Given names', s.givenNames.value.map((x) => [x.label, String(x.count)]), basis(s.givenNames.base, s.givenNames.total));
  section(L.surnames ?? 'Surnames', s.surnames.value.map((x) => [x.label, String(x.count)]), basis(s.surnames.base, s.surnames.total));
  section(L.occupations ?? 'Occupations', s.occupations.value.map((x) => [x.label, String(x.count)]), basis(s.occupations.base, s.occupations.total));
  section(L.places ?? 'Places', s.places.value.map((x) => [x.label, String(x.count)]), basis(s.places.base, s.places.total));
  void locale;
  return { markup: `<g>${parts.join('')}</g>`, bounds: { x: 0, y: 0, w: W, h: y + 10 }, text };
}

export const CARD_FONT_WEIGHTS: FontWeight[] = [card.name.weight, card.secondary.weight, 500] as FontWeight[];
