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
  if (u.type === 'unmarried' || u.type === 'partnership' || u.status === 'partnership' || u.status === 'separated') return 'dashed';
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

export function routeUnions({ project, boxes, visible, unionPositions }: RoutingInput): UnionGeometry[] {
  const out: UnionGeometry[] = [];
  const links = Object.values(project.childLinks);
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
      const ym = (ya + yb) / 2;
      const xm = overlapping ? Math.max(a.x + a.w, b.x + b.w) + 24 : (x1 + x2) / 2;
      cx = xm;
      cy = Math.abs(ya - yb) < 0.5 ? ya : ym;
      const d = overlapping
        ? `M${r(x1)} ${r(ya)} H${r(xm)} V${r(yb)} H${r(b.x + b.w)}`
        : orthogonalH(x1, ya, x2, yb, ym);
      const style = partnerStyle(u);
      partnerLine = { unionId: u.id, d, style, strike: style === 'divorced' ? { x: cx, y: cy } : null };
    } else if (partners.length === 1) {
      const a = partners[0]!;
      cx = a.x + a.w / 2;
      cy = a.y + a.h + 24;
      partnerLine = { unionId: u.id, d: `M${r(cx)} ${r(a.y + a.h)} V${r(cy)}`, style: 'plain', strike: null };
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
      const startY = unknownParents ? cy + unknownParentsBox.h / 2 : cy + junctionSize / 2;
      // The bus sits halfway between the junction and the highest child, but never above the junction.
      const ybus = topOfKids > startY ? (startY + topOfKids) / 2 : startY + 20;
      for (const { l, b } of kids) {
        const x2 = b.x + b.w / 2;
        const y2 = b.y > ybus ? b.y : b.y + b.h; // child above the bus: connect to its bottom edge
        childLines.push({ linkId: l.id, childId: l.childId, d: orthogonalV(cx, startY, x2, y2, ybus), style: childStyle(l) });
      }
    }
    out.push({ unionId: u.id, cx, cy, unknownParents, partnerLine, childLines });
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
