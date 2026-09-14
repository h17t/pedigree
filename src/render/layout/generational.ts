/**
 * Generational layout (a layered layout for family graphs).
 *
 *  1. Ranks: generation numbers (longest path from the roots), then partners are equalised to
 *     the same rank and children pushed below their parents until stable.
 *  2. Ordering: people are grouped into "couple blocks" so partners stay adjacent; blocks are
 *     ordered per rank by barycentre sweeps (down from parents, up from children) starting
 *     from a depth-first order in which siblings are sorted by birth.
 *  3. Coordinates: left-to-right packing per rank, then parents are centred over their
 *     children and children under their parents in alternating passes without overlaps.
 *
 * Works on one connected component. Cycle-safe (uses the cycle-broken adjacency).
 */
import type { GenerationScaling, Position, Project, Spacing } from '@/model/types';
import { card, spacingGaps } from '@/design/tokens';
import { breakCycles, buildAdjacency } from '@/model/graph';
import type { Adjacency } from '@/model/graph';
import { toOrdinal } from '@/model/dates';
import type { DetailLevel } from '../geometry';
import { cardHeight } from '../geometry';
import { rowCounts, rowScales } from './scale';

export interface LayoutResult {
  positions: Map<string, Position>;
  /** Bounding box of the laid out component (origin at 0,0). */
  width: number;
  height: number;
  rows: number;
}


/**
 * Generation ranks of one family: longest path from the roots, partners equalised to the same
 * rank and children pushed below their parents until stable. Shared by the layout and by the
 * per-generation scaling so both agree on who is in which row.
 */
