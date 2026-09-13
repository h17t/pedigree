/**
 * Focus/filter mode: only ancestors, only descendants, or n generations around a person.
 * Cycle-safe through the graph utilities. Partners of visible people are included so
 * couples stay together.
 */
import type { Project } from '@/model/types';
import { ancestorsOf, breakCycles, buildAdjacency, childrenOf, descendantsOf, parentsOf } from '@/model/graph';

export type Filter = { kind: 'ancestors'; personId: string } | { kind: 'descendants'; personId: string } | { kind: 'around'; personId: string; generations: number };

export function visiblePersons(project: Project, filter: Filter | null): Set<string> {
  const all = new Set(Object.keys(project.persons));
  if (!filter || !project.persons[filter.personId]) return all;
  const adj = buildAdjacency(project, breakCycles(project).ignoredLinks);
  const set = new Set<string>([filter.personId]);
  if (filter.kind === 'ancestors') for (const id of ancestorsOf(project, filter.personId, adj)) set.add(id);
  else if (filter.kind === 'descendants') for (const id of descendantsOf(project, filter.personId, adj)) set.add(id);
  else {
    // Breadth-first up and down, limited to n steps.
    let frontier = [filter.personId];
    for (let g = 0; g < filter.generations && frontier.length; g++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const n of [...parentsOf(project, adj, id), ...childrenOf(adj, id)]) {
          if (!set.has(n)) {
            set.add(n);
            next.push(n);
          }
        }
      }
      frontier = next;
    }
  }
  // Add partners of visible people (they sit on the same row and share the junction).
  for (const id of [...set]) {
    for (const uid of adj.partnerUnions.get(id) ?? []) for (const p of project.unions[uid]?.partnerIds ?? []) if (project.persons[p]) set.add(p);
  }
  return set;
}
