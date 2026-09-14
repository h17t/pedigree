/**
 * "Balance generations": crowded generations get smaller cards so a family with 20
 * great-grandparents and 6 people in the youngest generation still reads as one balanced
 * drawing. The scale depends only on how many people each generation of a family holds, so
 * it is deterministic, survives manual moves and applies identically on screen and in print.
 */
import type { GenerationScaling, Project } from '@/model/types';
import { breakCycles, buildAdjacency, connectedComponents } from '@/model/graph';
import type { Adjacency } from '@/model/graph';
import { rankMembers } from './generational';

/** The smallest card scale a mode allows. */
export const MIN_SCALE: Record<GenerationScaling, number> = { off: 1, gentle: 0.6, strong: 0.35 };

/**
 * Scale per row from the head count of each row of one family. The target width is the wider
 * of (a) the widest row shrunk to the minimum scale and (b) the median row; rows narrower than
 * the target keep full size, wider rows shrink to it. A family whose rows are all of similar
 * size is therefore left alone.
 */
export function rowScales(counts: number[], mode: GenerationScaling): number[] {
  const min = MIN_SCALE[mode];
  if (min >= 1 || counts.length === 0) return counts.map(() => 1);
  const widest = Math.max(...counts);
  const sorted = counts.filter((n) => n > 0).sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)]! : widest;
  const target = Math.max(min * widest, median);
  return counts.map((n) => (n <= target ? 1 : Math.max(min, target / n)));
}

/** Row counts of a family from its ranks. */
export function rowCounts(rank: Map<string, number>): number[] {
  const counts: number[] = [];
  for (const r of rank.values()) counts[r] = (counts[r] ?? 0) + 1;
  for (let i = 0; i < counts.length; i++) counts[i] = counts[i] ?? 0;
  return counts;
}

/** Scale per person for the whole tree (1 for everyone when the mode is off). */
export function personScales(project: Project, mode: GenerationScaling, adjIn?: Adjacency): Map<string, number> {
  const out = new Map<string, number>();
  if (MIN_SCALE[mode] >= 1) return out;
  const adj = adjIn ?? buildAdjacency(project, breakCycles(project).ignoredLinks);
  for (const comp of connectedComponents(project)) {
    const rank = rankMembers(project, comp, adj);
    const scales = rowScales(rowCounts(rank), mode);
    for (const id of comp) out.set(id, scales[rank.get(id) ?? 0] ?? 1);
  }
  return out;
}

/** The smallest scale among the given people (1 when none is scaled). */
export function minScaleOf(scales: Map<string, number>, ids: Iterable<string>): number {
  let m = 1;
  for (const id of ids) m = Math.min(m, scales.get(id) ?? 1);
  return m;
}
