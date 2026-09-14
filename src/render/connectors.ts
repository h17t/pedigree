/**
 * Connector routing. Everything is orthogonal. Partners are joined by a line at mid-card
 * height with the union junction at its middle; children hang from the junction via a
 * horizontal "bus" halfway to the children's row. Pure functions, so they can be tested and
 * reused by the print module.
 */
import type { ChildLink, Position, Project, Union } from '@/model/types';
import { card } from '@/design/tokens';
import { isParentsUnknown, junctionSize, unknownParentsBox } from './geometry';
import type { Box } from './geometry';

export type PartnerStyle = 'marriage' | 'divorced' | 'dashed' | 'plain';
export type ChildStyle = 'biological' | 'adopted' | 'step' | 'unknown';

export interface PartnerLine {
  unionId: string;
  d: string;
  style: PartnerStyle;
  /** Midpoint of the strike mark for divorced unions. */
  strike: { x: number; y: number } | null;
}

export interface ChildLine {
  linkId: string;
  childId: string;
  d: string;
  style: ChildStyle;
}

export interface UnionGeometry {
  unionId: string;
  /** Centre of the junction (or of the "parents unknown" box). */
  cx: number;
  cy: number;
  unknownParents: boolean;
  partnerLine: PartnerLine | null;
  childLines: ChildLine[];
}

export function partnerStyle(u: Union): PartnerStyle {
  if (u.status === 'divorced') return 'divorced';
  if (u.type === 'marriage' || u.status === 'married' || u.status === 'widowed') return 'marriage';
  // A recorded partnership without marriage is a single line; only "not recorded" is dashed.
  if (u.type === 'unknown' && u.status === 'unknown') return 'dashed';
  return 'plain';
}

export function childStyle(l: ChildLink): ChildStyle {
  if (l.relationType === 'adopted') return 'adopted';
  if (l.relationType === 'step' || l.relationType === 'foster') return 'step';
  if (l.relationType === 'unknown') return 'unknown';
  return 'biological';
}

const r = (n: number) => Math.round(n * 100) / 100;

/** Orthogonal path between two points with a horizontal middle segment at `ym`. */
export function orthogonalH(x1: number, y1: number, x2: number, y2: number, ym: number): string {
  if (Math.abs(y1 - y2) < 0.5) return `M${r(x1)} ${r(y1)} H${r(x2)}`;
  return `M${r(x1)} ${r(y1)} V${r(ym)} H${r(x2)} V${r(y2)}`;
}

/** Orthogonal path from a point straight down/up to a bus row, across, then to the target. */
export function orthogonalV(x1: number, y1: number, x2: number, y2: number, ybus: number): string {
  if (Math.abs(x1 - x2) < 0.5) return `M${r(x1)} ${r(y1)} V${r(y2)}`;
  return `M${r(x1)} ${r(y1)} V${r(ybus)} H${r(x2)} V${r(y2)}`;
}

export interface RoutingInput {
  project: Project;
  boxes: Map<string, Box>;
  /** Visible persons; unions are drawn only among visible people. */
  visible: Set<string>;
  unionPositions?: Map<string, Position>;
}

/** True when another card sits between two partner cards on the same row. */
function cardBetween(a: Box, b: Box, boxes: Map<string, Box>, ignore: Set<string>): boolean {
  const left = Math.min(a.x + a.w, b.x + b.w), right = Math.max(a.x, b.x);
  if (right <= left) return false;
  const yTop = Math.max(a.y, b.y), yBottom = Math.min(a.y + a.h, b.y + b.h);
  for (const [id, box] of boxes) {
    if (ignore.has(id)) continue;
    if (box.x < right && box.x + box.w > left && box.y < yBottom && box.y + box.h > yTop) return true;
  }
  return false;
}

