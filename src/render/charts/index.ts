/**
 * Chart modes of the tree view. A chart is an alternative arrangement of a subset of the
 * tree that is never stored: the canvas, the print dialog and the exports draw it from the
 * same positions and lines, so paper and screen agree.
 *
 *  - Ancestors (pedigree): the person on the left, parents to the right, grandparents further
 *    right, up to `generations` columns. Each ancestor's row is the middle of their parents'
 *    rows; branch ends are stacked. Lines are orthogonal, child → parents. A repeated ancestor
 *    (cousin marriages) is drawn once; the second branch ends there.
 *  - Descendants: the person on top, generations downward, `depth` steps, through the ordinary
 *    generational layout of the descendants and their partners, so partnerships and children
 *    are drawn exactly as on the main canvas.
 */
import type { Position, Project } from '@/model/types';
import { card, spacingGaps } from '@/design/tokens';
import { breakCycles, buildAdjacency, childrenOf, parentsOf } from '@/model/graph';
import type { DetailLevel } from '../geometry';
import { cardHeight } from '../geometry';
import { layoutComponent } from '../layout/generational';

export type ChartSpec = { kind: 'ancestors'; personId: string; generations: number } | { kind: 'descendants'; personId: string; depth: number };

export interface ChartLine {
  d: string;
}

export interface ChartResult {
  positions: Map<string, Position>;
  visible: Set<string>;
  /** Extra orthogonal lines (pedigree); empty when the chart uses partnership routing. */
  lines: ChartLine[];
  /** Draw partnerships and children with the ordinary junction routing. */
  useUnions: boolean;
  width: number;
  height: number;
}

export const ANCESTOR_GENERATIONS = { min: 4, max: 8, default: 5 } as const;
export const DESCENDANT_DEPTH = { min: 1, max: 8, default: 3 } as const;

const H_GAP = 72;
/** Smallest gap between two cards in the same column of a pedigree chart. */
const ROW_GAP = 12;

export function buildChart(project: Project, spec: ChartSpec, level: DetailLevel): ChartResult {
  return spec.kind === 'ancestors' ? pedigree(project, spec.personId, spec.generations, level) : descendants(project, spec.personId, spec.depth, level);
}

