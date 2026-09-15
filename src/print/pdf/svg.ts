/**
 * Draws the print sheets into a PDF page. The sheets are already built as standalone SVG (the
 * same markup the SVG export writes), so this walks that SVG and emits the equivalent PDF
 * operators: one drawing, one set of positions, whatever the output. Only the constructs the
 * sheets actually use are handled — rectangles, circles, lines, paths, nested viewports,
 * transforms, tiling patterns and text.
 *
 * PDF's y axis points up and SVG's points down, so the page begins with a flip; text carries
 * the flip again in its text matrix, which puts the glyphs the right way up.
 */
import type { FontMetrics } from './sfnt';
import type { EmbeddedFont, PdfPattern } from './writer';

export type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export function multiply(m: Matrix, n: Matrix): Matrix {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}

/** `translate(…)`, `scale(…)`, `rotate(…)` and `matrix(…)`, applied left to right as SVG does. */
export function parseTransform(value: string | null): Matrix {
  if (!value) return IDENTITY;
  let m: Matrix = IDENTITY;
  for (const part of value.matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g)) {
    const n = (part[2] ?? '').split(/[\s,]+/).filter(Boolean).map(Number);
    const name = part[1];
    if (name === 'translate') m = multiply(m, [1, 0, 0, 1, n[0] ?? 0, n[1] ?? 0]);
    else if (name === 'scale') m = multiply(m, [n[0] ?? 1, 0, 0, n[1] ?? n[0] ?? 1, 0, 0]);
    else if (name === 'matrix' && n.length === 6) m = multiply(m, n as Matrix);
    else if (name === 'rotate') {
      const a = ((n[0] ?? 0) * Math.PI) / 180;
      const [cos, sin] = [Math.cos(a), Math.sin(a)];
      const r: Matrix = [cos, sin, -sin, cos, 0, 0];
      // rotate(a cx cy) turns about a point, i.e. move there, turn, move back.
      m = n.length >= 3 ? multiply(multiply(multiply(m, [1, 0, 0, 1, n[1] ?? 0, n[2] ?? 0]), r), [1, 0, 0, 1, -(n[1] ?? 0), -(n[2] ?? 0)]) : multiply(m, r);
    }
  }
  return m;
}

const num = (s: string | null, fallback = 0) => {
  const v = parseFloat(s ?? '');
  return Number.isFinite(v) ? v : fallback;
};
const f = (n: number) => (Math.abs(n) < 1e-6 ? '0' : n.toFixed(4).replace(/\.?0+$/, ''));

/** `#rgb`, `#rrggbb` and the two colour words the sheets use; anything else stays unpainted. */
function colorOf(value: string | null): [number, number, number] | null {
  if (!value || value === 'none' || value === 'transparent') return null;
  const v = value.trim();
  if (v === 'white') return [1, 1, 1];
  if (v === 'black') return [0, 0, 0];
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
  if (short) return [1, 2, 3].map((i) => parseInt(short[i]!.repeat(2), 16) / 255) as [number, number, number];
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(v);
  if (long) return [1, 2, 3].map((i) => parseInt(long[i]!, 16) / 255) as [number, number, number];
  return null;
}