export function rankMembers(project: Project, members: string[], adj: Adjacency): Map<string, number> {
  const memberSet = new Set(members);
  const parentsOf = (id: string): string[] => {
    const out: string[] = [];
    for (const l of adj.parentLinks.get(id) ?? []) for (const p of project.unions[l.unionId]?.partnerIds ?? []) if (memberSet.has(p) && !out.includes(p)) out.push(p);
    return out;
  };
  const rank = new Map<string, number>();
  for (const id of members) rank.set(id, 0);
  // Longest-path ranks, iterated to a fixed point (the graph is a DAG after cycle breaking, so
  // at most |members| rounds are needed; partner equalisation can add a few more).
  for (let iter = 0; iter < members.length + 10; iter++) {
    let changed = false;
    for (const id of members) {
      const ps = parentsOf(id);
      if (ps.length) {
        const r = Math.max(...ps.map((p) => rank.get(p) ?? 0)) + 1;
        if (r > (rank.get(id) ?? 0)) {
          rank.set(id, r);
          changed = true;
        }
      }
    }
    for (const u of Object.values(project.unions)) {
      const ps = u.partnerIds.filter((p) => memberSet.has(p));
      if (ps.length > 1) {
        const r = Math.max(...ps.map((p) => rank.get(p) ?? 0));
        for (const p of ps) {
          if ((rank.get(p) ?? 0) < r) {
            rank.set(p, r);
            changed = true;
          }
        }
      }
    }
    if (!changed) break;
  }
  // Compaction: everyone sits as close to their children as possible, so parents are always
  // directly above their children and a partner who married in is level with their partner
  // rather than with the other side's grandparents. Ranks only grow, so this terminates.
  const kidsOf = (id: string): string[] => {
    const out: string[] = [];
    for (const uid of adj.partnerUnions.get(id) ?? []) for (const l of adj.unionChildren.get(uid) ?? []) if (memberSet.has(l.childId) && !out.includes(l.childId)) out.push(l.childId);
    return out;
  };
  for (let iter = 0; iter < members.length + 10; iter++) {
    let changed = false;
    for (const id of members) {
      const kids = kidsOf(id);
      if (!kids.length) continue;
      const hi = Math.min(...kids.map((k) => rank.get(k) ?? 0)) - 1;
      if (hi > (rank.get(id) ?? 0)) {
        rank.set(id, hi);
        changed = true;
      }
    }
    for (const u of Object.values(project.unions)) {
      const ps = u.partnerIds.filter((p) => memberSet.has(p));
      if (ps.length > 1) {
        const r = Math.max(...ps.map((p) => rank.get(p) ?? 0));
        for (const p of ps) {
          if ((rank.get(p) ?? 0) < r) {
            rank.set(p, r);
            changed = true;
          }
        }
      }
    }
    // Children stay below their parents after partners moved.
    for (const id of members) {
      const ps = parentsOf(id);
      if (ps.length) {
        const r = Math.max(...ps.map((p) => rank.get(p) ?? 0)) + 1;
        if (r > (rank.get(id) ?? 0)) {
          rank.set(id, r);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  const min = Math.min(...members.map((m) => rank.get(m) ?? 0));
  if (min > 0) for (const id of members) rank.set(id, (rank.get(id) ?? 0) - min);
  return rank;
}

export function layoutComponent(project: Project, membersIn: string[], level: DetailLevel, adjIn?: Adjacency, mode: GenerationScaling = 'off', spacing: Spacing = 'normal'): LayoutResult {
  const gaps = spacingGaps[spacing];
  const COL = card.width + gaps.columnGap;
  /** Extra gap between unrelated blocks on a row, so families read as groups. */
  const BLOCK_GAP = gaps.columnGap;
  const positions = new Map<string, Position>();
  const memberSet = new Set(membersIn);
  if (membersIn.length === 0) return { positions, width: 0, height: 0, rows: 0 };
  const adj = adjIn ?? buildAdjacency(project, breakCycles(project).ignoredLinks);
  const birth = (id: string) => toOrdinal(project.persons[id]?.birth.date ?? null) ?? Number.MAX_SAFE_INTEGER;
  const nameKey = (id: string) => {
    const p = project.persons[id];
    return p ? `${p.surname}\u0001${p.givenNames}\u0001${id}` : id;
  };
  /** Deterministic: birth date first, then name, then id, whatever order the data came in. */
  const byBirthThenName = (a: string, b: string) => birth(a) - birth(b) || nameKey(a).localeCompare(nameKey(b));
  const members = [...membersIn].sort(byBirthThenName);

  const parentsOf = (id: string): string[] => {
    const out: string[] = [];
    for (const l of adj.parentLinks.get(id) ?? []) for (const p of project.unions[l.unionId]?.partnerIds ?? []) if (memberSet.has(p) && !out.includes(p)) out.push(p);
    return out;
  };
  const unionsOf = (id: string) => (adj.partnerUnions.get(id) ?? []).map((u) => project.unions[u]!).filter(Boolean);
  const childrenOfUnion = (uid: string) => (adj.unionChildren.get(uid) ?? []).map((l) => l.childId).filter((c) => memberSet.has(c));

  // ---- 1. Ranks and per-row scale --------------------------------------------------------
  const rank = rankMembers(project, members, adj);
  const scales = rowScales(rowCounts(rank), mode);
  const scaleOf = (id: string) => scales[rank.get(id) ?? 0] ?? 1;
  /** Column step (card + gap) for a person's row, and the card width itself. */
  const colOf = (id: string) => COL * scaleOf(id);
  const cardW = (id: string) => card.width * scaleOf(id);
  const cx = (id: string) => (x.get(id) ?? 0) + cardW(id) / 2;
  const x = new Map<string, number>();

  // ---- 2. Blocks and ordering --------------------------------------------------------
  // A block is a maximal chain of people connected by partnerships on the same rank,
  // e.g. [partner1, person, partner2]. Order inside a block: earlier marriages further out
  // on the left, later ones on the right of the "hub" person with the most unions.
  const rows = new Map<number, string[]>();
  for (const id of members) {
    const r = rank.get(id) ?? 0;
    const arr = rows.get(r) ?? [];
    arr.push(id);
    rows.set(r, arr);
  }
  const blockOf = new Map<string, string[]>();
  const blocks = new Map<number, string[][]>();
  for (const [r, ids] of rows) {
    const seen = new Set<string>();
    const rowBlocks: string[][] = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      // collect the partnership-connected group on this row
      const group: string[] = [];
      const stack = [id];
      while (stack.length) {
        const cur = stack.pop()!;
        if (seen.has(cur)) continue;
        seen.add(cur);
        group.push(cur);
        for (const u of unionsOf(cur)) for (const p of u.partnerIds) if (memberSet.has(p) && rank.get(p) === r && !seen.has(p)) stack.push(p);
      }
      const ordered = orderBlock(group.sort(byBirthThenName), unionsOf, memberSet, nameKey);
      rowBlocks.push(ordered);
      for (const m of ordered) blockOf.set(m, ordered);
    }
    blocks.set(r, rowBlocks);
  }

  // Initial order: depth-first from the roots (no parents in the component), siblings by birth.
  const maxRank = Math.max(...members.map((m) => rank.get(m) ?? 0));
  const order = new Map<number, string[][]>();
  for (let r = 0; r <= maxRank; r++) order.set(r, []);
  const placedBlock = new Set<string[]>();
  const visit = (id: string) => {
    const b = blockOf.get(id)!;
    if (!placedBlock.has(b)) {
      placedBlock.add(b);
      order.get(rank.get(id) ?? 0)!.push(b);
    }
    for (const m of b) {
      const unionKey = (u: { marriageDate: string | null; partnerIds: string[] }) => `${toOrdinal(u.marriageDate) ?? 0}`.padStart(12, '0') + u.partnerIds.map(nameKey).sort().join('|');
      for (const u of [...unionsOf(m)].sort((x, y) => unionKey(x).localeCompare(unionKey(y)))) {
        for (const c of childrenOfUnion(u.id).sort(byBirthThenName)) if (!placedBlock.has(blockOf.get(c)!)) visit(c);
      }
    }
  };
  const roots = members.filter((id) => parentsOf(id).length === 0).sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0) || byBirthThenName(a, b));
  for (const rt of roots) visit(rt);
  for (const id of members) if (!placedBlock.has(blockOf.get(id)!)) visit(id);

  // Barycentre sweeps.
  const posIndex = new Map<string, number>();
  const reindex = () => {
    for (const [, rowBlocks] of order) {
      let i = 0;
      for (const b of rowBlocks) for (const m of b) posIndex.set(m, i++);
    }
  };
  reindex();
  const bary = (b: string[], neighbours: (id: string) => string[]) => {
    const vals: number[] = [];
    for (const m of b) for (const n of neighbours(m)) if (posIndex.has(n)) vals.push(posIndex.get(n)!);
    if (vals.length === 0) return null;
    return vals.reduce((a, c) => a + c, 0) / vals.length;
  };
  const childrenOfPerson = (id: string) => unionsOf(id).flatMap((u) => childrenOfUnion(u.id));
  const sweep = (rowsInOrder: number[], neighbours: (id: string) => string[]) => {
    for (const r of rowsInOrder) {
      const rowBlocks = order.get(r)!;
      const keyed = rowBlocks.map((b, i) => ({ b, key: bary(b, neighbours) ?? i, i }));
      keyed.sort((x, y) => x.key - y.key || x.i - y.i);
      order.set(r, keyed.map((k) => k.b));
      reindex();
    }
  };
  for (let it = 0; it < 4; it++) {
    sweep(Array.from({ length: maxRank + 1 }, (_, i) => i), parentsOf);
    sweep(Array.from({ length: maxRank + 1 }, (_, i) => maxRank - i), childrenOfPerson);
  }

  // ---- 3. Coordinates ------------------------------------------------------------------
  const rowOrder = new Map<number, string[]>();
  const blockStart = new Map<string, boolean>();
  for (const [r, rowBlocks] of order) {
    const flat: string[] = [];
    let cursor = 0;
    for (const b of rowBlocks) {
      blockStart.set(b[0]!, true);
      for (const m of b) {
        x.set(m, cursor);
        flat.push(m);
        cursor += colOf(m);
      }
      cursor += BLOCK_GAP;
    }
    rowOrder.set(r, flat);
  }

  // Resolve overlaps in a row left-to-right keeping order; blocks keep the extra gap.
  const compact = (r: number) => {
    const flat = rowOrder.get(r)!;
    for (let i = 1; i < flat.length; i++) {
      const prev = flat[i - 1]!, cur = flat[i]!;
      const minX = x.get(prev)! + colOf(prev) + (blockStart.get(cur) ? BLOCK_GAP : 0);
      if (x.get(cur)! < minX) x.set(cur, minX);
    }
  };
  // Parents over their children (bottom-up): a block aims at the mean centre of its children.
  const centreOn = (ids: string[], targets: (id: string) => string[]) => {
    for (const b of [...new Set(ids.map((id) => blockOf.get(id)!))]) {
      const t = b.flatMap(targets).filter((id) => x.has(id));
      if (!t.length) continue;
      const mean = t.reduce((a, id) => a + cx(id), 0) / t.length;
      const span = (b.length - 1) * colOf(b[0]!) + cardW(b[0]!);
      const shift = mean - span / 2 - x.get(b[0]!)!;
      for (const m of b) x.set(m, x.get(m)! + shift);
    }
  };
  for (let it = 0; it < 2; it++) {
    for (let r = maxRank - 1; r >= 0; r--) {
      centreOn(rowOrder.get(r)!, childrenOfPerson);
      orderKeep(rowOrder.get(r)!, x);
      compact(r);
    }
  }

  // Children under their parents (top-down, final pass). Consecutive blocks with the same
  // parents form a run that is centred under the junction. When a run would collide with the
  // run to its left, the run is not pushed aside: the parents and everything to their right on
  // the rows above move right instead. Lines therefore stay straight and never run through
  // cards; a complicated family simply gets wider.
  const shiftAbove = (r: number, fromX: number, delta: number) => {
    for (let rr = 0; rr < r; rr++) for (const m of rowOrder.get(rr)!) if (x.get(m)! >= fromX - 0.5) x.set(m, x.get(m)! + delta);
  };
  for (let r = 1; r <= maxRank; r++) {
    const flat = rowOrder.get(r)!;
    let minLeft = -Infinity;
    let i = 0;
    while (i < flat.length) {
      const first = blockOf.get(flat[i]!)!;
      const key = first.flatMap(parentsOf).sort().join('|');
      const run: string[][] = [first];
      let j = i + first.length;
      while (key !== '' && j < flat.length) {
        const nb = blockOf.get(flat[j]!)!;
        if (nb.flatMap(parentsOf).sort().join('|') !== key) break;
        run.push(nb);
        j += nb.length;
      }
      const lead = first[0]!;
      const count = run.reduce((n, b) => n + b.length, 0);
      const span = (count - 1) * colOf(lead) + (run.length - 1) * BLOCK_GAP + cardW(lead);
      const targets = first.flatMap(parentsOf).filter((id) => x.has(id));
      let left: number;
      if (targets.length) {
        // A couple's junction is between the two partner cards; a single parent's is its centre.
        const mean = targets.reduce((a, id) => a + cx(id), 0) / targets.length;
        left = mean - span / 2;
        if (left < minLeft) {
          const delta = minLeft - left;
          const parentBlock = blockOf.get(targets[0]!)!;
          shiftAbove(r, Math.min(...parentBlock.map((id) => x.get(id)!)), delta);
          left = minLeft;
        }
      } else {
        left = Math.max(x.get(lead)!, minLeft);
      }
      let cursor = left;
      for (const b of run) {
        for (const m of b) {
          x.set(m, cursor);
          cursor += colOf(m);
        }
        cursor += BLOCK_GAP;
      }
      minLeft = cursor;
      i = j;
    }
  }

  // Rows stack with their own (scaled) heights; normalise to the origin.
  const rowY: number[] = [];
  let yCursor = 0;
  for (let r = 0; r <= maxRank; r++) {
    rowY[r] = yCursor;
    yCursor += cardHeight(level) * (scales[r] ?? 1) + gaps.generationGap;
  }
  let minX = Infinity, maxX = -Infinity;
  for (const id of members) {
    minX = Math.min(minX, x.get(id) ?? 0);
    maxX = Math.max(maxX, (x.get(id) ?? 0) + cardW(id));
  }
  for (const id of members) positions.set(id, { x: Math.round((x.get(id) ?? 0) - minX), y: Math.round(rowY[rank.get(id) ?? 0] ?? 0) });
  return { positions, width: maxX - minX, height: yCursor - gaps.generationGap, rows: maxRank + 1 };
}

/** Keep the row order monotone: a block that jumped left of its predecessor is pushed back. */
function orderKeep(flat: string[], x: Map<string, number>) {
  for (let i = 1; i < flat.length; i++) {
    const prev = flat[i - 1]!, cur = flat[i]!;
    if (x.get(cur)! < x.get(prev)!) x.set(cur, x.get(prev)!);
  }
}

/** Arrange a partnership-connected group: the hub (most unions) in the middle, partners around it. */
function orderBlock(group: string[], unionsOf: (id: string) => { partnerIds: string[]; marriageDate: string | null }[], memberSet: Set<string>, nameKey: (id: string) => string): string[] {
  if (group.length <= 2) return group.length === 2 ? sortCouple(group as [string, string], unionsOf) : group;
  const hub = [...group].sort((a, b) => unionsOf(b).length - unionsOf(a).length || nameKey(a).localeCompare(nameKey(b)))[0]!;
  const partners = unionsOf(hub)
    .sort((a, b) => (toOrdinal(a.marriageDate) ?? 0) - (toOrdinal(b.marriageDate) ?? 0) || a.partnerIds.map(nameKey).sort().join('|').localeCompare(b.partnerIds.map(nameKey).sort().join('|')))
    .flatMap((u) => u.partnerIds.filter((p) => p !== hub && memberSet.has(p) && group.includes(p)));
  const unique = [...new Set(partners)];
  const left = unique.slice(0, Math.ceil(unique.length / 2)).reverse();
  const right = unique.slice(Math.ceil(unique.length / 2));
  const ordered = [...left, hub, ...right];
  for (const g of group) if (!ordered.includes(g)) ordered.push(g);
  return ordered;
}

function sortCouple(pair: [string, string], unionsOf: (id: string) => { partnerIds: string[] }[]): string[] {
  // Keep the union's declared order (first partner left), which the editor sets as husband/wife or entry order.
  const u = unionsOf(pair[0]).find((x) => x.partnerIds.includes(pair[1]));
  if (u) return u.partnerIds.filter((p) => pair.includes(p));
  return pair;
}
