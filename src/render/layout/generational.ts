/**
 * Generational layout (a layered layout for family graphs).
 *
 *  1. Ranks: generation numbers (longest path from the roots), then partners are equalised to
 *     the same rank and children pushed below their parents until stable.
 *  2. Blocks: people are grouped into "couple blocks" so partners stay adjacent; inside a block
 *     the partners sit on the side of their (oldest) children.
 *  3. Ownership: every block hangs below exactly one parent block (a couple with parents on
 *     both sides goes under the family with more descendants), which turns the family graph
 *     into a forest. Siblings are ordered by birth across all of the parents' partnerships.
 *  4. Coordinates: each family is laid out as a subtree with its own horizontal space (contour
 *     packing per row, so no two families ever interleave or overlap), and every partnership's
 *     junction is centred over its children. Root families are placed side by side, each next
 *     one on the side where its in-laws are; parents without a family of their own in the
 *     drawing sit right above their child.
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

/** A couple block: the people on one row joined by partnerships, in drawing order. A virtual block stands for a "parents unknown" union that holds siblings together. */
interface Block {
  members: string[];
  rank: number;
  /** "Parents unknown" union: no cards, only children. */
  virtualUnion: string | null;
  key: string;
}

interface Subtree {
  x: Map<string, number>;
  /** Per rank: leftmost card edge and rightmost card edge of the subtree. */
  contour: Map<number, { l: number; r: number }>;
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

  /** Sortable text for a day ordinal (ordinals before 1970 are negative). */
  const dayKey = (n: number) => `${Math.min(n, 9e15) + 1e7}`.padStart(17, '0');
  const unionKey = (u: { marriageDate: string | null; partnerIds: string[] }) => dayKey(toOrdinal(u.marriageDate) ?? 0) + u.partnerIds.map(nameKey).sort().join('|');
  const unionsOf = (id: string) =>
    (adj.partnerUnions.get(id) ?? [])
      .map((u) => project.unions[u]!)
      .filter(Boolean)
      .sort((a, b) => unionKey(a).localeCompare(unionKey(b)));
  const childrenOfUnion = (uid: string) => (adj.unionChildren.get(uid) ?? []).map((l) => l.childId).filter((c) => memberSet.has(c)).sort(byBirthThenName);

  // ---- 1. Ranks and per-row scale --------------------------------------------------------
  const rank = rankMembers(project, members, adj);
  const scales = rowScales(rowCounts(rank), mode);
  const scaleOf = (id: string) => scales[rank.get(id) ?? 0] ?? 1;
  /** Column step (card + gap) for a person's row, and the card width itself. */
  const colOf = (id: string) => COL * scaleOf(id);
  const cardW = (id: string) => card.width * scaleOf(id);
  /** Gap between the cards of two unrelated blocks on a row. */
  const sepOf = (r: number) => gaps.columnGap * (scales[r] ?? 1) + BLOCK_GAP;

