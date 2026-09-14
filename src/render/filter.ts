/**
 * Focus/filter mode: only ancestors, only descendants, or the close family of a person.
 * Cycle-safe through the graph utilities. Ancestors are exactly the ancestors; descendants
 * bring their partners (the co-parents of the next generation); "around" is parents,
 * children, siblings and grandparents/grandchildren within n steps plus the person's own
 * partners, never the partners of relatives (no in-laws, no ex-partners of a partner).
 */
import type { Project } from '@/model/types';
import { ancestorsOf, breakCycles, buildAdjacency, childrenOf, descendantsOf, parentsOf } from '@/model/graph';

export type Filter = { kind: 'ancestors'; personId: string } | { kind: 'descendants'; personId: string } | { kind: 'around'; personId: string; generations: number } | { kind: 'ids'; ids: string[] };

export function visiblePersons(project: Project, filter: Filter | null): Set<string> {
  const all = new Set(Object.keys(project.persons));
  if (!filter) return all;
  if (filter.kind === 'ids') return new Set(filter.ids.filter((id) => project.persons[id]));
  if (!project.persons[filter.personId]) return all;
  const adj = buildAdjacency(project, breakCycles(project).ignoredLinks);
  const set = new Set<string>([filter.personId]);
  if (filter.kind === 'ancestors') {
    for (const id of ancestorsOf(project, filter.personId, adj)) set.add(id);
    return set;
  }
  if (filter.kind === 'descendants') {
    for (const id of descendantsOf(project, filter.personId, adj)) set.add(id);
    // Partners of visible people (they sit on the same row and share the junction).
    for (const id of [...set]) {
      for (const uid of adj.partnerUnions.get(id) ?? []) for (const p of project.unions[uid]?.partnerIds ?? []) if (project.persons[p]) set.add(p);
    }
    return set;
  }
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
  // Siblings (children of the person's parent unions) and the person's own partners.
  if (filter.generations >= 1) {
    for (const l of adj.parentLinks.get(filter.personId) ?? []) for (const c of adj.unionChildren.get(l.unionId) ?? []) if (project.persons[c.childId]) set.add(c.childId);
  }
  for (const uid of adj.partnerUnions.get(filter.personId) ?? []) for (const p of project.unions[uid]?.partnerIds ?? []) if (project.persons[p]) set.add(p);
  return set;
}
