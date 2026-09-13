/**
 * Builds the indented outline of a project: one section per connected family (largest
 * first), roots are people without recorded parents, each person lists their unions and the
 * children under each union. A person who appears under two unions (e.g. biological and
 * adoptive parents) is shown twice; the second occurrence is marked. Cycle-safe.
 */
import type { Project, Union } from '@/model/types';
import { personName } from '@/model/types';
import { buildAdjacency, breakCycles, connectedComponents } from '@/model/graph';
import { toOrdinal } from '@/model/dates';

export interface PersonRow {
  kind: 'person';
  key: string;
  personId: string;
  depth: number;
  /** Unions where this person is a partner, in display order. */
  unions: UnionRow[];
  /** Set when the person was already listed elsewhere (multiple parent unions). */
  alsoUnder: string | null;
  /** Whether this person is the child of a zero-partner union. */
  parentsUnknown: boolean;
}

export interface UnionRow {
  kind: 'union';
  key: string;
  unionId: string;
  depth: number;
  partnerIds: string[];
  children: PersonRow[];
}

export interface Section {
  index: number;
  personIds: string[];
  roots: PersonRow[];
  /** Zero-partner unions (sibling groups) whose children are roots of this section. */
  orphanGroups: UnionRow[];
  isolated: boolean;
}

export interface Outline {
  sections: Section[];
  /** Persons who have expandable children rows, for expand/collapse-all. */
  expandableIds: string[];
}

export function buildOutline(project: Project): Outline {
  const { ignoredLinks } = breakCycles(project);
  const adj = buildAdjacency(project, ignoredLinks);
  const listedAs = new Map<string, string>(); // personId -> key of the first listing
  const expandableIds: string[] = [];

  const byBirth = (a: string, b: string) => {
    const pa = project.persons[a], pb = project.persons[b];
    const oa = toOrdinal(pa?.birth.date ?? null) ?? Number.MAX_SAFE_INTEGER;
    const ob = toOrdinal(pb?.birth.date ?? null) ?? Number.MAX_SAFE_INTEGER;
    return oa - ob || personName(pa!).localeCompare(personName(pb!));
  };
  const unionOrder = (a: Union, b: Union) => {
    const oa = toOrdinal(a.marriageDate) ?? Number.MAX_SAFE_INTEGER;
    const ob = toOrdinal(b.marriageDate) ?? Number.MAX_SAFE_INTEGER;
    return oa - ob;
  };

  function personRow(personId: string, depth: number, parentKey: string, parentsUnknown: boolean, path: Set<string>): PersonRow {
    const key = `${parentKey}/${personId}`;
    const already = listedAs.get(personId) ?? null;
    if (!already) listedAs.set(personId, key);
    const row: PersonRow = { kind: 'person', key, personId, depth, unions: [], alsoUnder: null, parentsUnknown };
    if (already) {
      row.alsoUnder = already;
      return row; // do not expand a second listing
    }
    if (path.has(personId)) return row; // defensive: never recurse into a cycle
    const nextPath = new Set(path).add(personId);
    const unions = (adj.partnerUnions.get(personId) ?? [])
      .map((id) => project.unions[id]!)
      .filter(Boolean)
      .sort(unionOrder);
    for (const u of unions) {
      const children = (adj.unionChildren.get(u.id) ?? []).map((l) => l.childId).sort(byBirth);
      const urow: UnionRow = { kind: 'union', key: `${key}/u/${u.id}`, unionId: u.id, depth: depth + 1, partnerIds: u.partnerIds.filter((p) => p !== personId), children: [] };
      for (const c of children) urow.children.push(personRow(c, depth + 2, urow.key, false, nextPath));
      row.unions.push(urow);
      // Partners listed inline are considered listed so they do not become extra roots.
      for (const p of urow.partnerIds) if (!listedAs.has(p)) listedAs.set(p, key);
    }
    if (row.unions.some((u) => u.children.length > 0)) expandableIds.push(personId);
    return row;
  }

  const sections: Section[] = [];
  const comps = connectedComponents(project);
  comps.forEach((personIds, i) => {
    const idSet = new Set(personIds);
    const section: Section = { index: i + 1, personIds, roots: [], orphanGroups: [], isolated: personIds.length === 1 && !(adj.partnerUnions.get(personIds[0]!)?.length) };
    // zero-partner unions inside this component
    const orphanUnions = Object.values(project.unions).filter((u) => u.partnerIds.length === 0 && (adj.unionChildren.get(u.id) ?? []).some((l) => idSet.has(l.childId)));
    const rootCandidates = personIds.filter((id) => (adj.parentLinks.get(id) ?? []).length === 0).sort(byBirth);
    // Roots first so that partners of roots are marked as listed before we look at them.
    for (const u of orphanUnions.sort(unionOrder)) {
      const children = (adj.unionChildren.get(u.id) ?? []).map((l) => l.childId).sort(byBirth);
      const urow: UnionRow = { kind: 'union', key: `s${i}/u/${u.id}`, unionId: u.id, depth: 0, partnerIds: [], children: [] };
      for (const c of children) urow.children.push(personRow(c, 1, urow.key, true, new Set()));
      section.orphanGroups.push(urow);
    }
    for (const id of rootCandidates) {
      if (listedAs.has(id)) continue;
      section.roots.push(personRow(id, 0, `s${i}`, false, new Set()));
    }
    // Anyone still unlisted (only possible in cycles) becomes a root too.
    for (const id of personIds) if (!listedAs.has(id)) section.roots.push(personRow(id, 0, `s${i}`, false, new Set()));
    sections.push(section);
  });
  return { sections, expandableIds };
}

/** Case- and diacritic-insensitive search over names. */
export function normalizeForSearch(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ß/g, 'ss');
}

export function searchPersons(project: Project, query: string): string[] {
  const q = normalizeForSearch(query.trim());
  if (!q) return [];
  return Object.values(project.persons)
    .filter((p) => normalizeForSearch([p.titlePrefix, p.givenNames, p.surname, p.birthName, p.nickname].join(' ')).includes(q))
    .sort((a, b) => personName(a).localeCompare(personName(b)))
    .map((p) => p.id);
}