export function routeUnions({ project, boxes, visible, unionPositions }: RoutingInput): UnionGeometry[] {
  const out: UnionGeometry[] = [];
  const links = Object.values(project.childLinks);
  const idOf = new Map<Box, string>();
  for (const [id, b] of boxes) idOf.set(b, id);
  const pendingBuses: { index: number; cx: number; startY: number; ybus: number; kids: { l: ChildLink; b: Box }[] }[] = [];
  for (const u of Object.values(project.unions)) {
    const partners = u.partnerIds.filter((id) => visible.has(id) && boxes.has(id)).map((id) => boxes.get(id)!);
    const children = links.filter((l) => l.unionId === u.id && visible.has(l.childId) && boxes.has(l.childId));
    if (partners.length === 0 && children.length === 0) continue;
    if (partners.length === 0 && !isParentsUnknown(u) && u.partnerIds.length > 0) continue; // partners filtered out: nothing to hang from

    let cx: number, cy: number;
    let partnerLine: PartnerLine | null = null;
    const unknownParents = partners.length === 0;

    if (partners.length >= 2) {
      const [a, b] = [...partners].sort((p, q) => p.x - q.x) as [Box, Box];
      const ya = a.y + a.h / 2, yb = b.y + b.h / 2;
      const x1 = a.x + a.w, x2 = b.x;
      const overlapping = x2 < x1;
      const style = partnerStyle(u);
      const ignore = new Set(partners.map((p) => idOf.get(p)!));
      if (!overlapping && cardBetween(a, b, boxes, ignore)) {
        // Partners apart on the row with cards between them: the line goes over the top so it
        // never runs through a card; the children hang from the first partner.
        const top = Math.min(a.y, b.y) - 18;
        const xa = a.x + a.w / 2, xb = b.x + b.w / 2;
        cx = xa;
        cy = a.y + a.h;
        const d = `M${r(xa)} ${r(a.y)} V${r(top)} H${r(xb)} V${r(b.y)}`;
        partnerLine = { unionId: u.id, d, style, strike: style === 'divorced' ? { x: (xa + xb) / 2, y: top } : null };
      } else {
        const ym = (ya + yb) / 2;
        const xm = overlapping ? Math.max(a.x + a.w, b.x + b.w) + 24 : (x1 + x2) / 2;
        cx = xm;
        cy = Math.abs(ya - yb) < 0.5 ? ya : ym;
        const d = overlapping ? `M${r(x1)} ${r(ya)} H${r(xm)} V${r(yb)} H${r(b.x + b.w)}` : orthogonalH(x1, ya, x2, yb, ym);
        partnerLine = { unionId: u.id, d, style, strike: style === 'divorced' ? { x: cx, y: cy } : null };
      }
    } else if (partners.length === 1) {
      // A single parent: the children hang straight from the bottom of the card, no stub, no marker.
      const a = partners[0]!;
      cx = a.x + a.w / 2;
      cy = a.y + a.h;
      partnerLine = null;
    } else {
      // Parents unknown: box above the children (or at the stored union position).
      const pos = unionPositions?.get(u.id) ?? u.position;
      if (pos) {
        cx = pos.x + unknownParentsBox.w / 2;
        cy = pos.y + unknownParentsBox.h / 2;
      } else {
        const kids = children.map((l) => boxes.get(l.childId)!);
        const minX = Math.min(...kids.map((k) => k.x)), maxX = Math.max(...kids.map((k) => k.x + k.w));
        cx = (minX + maxX) / 2;
        cy = Math.min(...kids.map((k) => k.y)) - 56;
      }
    }

    const childLines: ChildLine[] = [];
    if (children.length) {
      const kids = children.map((l) => ({ l, b: boxes.get(l.childId)! }));
      const topOfKids = Math.min(...kids.map((k) => k.b.y));
      const startY = unknownParents ? cy + unknownParentsBox.h / 2 : partners.length >= 2 && partnerLine ? cy + junctionSize / 2 : cy;
      // The bus sits halfway between the junction and the highest child, but never above the junction.
      const ybus = topOfKids > startY ? (startY + topOfKids) / 2 : startY + 20;
      pendingBuses.push({ index: out.length, cx, startY, ybus, kids });
      for (const { l } of kids) childLines.push({ linkId: l.id, childId: l.childId, d: '', style: childStyle(l) });
    }
    out.push({ unionId: u.id, cx, cy, unknownParents, partnerLine, childLines });
  }
  // Bus lanes: buses in the same gap whose spans overlap get their own lane, so two families'
  // lines never lie on top of each other. Lanes alternate below and above the middle.
  const lanes = [0, 10, -10, 20, -20, 30, -30];
  const placed: { y: number; left: number; right: number; lane: number }[] = [];
  pendingBuses.sort((a, b) => Math.min(a.cx, ...a.kids.map((k) => k.b.x)) - Math.min(b.cx, ...b.kids.map((k) => k.b.x)));
  for (const p of pendingBuses) {
    const left = Math.min(p.cx, ...p.kids.map((k) => k.b.x + k.b.w / 2)), right = Math.max(p.cx, ...p.kids.map((k) => k.b.x + k.b.w / 2));
    const same = placed.filter((q) => Math.abs(q.y - p.ybus) < 1 && q.left < right && left < q.right);
    let lane = 0;
    while (same.some((q) => q.lane === lane) && lane < lanes.length - 1) lane++;
    placed.push({ y: p.ybus, left, right, lane });
    const y = p.ybus + lanes[lane]!;
    const g = out[p.index]!;
    p.kids.forEach(({ b }, i) => {
      const x2 = b.x + b.w / 2;
      const y2 = b.y > y ? b.y : b.y + b.h; // child above the bus: connect to its bottom edge
      g.childLines[i]!.d = orthogonalV(p.cx, p.startY, x2, y2, y);
    });
  }
  return out;
}

/** Bounding box of a set of boxes, or null when empty. */
export function boundsOf(boxes: Iterable<Box>, extra: { x: number; y: number }[] = []): Box | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  for (const p of extra) {
    minX = Math.min(minX, p.x - unknownParentsBox.w / 2);
    minY = Math.min(minY, p.y - unknownParentsBox.h / 2);
    maxX = Math.max(maxX, p.x + unknownParentsBox.w / 2);
    maxY = Math.max(maxY, p.y + unknownParentsBox.h / 2);
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export const CARD_W = card.width;