function pedigree(project: Project, personId: string, generations: number, level: DetailLevel): ChartResult {
  const positions = new Map<string, Position>();
  const lines: ChartLine[] = [];
  if (!project.persons[personId]) return { positions, visible: new Set(), lines, useUnions: false, width: 0, height: 0 };
  const adj = buildAdjacency(project, breakCycles(project).ignoredLinks);
  const h = cardHeight(level);
  const rowStep = h + spacingGaps[project.settings.spacing ?? 'normal'].generationGap / 2;
  const colStep = card.width + H_GAP;
  let nextRow = 0;
  const rowOf = new Map<string, number>();
  const links: { from: string; to: string }[] = [];

  // Father first (top), then mother; unknown sex keeps the union order.
  const orderedParents = (id: string): string[] => {
    const ps = parentsOf(project, adj, id).filter((p) => project.persons[p]);
    return [...ps].sort((a, b) => sexRank(project.persons[a]!.sex) - sexRank(project.persons[b]!.sex));
  };
  const place = (id: string, col: number): number => {
    if (rowOf.has(id)) return rowOf.get(id)!; // repeated ancestor: reuse
    const parents = col + 1 < generations ? orderedParents(id) : [];
    const parentRows: number[] = [];
    // The same ancestor can be reached from two branches at different depths (cousins who
    // married, for instance). The first placement wins, and their partner joins them in that
    // same column, so a couple is never split across two columns.
    const placedParent = parents.map((p) => positions.get(p)).find((pos) => pos !== undefined);
    const parentCol = placedParent ? Math.round(placedParent.x / colStep) : col + 1;
    for (const p of parents) {
      if (rowOf.has(p)) {
        parentRows.push(rowOf.get(p)!);
        continue;
      }
      parentRows.push(place(p, parentCol));
    }
    const row = parentRows.length ? parentRows.reduce((a, b) => a + b, 0) / parentRows.length : nextRow++;
    // A person with parents sits between them; keep the stacking cursor below the deepest row used.
    rowOf.set(id, row);
    positions.set(id, { x: col * colStep, y: Math.round(row * rowStep) });
    for (const p of parents) if (positions.has(p)) links.push({ from: id, to: p });
    return row;
  };
  place(personId, 0);
  // A repeated ancestor brings its own row with it, so two cards in one column can end up on
  // top of each other. Each column is swept once, keeping the order and opening the gap.
  const byColumn = new Map<number, string[]>();
  for (const [id, p] of positions) {
    const arr = byColumn.get(p.x) ?? [];
    arr.push(id);
    byColumn.set(p.x, arr);
  }
  for (const ids of byColumn.values()) {
    ids.sort((a, b) => positions.get(a)!.y - positions.get(b)!.y);
    for (let i = 1; i < ids.length; i++) {
      const prev = positions.get(ids[i - 1]!)!, cur = positions.get(ids[i]!)!;
      const min = prev.y + h + ROW_GAP;
      if (cur.y < min) positions.set(ids[i]!, { x: cur.x, y: min });
    }
  }
  // Lines are drawn once the cards are where they will stay.
  for (const { from, to } of links) {
    const a = positions.get(from), bpos = positions.get(to);
    if (!a || !bpos) continue;
    const cx = a.x + card.width;
    lines.push({ d: `M${cx} ${a.y + h / 2} H${cx + H_GAP / 2} V${bpos.y + h / 2} H${bpos.x}` });
  }
  let maxX = 0, maxY = 0;
  for (const p of positions.values()) {
    maxX = Math.max(maxX, p.x + card.width);
    maxY = Math.max(maxY, p.y + h);
  }
  return { positions, visible: new Set(positions.keys()), lines, useUnions: false, width: maxX, height: maxY };
}

function sexRank(sex: string): number {
  return sex === 'male' ? 0 : sex === 'female' ? 1 : 2;
}

function descendants(project: Project, personId: string, depth: number, level: DetailLevel): ChartResult {
  const positions = new Map<string, Position>();
  if (!project.persons[personId]) return { positions, visible: new Set(), lines: [], useUnions: true, width: 0, height: 0 };
  const adj = buildAdjacency(project, breakCycles(project).ignoredLinks);
  const members = new Set<string>([personId]);
  let frontier = [personId];
  for (let d = 0; d < depth && frontier.length; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const c of childrenOf(adj, id)) {
        if (!members.has(c) && project.persons[c]) {
          members.add(c);
          next.push(c);
        }
      }
    }
    frontier = next;
  }
  // Partners of everyone shown (the co-parents), so unions draw with both partners.
  for (const id of [...members]) for (const uid of adj.partnerUnions.get(id) ?? []) for (const p of project.unions[uid]?.partnerIds ?? []) if (project.persons[p]) members.add(p);
  // Lay out only the sub-graph: unions and links restricted to the members.
  const unions: Project['unions'] = {};
  for (const [k, u] of Object.entries(project.unions)) {
    const partnerIds = u.partnerIds.filter((p) => members.has(p));
    if (partnerIds.length > 0) unions[k] = { ...u, partnerIds };
  }
  const sub: Project = {
    ...project,
    persons: Object.fromEntries([...members].map((id) => [id, project.persons[id]!])),
    unions,
    childLinks: Object.fromEntries(Object.entries(project.childLinks).filter(([, l]) => members.has(l.childId) && project.unions[l.unionId]?.partnerIds.some((p) => members.has(p)))),
  };
  const r = layoutComponent(sub, [...members], level, undefined, 'off', project.settings.spacing ?? 'normal');
  for (const [id, p] of r.positions) positions.set(id, p);
  return { positions, visible: new Set(members), lines: [], useUnions: true, width: r.width, height: r.height };
}