const patternRef = (value: string | null): string | null => /^url\(#([\w-]+)\)$/.exec(value ?? '')?.[1] ?? null;

/** A circular arc of at most 90°, as a cubic Bézier; four of them make a full circle. */
function arcSegment(cx: number, cy: number, rx: number, ry: number, from: number, to: number, rotation: number): string {
  // The control points sit along the tangent, a quarter turn's worth of it either side.
  const k = (4 / 3) * Math.tan((to - from) / 4);
  const at = (angle: number, along: number) => {
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
    const x = rx * (cos - along * sin), y = ry * (sin + along * cos);
    const [c, s] = [Math.cos(rotation), Math.sin(rotation)];
    return [cx + x * c - y * s, cy + x * s + y * c] as const;
  };
  const [x1, y1] = at(from, k);
  const [x2, y2] = at(to, -k);
  const [x, y] = at(to, 0);
  return `${f(x1)} ${f(y1)} ${f(x2)} ${f(y2)} ${f(x)} ${f(y)} c\n`;
}

/** SVG's endpoint arc, turned into Béziers (PDF has no arc operator). */
function arcTo(x0: number, y0: number, rx: number, ry: number, angle: number, largeArc: boolean, sweep: boolean, x: number, y: number): string {
  if (rx === 0 || ry === 0) return `${f(x)} ${f(y)} l\n`;
  const phi = (angle * Math.PI) / 180;
  const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
  const dx = (x0 - x) / 2, dy = (y0 - y) / 2;
  const x1 = cos * dx + sin * dy, y1 = -sin * dx + cos * dy;
  let [a, b] = [Math.abs(rx), Math.abs(ry)];
  const lambda = (x1 * x1) / (a * a) + (y1 * y1) / (b * b);
  if (lambda > 1) {
    a *= Math.sqrt(lambda);
    b *= Math.sqrt(lambda);
  }
  const denominator = a * a * y1 * y1 + b * b * x1 * x1;
  const factor = Math.sqrt(Math.max(0, (a * a * b * b - denominator) / denominator)) * (largeArc === sweep ? -1 : 1);
  const cx1 = (factor * a * y1) / b, cy1 = (-factor * b * x1) / a;
  const cx = cos * cx1 - sin * cy1 + (x0 + x) / 2;
  const cy = sin * cx1 + cos * cy1 + (y0 + y) / 2;
  const angleOf = (ux: number, uy: number) => Math.atan2(uy, ux);
  const start = angleOf((x1 - cx1) / a, (y1 - cy1) / b);
  let sweepAngle = angleOf((-x1 - cx1) / a, (-y1 - cy1) / b) - start;
  if (!sweep && sweepAngle > 0) sweepAngle -= 2 * Math.PI;
  if (sweep && sweepAngle < 0) sweepAngle += 2 * Math.PI;
  const steps = Math.ceil(Math.abs(sweepAngle) / (Math.PI / 2));
  let out = '';
  for (let i = 0; i < steps; i++) out += arcSegment(cx, cy, a, b, start + (sweepAngle * i) / steps, start + (sweepAngle * (i + 1)) / steps, phi);
  return out;
}

/** An SVG path, as PDF path-construction operators. */
export function pathOps(d: string): string {
  let out = '';
  let x = 0, y = 0, startX = 0, startY = 0;
  let lastControl: [number, number] | null = null;
  let command = '';
  const tokens = d.matchAll(/([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)/g);
  const args: number[] = [];
  const pending: { command: string; args: number[] }[] = [];
  for (const token of tokens) {
    if (token[1]) {
      if (command) pending.push({ command, args: args.splice(0) });
      command = token[1];
    } else args.push(parseFloat(token[2]!));
  }
  if (command) pending.push({ command, args: args.splice(0) });

  const step = (c: string, a: number[]) => {
    const relative = c === c.toLowerCase();
    const upper = c.toUpperCase();
    const take = (i: number, base: number) => (relative ? base + (a[i] ?? 0) : (a[i] ?? 0));
    switch (upper) {
      case 'M': {
        for (let i = 0; i < a.length; i += 2) {
          const nx = relative ? x + a[i]! : a[i]!, ny = relative ? y + a[i + 1]! : a[i + 1]!;
          // Only the first pair moves; the rest of an M run are implicit line-tos.
          out += `${f(nx)} ${f(ny)} ${i === 0 ? 'm' : 'l'}\n`;
          [x, y] = [nx, ny];
          if (i === 0) [startX, startY] = [nx, ny];
        }
        lastControl = null;
        break;
      }
      case 'L': {
        for (let i = 0; i < a.length; i += 2) {
          [x, y] = [take(i, x), take(i + 1, y)];
          out += `${f(x)} ${f(y)} l\n`;
        }
        lastControl = null;
        break;
      }
      case 'H': {
        for (const v of a) {
          x = relative ? x + v : v;
          out += `${f(x)} ${f(y)} l\n`;
        }
        lastControl = null;
        break;
      }
      case 'V': {
        for (const v of a) {
          y = relative ? y + v : v;
          out += `${f(x)} ${f(y)} l\n`;
        }
        lastControl = null;
        break;
      }
      case 'C': {
        for (let i = 0; i + 5 < a.length; i += 6) {
          const c1 = [take(i, x), take(i + 1, y)] as const;
          const c2 = [take(i + 2, x), take(i + 3, y)] as const;
          const p = [take(i + 4, x), take(i + 5, y)] as const;
          out += `${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p[0])} ${f(p[1])} c\n`;
          lastControl = [c2[0], c2[1]];
          [x, y] = [p[0], p[1]];
        }
        break;
      }
      case 'S': {
        for (let i = 0; i + 3 < a.length; i += 4) {
          const c1 = lastControl ? [2 * x - lastControl[0], 2 * y - lastControl[1]] : [x, y];
          const c2 = [take(i, x), take(i + 1, y)] as const;
          const p = [take(i + 2, x), take(i + 3, y)] as const;
          out += `${f(c1[0]!)} ${f(c1[1]!)} ${f(c2[0])} ${f(c2[1])} ${f(p[0])} ${f(p[1])} c\n`;
          lastControl = [c2[0], c2[1]];
          [x, y] = [p[0], p[1]];
        }
        break;
      }
      case 'Q':
      case 'T': {
        const stride = upper === 'Q' ? 4 : 2;
        for (let i = 0; i + stride - 1 < a.length; i += stride) {
          const q = upper === 'Q' ? ([take(i, x), take(i + 1, y)] as const) : ((lastControl ? [2 * x - lastControl[0], 2 * y - lastControl[1]] : [x, y]) as readonly [number, number]);
          const p = upper === 'Q' ? ([take(i + 2, x), take(i + 3, y)] as const) : ([take(i, x), take(i + 1, y)] as const);
          // A quadratic curve is the cubic whose controls sit two thirds of the way to it.
          out += `${f(x + (2 / 3) * (q[0] - x))} ${f(y + (2 / 3) * (q[1] - y))} ${f(p[0] + (2 / 3) * (q[0] - p[0]))} ${f(p[1] + (2 / 3) * (q[1] - p[1]))} ${f(p[0])} ${f(p[1])} c\n`;
          lastControl = [q[0], q[1]];
          [x, y] = [p[0], p[1]];
        }
        break;
      }
      case 'A': {
        for (let i = 0; i + 6 < a.length; i += 7) {
          const nx = take(i + 5, x), ny = take(i + 6, y);
          out += arcTo(x, y, a[i]!, a[i + 1]!, a[i + 2]!, a[i + 3] !== 0, a[i + 4] !== 0, nx, ny);
          [x, y] = [nx, ny];
        }
        lastControl = null;
        break;
      }
      case 'Z': {
        out += 'h\n';
        [x, y] = [startX, startY];
        lastControl = null;
        break;
      }
    }
  };
  for (const p of pending) step(p.command, p.args);
  return out;
}

/** A rectangle, rounded corners and all. */
function rectOps(x: number, y: number, w: number, h: number, r: number): string {
  if (r <= 0) return `${f(x)} ${f(y)} ${f(w)} ${f(h)} re\n`;
  const rx = Math.min(r, w / 2), ry = Math.min(r, h / 2);
  const k = 0.5523;
  return (
    `${f(x + rx)} ${f(y)} m\n` +
    `${f(x + w - rx)} ${f(y)} l\n` +
    `${f(x + w - rx + rx * k)} ${f(y)} ${f(x + w)} ${f(y + ry - ry * k)} ${f(x + w)} ${f(y + ry)} c\n` +
    `${f(x + w)} ${f(y + h - ry)} l\n` +
    `${f(x + w)} ${f(y + h - ry + ry * k)} ${f(x + w - rx + rx * k)} ${f(y + h)} ${f(x + w - rx)} ${f(y + h)} c\n` +
    `${f(x + rx)} ${f(y + h)} l\n` +
    `${f(x + rx - rx * k)} ${f(y + h)} ${f(x)} ${f(y + h - ry + ry * k)} ${f(x)} ${f(y + h - ry)} c\n` +
    `${f(x)} ${f(y + ry)} l\n` +
    `${f(x)} ${f(y + ry - ry * k)} ${f(x + rx - rx * k)} ${f(y)} ${f(x + rx)} ${f(y)} c\n` +
    'h\n'
  );
}

function circleOps(cx: number, cy: number, r: number): string {
  const k = 0.5523 * r;
  return (
    `${f(cx + r)} ${f(cy)} m\n` +
    `${f(cx + r)} ${f(cy + k)} ${f(cx + k)} ${f(cy + r)} ${f(cx)} ${f(cy + r)} c\n` +
    `${f(cx - k)} ${f(cy + r)} ${f(cx - r)} ${f(cy + k)} ${f(cx - r)} ${f(cy)} c\n` +
    `${f(cx - r)} ${f(cy - k)} ${f(cx - k)} ${f(cy - r)} ${f(cx)} ${f(cy - r)} c\n` +
    `${f(cx + k)} ${f(cy - r)} ${f(cx + r)} ${f(cy - k)} ${f(cx + r)} ${f(cy)} c\n` +
    'h\n'
  );
}

/** Chooses the font file a character belongs to; the app ships one per script and weight. */
export type FontChooser = (codePoint: number, weight: number) => { key: string; metrics: FontMetrics } | null;

interface State {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  dash: string | null;
  linecap: string | null;
  linejoin: string | null;
  fontSize: number;
  fontWeight: number;
  textAnchor: string;
}

export interface SheetOptions {
  /** The sheet's SVG (the same document the SVG export writes). */
  svg: string;
  widthPt: number;
  heightPt: number;
  chooseFont: FontChooser;
  /** Records every glyph written, so the document can embed exactly those. */
  fonts: Map<string, EmbeddedFont>;
  parse: (svg: string) => Document;
}

export interface SheetResult {
  content: string;
  fonts: string[];
  patterns: PdfPattern[];
}

/** Turns one sheet into the content stream of one page. */
export function sheetToPdf(o: SheetOptions): SheetResult {
  const doc = o.parse(o.svg);
  const root = doc.documentElement;
  // A parser that chokes hands back an error document; an empty page would hide that.
  if (root.tagName.toLowerCase() !== 'svg') throw new Error('the sheet is not an SVG document');
  const out: string[] = [];
  const usedFonts = new Set<string>();
  const patterns = new Map<string, PdfPattern>();
  const defs = new Map<string, Element>();
  for (const p of root.querySelectorAll('pattern')) if (p.id) defs.set(p.id, p);

  const viewBox = (root.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  const sheetW = viewBox.length === 4 ? viewBox[2]! : o.widthPt;
  const sheetH = viewBox.length === 4 ? viewBox[3]! : o.heightPt;
  const scale = o.widthPt / sheetW;
  // The page flip: SVG user units in, points out, y the other way up.
  const base: Matrix = [scale, 0, 0, -scale, 0, o.heightPt];

  const emit = (s: string) => out.push(s);
  const setPaint = (state: State, ctm: Matrix): { fill: boolean; stroke: boolean } => {
    const fillPattern = patternRef(state.fill);
    const fill = colorOf(state.fill);
    const stroke = colorOf(state.stroke);
    if (fillPattern) {
      const tile = registerPattern(fillPattern, ctm);
      if (tile) emit(`/Pattern cs /${tile} scn\n`);
    } else if (fill) emit(`${f(fill[0])} ${f(fill[1])} ${f(fill[2])} rg\n`);
    if (stroke) emit(`${f(stroke[0])} ${f(stroke[1])} ${f(stroke[2])} RG\n`);
    if (stroke) emit(`${f(state.strokeWidth)} w\n`);
    if (stroke && state.dash) emit(`[${state.dash.split(/[\s,]+/).filter(Boolean).join(' ')}] 0 d\n`);
    else if (stroke) emit('[] 0 d\n');
    if (state.linecap) emit(`${state.linecap === 'round' ? 1 : state.linecap === 'square' ? 2 : 0} J\n`);
    if (state.linejoin) emit(`${state.linejoin === 'round' ? 1 : state.linejoin === 'bevel' ? 2 : 0} j\n`);
    return { fill: !!fill || !!fillPattern, stroke: !!stroke };
  };
  const paintOp = (p: { fill: boolean; stroke: boolean }) => (p.fill && p.stroke ? 'B' : p.stroke ? 'S' : p.fill ? 'f' : 'n');

  /** A `<pattern>` becomes a PDF tiling pattern; its matrix carries the transform of its user. */
  const registerPattern = (id: string, ctm: Matrix): string | null => {
    const el = defs.get(id);
    if (!el) return null;
    const w = num(el.getAttribute('width'), 4), h = num(el.getAttribute('height'), 4);
    const inner: string[] = [];
    const save = out.length;
    const state: State = { fill: '#000000', stroke: null, strokeWidth: 1, dash: null, linecap: null, linejoin: null, fontSize: 12, fontWeight: 400, textAnchor: 'start' };
    // The tile is drawn in its own space; the pattern matrix places it, so no CTM here.
    for (const child of [...el.children]) walk(child, { ...state }, IDENTITY);
    inner.push(...out.splice(save));
    const matrix = multiply(ctm, parseTransform(el.getAttribute('patternTransform')));
    // One pattern per tile and placement: the same stripe drawn at the same scale is one object.
    const key = `${id}|${matrix.map((n) => n.toFixed(3)).join(',')}`;
    const already = patterns.get(key);
    if (already) return already.name;
    const name = `P${patterns.size}${id.replace(/[^A-Za-z0-9]/g, '')}`;
    patterns.set(key, { name, bbox: [0, 0, w, h], xStep: w, yStep: h, matrix, content: inner.join('') });
    return name;
  };

  /** Text: one run per font, positioned by its own text matrix so the glyphs sit upright. */
  const drawText = (el: Element, state: State, x: number, y: number) => {
    const text = el.textContent ?? '';
    if (!text.trim()) return;
    const weight = state.fontWeight;
    const runs: { key: string; metrics: FontMetrics; codes: number[] }[] = [];
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      const font = o.chooseFont(cp, weight);
      if (!font) continue;
      const last = runs[runs.length - 1];
      if (last && last.key === font.key) last.codes.push(cp);
      else runs.push({ key: font.key, metrics: font.metrics, codes: [cp] });
    }
    if (!runs.length) return;
    const widthOf = (run: { metrics: FontMetrics; codes: number[] }) => run.codes.reduce((sum, cp) => sum + run.metrics.advance(run.metrics.glyph(cp)) / run.metrics.unitsPerEm, 0) * state.fontSize;
    const total = runs.reduce((sum, r) => sum + widthOf(r), 0);
    let penX = state.textAnchor === 'middle' ? x - total / 2 : state.textAnchor === 'end' ? x - total : x;
    const fill = colorOf(state.fill) ?? [0, 0, 0];
    emit(`${f(fill[0])} ${f(fill[1])} ${f(fill[2])} rg\n`);
    emit('BT\n');
    for (const run of runs) {
      const record = o.fonts.get(run.key);
      const hex = run.codes
        .map((cp) => {
          const glyph = run.metrics.glyph(cp);
          record?.used.set(glyph, cp);
          return glyph.toString(16).padStart(4, '0');
        })
        .join('');
      usedFonts.add(run.key);
      emit(`/F${run.key} ${f(state.fontSize)} Tf\n`);
      emit(`1 0 0 -1 ${f(penX)} ${f(y)} Tm\n`);
      emit(`<${hex}> Tj\n`);
      penX += widthOf(run);
    }
    emit('ET\n');
  };

  function walk(el: Element, inherited: State, ctm: Matrix): void {
    const tag = el.tagName.toLowerCase();
    if (tag === 'defs' || tag === 'style' || tag === 'title' || tag === 'desc' || tag === 'pattern') return;
    const state: State = {
      fill: el.getAttribute('fill') ?? inherited.fill,
      stroke: el.getAttribute('stroke') ?? inherited.stroke,
      strokeWidth: el.hasAttribute('stroke-width') ? num(el.getAttribute('stroke-width'), 1) : inherited.strokeWidth,
      dash: el.getAttribute('stroke-dasharray') ?? inherited.dash,
      linecap: el.getAttribute('stroke-linecap') ?? inherited.linecap,
      linejoin: el.getAttribute('stroke-linejoin') ?? inherited.linejoin,
      fontSize: el.hasAttribute('font-size') ? num(el.getAttribute('font-size'), inherited.fontSize) : inherited.fontSize,
      fontWeight: el.hasAttribute('font-weight') ? num(el.getAttribute('font-weight'), inherited.fontWeight) : inherited.fontWeight,
      textAnchor: el.getAttribute('text-anchor') ?? inherited.textAnchor,
    };
    const transform = parseTransform(el.getAttribute('transform'));
    const local = multiply(ctm, transform);

    const withTransform = (body: () => void) => {
      const changed = transform.some((n, i) => n !== IDENTITY[i]);
      if (changed) emit(`q ${transform.map(f).join(' ')} cm\n`);
      body();
      if (changed) emit('Q\n');
    };

    switch (tag) {
      case 'svg': {
        // A nested viewport: scale its viewBox into the given box (xMidYMid meet) and clip.
        const isRoot = el === root;
        const x = num(el.getAttribute('x')), y = num(el.getAttribute('y'));
        const w = num(el.getAttribute('width'), sheetW), h = num(el.getAttribute('height'), sheetH);
        const vb = (el.getAttribute('viewBox') ?? '').split(/[\s,]+/).filter(Boolean).map(Number);
        emit('q\n');
        if (!isRoot) {
          emit(`${f(x)} ${f(y)} ${f(w)} ${f(h)} re W n\n`);
          if (vb.length === 4) {
            const s = Math.min(w / vb[2]!, h / vb[3]!);
            const dx = x + (w - vb[2]! * s) / 2 - vb[0]! * s;
            const dy = y + (h - vb[3]! * s) / 2 - vb[1]! * s;
            emit(`1 0 0 1 ${f(dx)} ${f(dy)} cm\n`);
            emit(`${f(s)} 0 0 ${f(s)} 0 0 cm\n`);
          }
        }
        const inner = isRoot ? local : multiply(multiply(local, [1, 0, 0, 1, x, y]), vb.length === 4 ? scaleOf(w, h, vb) : IDENTITY);
        for (const child of [...el.children]) walk(child, state, inner);
        emit('Q\n');
        return;
      }
      case 'g': {
        withTransform(() => {
          for (const child of [...el.children]) walk(child, state, local);
        });
        return;
      }
      case 'rect': {
        withTransform(() => {
          const paint = setPaint(state, local);
          if (paint.fill || paint.stroke) {
            emit(rectOps(num(el.getAttribute('x')), num(el.getAttribute('y')), num(el.getAttribute('width')), num(el.getAttribute('height')), num(el.getAttribute('rx'))));
            emit(`${paintOp(paint)}\n`);
          }
        });
        return;
      }
      case 'circle': {
        withTransform(() => {
          const paint = setPaint(state, local);
          if (paint.fill || paint.stroke) {
            emit(circleOps(num(el.getAttribute('cx')), num(el.getAttribute('cy')), num(el.getAttribute('r'))));
            emit(`${paintOp(paint)}\n`);
          }
        });
        return;
      }
      case 'line': {
        withTransform(() => {
          const paint = setPaint(state, local);
          if (paint.stroke) {
            emit(`${f(num(el.getAttribute('x1')))} ${f(num(el.getAttribute('y1')))} m\n${f(num(el.getAttribute('x2')))} ${f(num(el.getAttribute('y2')))} l\nS\n`);
          }
        });
        return;
      }
      case 'path': {
        withTransform(() => {
          const paint = setPaint(state, local);
          const d = el.getAttribute('d');
          if (d && (paint.fill || paint.stroke)) {
            emit(pathOps(d));
            emit(`${paintOp(paint)}\n`);
          }
        });
        return;
      }
      case 'text': {
        withTransform(() => {
          const x = num(el.getAttribute('x')), y = num(el.getAttribute('y'));
          const spans = [...el.children].filter((c) => c.tagName.toLowerCase() === 'tspan');
          if (spans.length === 0) drawText(el, state, x, y);
          else for (const span of spans) drawText(span, { ...state, textAnchor: span.getAttribute('text-anchor') ?? state.textAnchor }, num(span.getAttribute('x'), x), num(span.getAttribute('y'), y));
        });
        return;
      }
      default:
        return;
    }
  }

  const start: State = { fill: '#000000', stroke: null, strokeWidth: 1, dash: null, linecap: null, linejoin: null, fontSize: 12, fontWeight: 400, textAnchor: 'start' };
  emit(`q ${base.map(f).join(' ')} cm\n`);
  walk(root, start, base);
  emit('Q\n');
  return { content: out.join(''), fonts: [...usedFonts], patterns: [...patterns.values()] };
}

function scaleOf(w: number, h: number, vb: number[]): Matrix {
  const s = Math.min(w / vb[2]!, h / vb[3]!);
  return [s, 0, 0, s, (w - vb[2]! * s) / 2 - vb[0]! * s, (h - vb[3]! * s) / 2 - vb[1]! * s];
}
