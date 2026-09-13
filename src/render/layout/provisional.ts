/**
 * Provisional placement for people whose `position` is null. Stage (d) replaces this with the
 * full generational layout (crossing reduction, cluster packing, placement into free space).
 * Until then this gives every unplaced person a deterministic, non-overlapping spot: one row per
 * generation, ordered like the outline (partners adjacent, siblings by birth), components side
 * by side. Existing positions are kept untouched.
 */
import type { Position, Project } from '@/model/types';
import { card, layout } from '@/design/tokens';
import { breakCycles, buildAdjacency, connectedComponents, generations } from '@/model/graph';
import { toOrdinal } from '@/model/dates';
import type { DetailLevel } from '../geometry';
import { cardHeight } from '../geometry';

export interface Placement {
  /** Position for every person (existing positions pass through). */
  positions: Map<string, Position>;
  /** Ids that were placed provisionally (position is still null in the data). */
  provisional: Set<string>;
}

export function placeProvisional(project: Project, level: DetailLevel): Placement {
  const positions = new Map<string, Position>();
  const provisional = new Set<string>();
  for (const p of Object.values(project.persons)) if (p.position) positions.set(p.id, p.position);

  const unplaced = Object.values(project.persons).filter((p) => !p.position);
  if (unplaced.length === 0) return { positions, provisional };

  const { ignoredLinks } = breakCycles(project);
  const adj = buildAdjacency(project, ignoredLinks);
  const gen = generations(project).byPerson;
  const rowH = cardHeight(level) + layout.generationGap;
  const colW = card.width + layout.columnGap;
  const birth = (id: string) => toOrdinal(project.persons[id]?.birth.date ?? null) ?? Number.MAX_SAFE_INTEGER;

  // Start to the right of everything already placed.
  let originX = 0;
  for (const p of positions.values()) originX = Math.max(originX, p.x + card.width + layout.clusterGutter);
  const unplacedSet = new Set(unplaced.map((p) => p.id));

  for (const comp of connectedComponents(project)) {
    const members = comp.filter((id) => unplacedSet.has(id));
    if (members.length === 0) continue;
    const memberSet = new Set(members);
    // Partners are equalised to the deeper generation so couples sit on one row.
    const row = new Map<string, number>();
    for (const id of members) row.set(id, gen.get(id) ?? 0);
    for (const u of Object.values(project.unions)) {
      const ps = u.partnerIds.filter((p) => memberSet.has(p));
      if (ps.length > 1) {
        const r = Math.max(...ps.map((p) => row.get(p) ?? 0));
        for (const p of ps) row.set(p, r);
      }
    }
    // Order within a row: depth-first from the roots, partners adjacent, siblings by birth.
    const ordered: string[] = [];
    const seen = new Set<string>();
    const visit = (id: string) => {
      if (seen.has(id) || !memberSet.has(id)) return;
      seen.add(id);
      ordered.push(id);
      const unions = (adj.partnerUnions.get(id) ?? []).map((uid) => project.unions[uid]!).sort((a, b) => (toOrdinal(a.marriageDate) ?? 0) - (toOrdinal(b.marriageDate) ?? 0));
      for (const u of unions) {
        for (const p of u.partnerIds) visit(p);
        const kids = (adj.unionChildren.get(u.id) ?? []).map((l) => l.childId).sort((a, b) => birth(a) - birth(b));
        for (const k of kids) visit(k);
      }
    };
    const roots = members.filter((id) => (adj.parentLinks.get(id) ?? []).length === 0).sort((a, b) => birth(a) - birth(b));
    for (const r of roots) visit(r);
    for (const id of members) visit(id);

    const nextX = new Map<number, number>();
    let maxX = originX;
    for (const id of ordered) {
      const r = row.get(id) ?? 0;
      const x = nextX.get(r) ?? originX;
      positions.set(id, { x, y: r * rowH });
      provisional.add(id);
      nextX.set(r, x + colW);
      maxX = Math.max(maxX, x + colW);
    }
    originX = maxX + layout.clusterGutter;
  }
  return { positions, provisional };
}
