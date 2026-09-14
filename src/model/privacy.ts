/**
 * "Hide private people": a copy of the project without the people marked private. Their
 * partnerships stay for the remaining partner (as a single parent) and their children keep
 * their other parent; child links of private children are dropped. Used for print, SVG/PNG
 * and GEDCOM export (on by default there) and for the canvas (off by default).
 */
import type { Project } from './types';

export function privateIds(project: Project): Set<string> {
  return new Set(Object.values(project.persons).filter((p) => p.isPrivate).map((p) => p.id));
}

export function withoutPrivate(project: Project): Project {
  const hidden = privateIds(project);
  if (hidden.size === 0) return project;
  const persons: Project['persons'] = {};
  for (const [id, p] of Object.entries(project.persons)) if (!hidden.has(id)) persons[id] = p;
  const childLinks: Project['childLinks'] = {};
  for (const [id, l] of Object.entries(project.childLinks)) if (!hidden.has(l.childId)) childLinks[id] = l;
  const unions: Project['unions'] = {};
  for (const [id, u] of Object.entries(project.unions)) {
    const partnerIds = u.partnerIds.filter((x) => !hidden.has(x));
    const hasChildren = Object.values(childLinks).some((l) => l.unionId === id);
    if (partnerIds.length === 0 && !hasChildren) continue;
    unions[id] = partnerIds.length === u.partnerIds.length ? u : { ...u, partnerIds };
  }
  // A union that lost a partner and has no children left is only noise.
  for (const [id, u] of Object.entries(unions)) {
    if (u.partnerIds.length < 2 && u.partnerIds.length < project.unions[id]!.partnerIds.length && !Object.values(childLinks).some((l) => l.unionId === id)) delete unions[id];
  }
  return { ...project, persons, unions, childLinks };
}