  // ---- 2. Blocks --------------------------------------------------------------------------
  // A block is a maximal chain of people connected by partnerships on the same rank, e.g.
  // [partner1, person, partner2]. Inside a block the partners sit on the side of their children:
  // the partner whose children are the oldest goes left.
  const rows = new Map<number, string[]>();
  for (const id of members) {
    const r = rank.get(id) ?? 0;
    const arr = rows.get(r) ?? [];
    arr.push(id);
    rows.set(r, arr);
  }
  const blockOf = new Map<string, Block>();
  const blocks: Block[] = [];
  const unionOrderKey = (u: { id: string; marriageDate: string | null; partnerIds: string[] }) => {
    const kids = childrenOfUnion(u.id);
    return (kids.length ? '0' + dayKey(birth(kids[0]!)) : '1') + unionKey(u);
  };
  for (const [r, ids] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) continue;
      const group: string[] = [];
      const stack = [id];
      while (stack.length) {
        const cur = stack.pop()!;
        if (seen.has(cur)) continue;
        seen.add(cur);
        group.push(cur);
        for (const u of unionsOf(cur)) for (const p of u.partnerIds) if (memberSet.has(p) && rank.get(p) === r && !seen.has(p)) stack.push(p);
      }
      const ordered = orderBlock(group.sort(byBirthThenName), unionsOf, unionOrderKey, memberSet, nameKey);
      const block: Block = { members: ordered, rank: r, virtualUnion: null, key: nameKey(ordered[0]!) };
      blocks.push(block);
      for (const m of ordered) blockOf.set(m, block);
    }
  }
  // "Parents unknown" unions keep their children side by side as siblings.
  const virtualOf = new Map<string, Block>();
  for (const u of Object.values(project.unions).sort((a, b) => a.id.localeCompare(b.id))) {
    if (u.partnerIds.some((p) => memberSet.has(p))) continue;
    const kids = childrenOfUnion(u.id);
    if (!kids.length) continue;
    const block: Block = { members: [], rank: Math.min(...kids.map((k) => rank.get(k) ?? 0)) - 1, virtualUnion: u.id, key: `\u0000${u.id}` };
    blocks.push(block);
    virtualOf.set(u.id, block);
  }

  /** Parent blocks of a person with the union that links them. */
  const parentBlocksOf = (id: string): { block: Block; unionId: string }[] => {
    const out: { block: Block; unionId: string }[] = [];
    for (const l of adj.parentLinks.get(id) ?? []) {
      const u = project.unions[l.unionId];
      if (!u) continue;
      const parents = u.partnerIds.filter((p) => memberSet.has(p));
      if (parents.length) {
        const b = blockOf.get(parents[0]!)!;
        if (!out.some((o) => o.block === b && o.unionId === u.id)) out.push({ block: b, unionId: u.id });
      } else {
        const v = virtualOf.get(u.id);
        if (v) out.push({ block: v, unionId: u.id });
      }
    }
    return out;
  };
  /** Number of people below a block through any chain of child links (deciding which family "owns" a couple). */
  const weightCache = new Map<Block, number>();
  const weightOf = (b: Block): number => {
    const cached = weightCache.get(b);
    if (cached !== undefined) return cached;
    const seen = new Set<string>();
    const stack = b.virtualUnion ? childrenOfUnion(b.virtualUnion) : b.members.flatMap((m) => unionsOf(m).flatMap((u) => childrenOfUnion(u.id)));
    while (stack.length) {
      const cur = stack.pop()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const u of unionsOf(cur)) for (const c of childrenOfUnion(u.id)) if (!seen.has(c)) stack.push(c);
    }
    weightCache.set(b, seen.size);
    return seen.size;
  };

  // ---- 3. Ownership: every block hangs below exactly one parent block ----------------------
  // A couple whose two sides both have parents in the drawing is placed under the family with
  // more descendants; the other parents are drawn nearby with a line across.
  const owner = new Map<Block, { parent: Block; child: string }>();
  for (const b of blocks) {
    if (b.virtualUnion) continue;
    const candidates: { parent: Block; child: string }[] = [];
    for (const m of b.members) for (const pb of parentBlocksOf(m)) if (pb.block !== b && !candidates.some((c) => c.parent === pb.block && c.child === m)) candidates.push({ parent: pb.block, child: m });
    if (!candidates.length) continue;
    candidates.sort((p, q) => weightOf(q.parent) - weightOf(p.parent) || byBirthThenName(p.child, q.child) || p.parent.key.localeCompare(q.parent.key));
    owner.set(b, candidates[0]!);
  }
  const ownedChildren = new Map<Block, Block[]>();
  for (const b of blocks) ownedChildren.set(b, []);
  for (const [b, o] of owner) ownedChildren.get(o.parent)!.push(b);
  // Siblings from oldest (left) to youngest (right), across all of the parents' partnerships.
  for (const [, kids] of ownedChildren) kids.sort((p, q) => byBirthThenName(owner.get(p)!.child, owner.get(q)!.child));

  /** Card offsets inside a block, relative to its first card. */
  const offsetIn = (b: Block): Map<string, number> => {
    const out = new Map<string, number>();
    let cursor = 0;
    for (const m of b.members) {
      out.set(m, cursor);
      cursor += colOf(m);
    }
    return out;
  };
  const widthOf = (b: Block) => (b.members.length ? b.members.reduce((a, m) => a + colOf(m), 0) - gaps.columnGap * (scales[b.rank] ?? 1) : 0);
  /** Where a partnership's children hang from, relative to the block's first card (mirrors the connector routing). */
  const junctionOffset = (b: Block, unionId: string): number => {
    const u = project.unions[unionId]!;
    const off = offsetIn(b);
    const partners = u.partnerIds.filter((p) => off.has(p)).sort((p, q) => off.get(p)! - off.get(q)!);
    if (partners.length >= 2) {
      const [l, r] = [partners[0]!, partners[1]!];
      const adjacent = b.members.indexOf(r) - b.members.indexOf(l) === 1;
      return adjacent ? (off.get(l)! + cardW(l) + off.get(r)!) / 2 : off.get(l)! + cardW(l) / 2;
    }
    if (partners.length === 1) return off.get(partners[0]!)! + cardW(partners[0]!) / 2;
    return 0;
  };

  // ---- 4. Coordinates: each family is a subtree with its own space ------------------------
  const merge = (into: Subtree, sub: Subtree, dx: number) => {
    for (const [id, x] of sub.x) into.x.set(id, x + dx);
    for (const [r, c] of sub.contour) {
      const cur = into.contour.get(r);
      into.contour.set(r, cur ? { l: Math.min(cur.l, c.l + dx), r: Math.max(cur.r, c.r + dx) } : { l: c.l + dx, r: c.r + dx });
    }
  };
  const extent = (s: Subtree) => {
    let l = Infinity, r = -Infinity;
    for (const c of s.contour.values()) {
      l = Math.min(l, c.l);
      r = Math.max(r, c.r);
    }
    return { l, r };
  };
  /** Smallest shift that puts `sub` right of `acc` on every shared row (or right of everything when they share none). */
  const fitRight = (acc: Subtree, sub: Subtree): number => {
    let off = -Infinity;
    for (const [r, c] of sub.contour) {
      const a = acc.contour.get(r);
      if (a) off = Math.max(off, a.r + sepOf(r) - c.l);
    }
    return off === -Infinity ? extent(acc).r + BLOCK_GAP + gaps.columnGap - extent(sub).l : off;
  };
  const fitLeft = (acc: Subtree, sub: Subtree): number => {
    let off = Infinity;
    for (const [r, c] of sub.contour) {
      const a = acc.contour.get(r);
      if (a) off = Math.min(off, a.l - sepOf(r) - c.r);
    }
    return off === Infinity ? extent(acc).l - BLOCK_GAP - gaps.columnGap - extent(sub).r : off;
  };
  const blockSubtree = (b: Block, bx: number): Subtree => {
    const s: Subtree = { x: new Map(), contour: new Map() };
    if (!b.members.length) return s;
    for (const [m, o] of offsetIn(b)) s.x.set(m, bx + o);
    s.contour.set(b.rank, { l: bx, r: bx + widthOf(b) });
    return s;
  };
  const placeSubtree = (b: Block): Subtree => {
    const kids = ownedChildren.get(b)!;
    const acc: Subtree = { x: new Map(), contour: new Map() };
    for (const k of kids) {
      const sub = placeSubtree(k);
      merge(acc, sub, acc.contour.size ? fitRight(acc, sub) : 0);
    }
    if (!b.members.length) return acc;
    let bx = 0;
    if (kids.length) {
      // Every partnership's junction aims at the middle of its children; several partnerships share the block.
      const byUnion = new Map<string, string[]>();
      for (const k of kids) {
        const child = owner.get(k)!.child;
        for (const pb of parentBlocksOf(child)) {
          if (pb.block !== b) continue;
          const arr = byUnion.get(pb.unionId) ?? [];
          arr.push(child);
          byUnion.set(pb.unionId, arr);
        }
      }
      let sum = 0, n = 0;
      for (const [uid, children] of byUnion) {
        const l = Math.min(...children.map((c) => acc.x.get(c)!));
        const r = Math.max(...children.map((c) => acc.x.get(c)! + cardW(c)));
        sum += ((l + r) / 2 - junctionOffset(b, uid)) * children.length;
        n += children.length;
      }
      bx = n ? sum / n : 0;
    }
    merge(acc, blockSubtree(b, bx), 0);
    return acc;
  };

  // Root families. The largest family is the main tree; every other family is placed above the
  // person it married into (its "anchor") whenever one of its members has a child there, shifted
  // sideways by the least amount that keeps its own space; families without such a link go beside
  // the drawing on the side their links point to.
  const roots = blocks.filter((b) => !owner.has(b) && (b.members.length || ownedChildren.get(b)!.length));
  const rootKey = (p: Block, q: Block) => weightOf(q) + q.members.length - (weightOf(p) + p.members.length) || p.key.localeCompare(q.key);
  const subtrees = new Map<Block, Subtree>();
  for (const b of roots) subtrees.set(b, placeSubtree(b));
  const treeOf = new Map<string, Block>();
  for (const [b, s] of subtrees) for (const id of s.x.keys()) treeOf.set(id, b);
  /** A member of the tree with a child placed in another tree, deepest member first, then the oldest child. */
  const anchorOf = (b: Block, placed: Map<string, number>): { from: string; child: string; unionId: string } | null => {
    const found: { from: string; child: string; unionId: string }[] = [];
    for (const id of subtrees.get(b)!.x.keys()) for (const u of unionsOf(id)) for (const c of childrenOfUnion(u.id)) if (treeOf.get(c) !== b && placed.has(c)) found.push({ from: id, child: c, unionId: u.id });
    found.sort((p, q) => (rank.get(q.from) ?? 0) - (rank.get(p.from) ?? 0) || byBirthThenName(p.child, q.child) || p.unionId.localeCompare(q.unionId));
    return found[0] ?? null;
  };
  /** Any family link between the tree and people placed already (for families without an anchor). */
  const linksTo = (b: Block, placed: Map<string, number>): string[] => {
    const out: string[] = [];
    const inTree = subtrees.get(b)!.x;
    for (const id of inTree.keys()) {
      for (const u of unionsOf(id)) for (const c of childrenOfUnion(u.id)) if (!inTree.has(c) && placed.has(c)) out.push(c);
      for (const pb of parentBlocksOf(id)) for (const p of pb.block.members) if (!inTree.has(p) && placed.has(p)) out.push(p);
    }
    return out;
  };
  /** Card intervals of a subtree per row. */
  const intervalsOf = (s: Subtree): Map<number, { l: number; r: number }[]> => {
    const out = new Map<number, { l: number; r: number }[]>();
    for (const [id, x] of s.x) {
      const r = rank.get(id) ?? 0;
      const arr = out.get(r) ?? [];
      arr.push({ l: x, r: x + cardW(id) });
      out.set(r, arr);
    }
    return out;
  };
  /** The shift nearest to `want` that keeps `sub` clear of everything in `acc` on every row. */
  const nearestShift = (acc: Subtree, sub: Subtree, want: number): number => {
    const a = intervalsOf(acc), s = intervalsOf(sub);
    const forbidden: { l: number; r: number }[] = [];
    for (const [r, subs] of s) {
      const accs = a.get(r);
      if (!accs) continue;
      const sep = sepOf(r);
      for (const si of subs) for (const ai of accs) forbidden.push({ l: ai.l - sep - si.r, r: ai.r + sep - si.l });
    }
    forbidden.sort((p, q) => p.l - q.l);
    const merged: { l: number; r: number }[] = [];
    for (const f of forbidden) {
      const last = merged[merged.length - 1];
      if (last && f.l <= last.r) last.r = Math.max(last.r, f.r);
      else merged.push({ ...f });
    }
    const hit = merged.find((m) => want > m.l && want < m.r);
    if (!hit) return want;
    return want - hit.l <= hit.r - want ? hit.l : hit.r;
  };
  const forest: Subtree = { x: new Map(), contour: new Map() };
  const pending = [...roots].sort(rootKey);
  while (pending.length) {
    let pick = 0;
    let anchor: { from: string; child: string; unionId: string } | null = null;
    if (forest.x.size) {
      const i = pending.findIndex((b) => (anchor = anchorOf(b, forest.x)) !== null);
      if (i >= 0) pick = i;
      else {
        anchor = null;
        let best = 0;
        pending.forEach((b, j) => {
          const n = linksTo(b, forest.x).length;
          if (n > best) {
            best = n;
            pick = j;
          }
        });
      }
    }
    const [b] = pending.splice(pick, 1);
    const sub = subtrees.get(b!)!;
    let dx = 0;
    if (!forest.x.size) dx = 0;
    else if (anchor) {
      const a: { from: string; child: string; unionId: string } = anchor;
      const fromBlock = blockOf.get(a.from)!;
      const junction = sub.x.get(fromBlock.members[0]!)! + junctionOffset(fromBlock, a.unionId);
      dx = nearestShift(forest, sub, forest.x.get(a.child)! + cardW(a.child) / 2 - junction);
    } else {
      const links = linksTo(b!, forest.x);
      const fe = extent(forest);
      const mean = links.length ? links.reduce((acc, id) => acc + forest.x.get(id)! + cardW(id) / 2, 0) / links.length : fe.r;
      dx = mean < (fe.l + fe.r) / 2 ? fitLeft(forest, sub) : fitRight(forest, sub);
    }
    merge(forest, sub, dx);
  }
  const x = forest.x;

  // Rows stack with their own (scaled) heights; normalise to the origin.
  const maxRank = Math.max(...members.map((m) => rank.get(m) ?? 0));
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

/** Arrange a partnership-connected group: the hub (most unions) in the middle, partners on the side of their (oldest) children. */
function orderBlock(
  group: string[],
  unionsOf: (id: string) => { id: string; partnerIds: string[]; marriageDate: string | null }[],
  unionOrderKey: (u: { id: string; partnerIds: string[]; marriageDate: string | null }) => string,
  memberSet: Set<string>,
  nameKey: (id: string) => string,
): string[] {
  if (group.length <= 2) return group.length === 2 ? sortCouple(group as [string, string], unionsOf) : group;
  const hub = [...group].sort((a, b) => unionsOf(b).length - unionsOf(a).length || nameKey(a).localeCompare(nameKey(b)))[0]!;
  const partners = unionsOf(hub)
    .sort((a, b) => unionOrderKey(a).localeCompare(unionOrderKey(b)))
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
