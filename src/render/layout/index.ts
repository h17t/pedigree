/**
 * Layout entry points used by the UI:
 *  - `layoutAll`: full auto-layout of every component, packed into clusters (positions for all).
 *  - `layoutSubset`: re-arrange only the given people, keeping their centre where it was.
 *  - `placeUnpositioned`: effective positions for display, placing `position: null` people
 *    into free space without touching anyone else (replaces the stage b provisional layout).
 */
import type { GenerationScaling, Position, Project, Spacing, SpacingPair } from '@/model/types';
import { card, layout } from '@/design/tokens';
import { personScales } from './scale';
import { breakCycles, buildAdjacency, connectedComponents } from '@/model/graph';
import type { DetailLevel } from '../geometry';
import { cardHeight } from '../geometry';
import { layoutComponent } from './generational';
import { packBoxes } from './clusters';

export interface Placement {
  positions: Map<string, Position>;
  provisional: Set<string>;
}

/** The tree's scaling mode (older stored trees may lack the field). */
export function scalingOf(project: Project): GenerationScaling {
  return project.settings.generationScaling ?? 'off';
}

/** The tree's spacing across and down (older stored trees may lack either field). */
export function spacingOf(project: Project): SpacingPair {
  const columns: Spacing = project.settings.spacing ?? 'normal';
  // A tree saved before the two axes could be chosen separately keeps its look: one setting for both.
  return { columns, rows: project.settings.rowSpacing ?? columns };
}

export function layoutAll(project: Project, level: DetailLevel, mode: GenerationScaling = scalingOf(project), spacing: SpacingPair = spacingOf(project)): Map<string, Position> {
  const adj = buildAdjacency(project, breakCycles(project).ignoredLinks);
  const comps = connectedComponents(project);
  const results = comps.map((ids) => layoutComponent(project, ids, level, adj, mode, spacing));
  const offsets = packBoxes(results.map((r) => ({ w: r.width, h: r.height })));
  const out = new Map<string, Position>();
  results.forEach((r, i) => {
    const o = offsets[i]!;
    for (const [id, p] of r.positions) out.set(id, { x: p.x + o.x, y: p.y + o.y });
  });
  return out;
}

/** Lay out only `ids` (as their own sub-graph) around the centre of their current positions. */
export function layoutSubset(project: Project, ids: string[], current: Map<string, Position>, level: DetailLevel): Map<string, Position> {
  const set = new Set(ids);
  const sub: Project = {
    ...project,
    persons: Object.fromEntries(ids.filter((id) => project.persons[id]).map((id) => [id, project.persons[id]!])),
    unions: Object.fromEntries(Object.entries(project.unions).map(([k, u]) => [k, { ...u, partnerIds: u.partnerIds.filter((p) => set.has(p)) }])),
    childLinks: Object.fromEntries(Object.entries(project.childLinks).filter(([, l]) => set.has(l.childId))),
  };
  const laid = layoutAll(sub, level, scalingOf(project));
  // Keep the group's centre where it was.
  const have = ids.filter((id) => current.has(id));
  if (have.length === 0) return laid;
  const oldC = centroid(have.map((id) => current.get(id)!));
  const newC = centroid(ids.map((id) => laid.get(id)!).filter(Boolean));
  const out = new Map<string, Position>();
  for (const [id, p] of laid) out.set(id, { x: Math.round(p.x + oldC.x - newC.x), y: Math.round(p.y + oldC.y - newC.y) });
  return out;
}

function centroid(ps: Position[]): Position {
  if (!ps.length) return { x: 0, y: 0 };
  return { x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length };
}

/**
 * Effective positions: stored positions pass through; people with `position: null` are laid
 * out per component. A component that is entirely unplaced is packed to the right of
 * everything placed; a mixed component is laid out and the unplaced members are translated so
 * that the placed members' centre matches, then nudged out of any overlap.
 */
export function placeUnpositioned(project: Project, level: DetailLevel): Placement {
  const positions = new Map<string, Position>();
  const provisional = new Set<string>();
  for (const p of Object.values(project.persons)) if (p.position) positions.set(p.id, p.position);
  const unplaced = new Set(Object.values(project.persons).filter((p) => !p.position).map((p) => p.id));
  if (unplaced.size === 0) return { positions, provisional };

  const adj = buildAdjacency(project, breakCycles(project).ignoredLinks);
  const mode = scalingOf(project);
  const scales = personScales(project, mode, adj);
  const h = cardHeight(level);
  const occupied: { x: number; y: number; w: number; h: number }[] = [];
  for (const [id, p] of positions) occupied.push({ x: p.x, y: p.y, w: card.width * (scales.get(id) ?? 1), h: h * (scales.get(id) ?? 1) });
  const overlaps = (p: Position, w: number, hh: number) => occupied.some((o) => p.x < o.x + o.w + 8 && o.x < p.x + w + 8 && p.y < o.y + o.h + 8 && o.y < p.y + hh + 8);
  let rightEdge = 0;
  for (const o of occupied) rightEdge = Math.max(rightEdge, o.x + o.w + layout.clusterGutter);
  const pending: { w: number; h: number; positions: Map<string, Position> }[] = [];

  for (const comp of connectedComponents(project)) {
    const missing = comp.filter((id) => unplaced.has(id));
    if (missing.length === 0) continue;
    const placedMembers = comp.filter((id) => !unplaced.has(id));
    const laid = layoutComponent(project, comp, level, adj, mode, spacingOf(project));
    if (placedMembers.length === 0) {
      pending.push({ w: laid.width, h: laid.height, positions: laid.positions });
      continue;
    }
    // Mixed: translate the layout so the placed members' centroid matches their real centroid.
    const realC = centroid(placedMembers.map((id) => positions.get(id)!));
    const laidC = centroid(placedMembers.map((id) => laid.positions.get(id)!));
    for (const id of missing) {
      const p = laid.positions.get(id)!;
      const cand = { x: Math.round(p.x + realC.x - laidC.x), y: Math.round(p.y + realC.y - laidC.y) };
      const sc = scales.get(id) ?? 1;
      let guard = 0;
      while (overlaps(cand, card.width * sc, h * sc) && guard++ < 200) cand.x += card.width + layout.columnGap;
      // Still no free space on that line: start a fresh row below everything rather than overlap.
      if (overlaps(cand, card.width * sc, h * sc)) {
        cand.x = Math.round(realC.x);
        cand.y = Math.round(Math.max(...occupied.map((o) => o.y + o.h)) + layout.generationGap);
      }
      positions.set(id, cand);
      provisional.add(id);
      occupied.push({ ...cand, w: card.width * sc, h: h * sc });
    }
  }
  // Fully unplaced components go to the right of everything, packed as clusters.
  const offsets = packBoxes(pending.map((p) => ({ w: p.w, h: p.h })));
  pending.forEach((c, i) => {
    const o = offsets[i]!;
    for (const [id, p] of c.positions) {
      const pos = { x: p.x + o.x + rightEdge, y: p.y + o.y };
      positions.set(id, pos);
      provisional.add(id);
    }
  });
  return { positions, provisional };
}
