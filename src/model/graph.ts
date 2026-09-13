/**
 * Graph utilities over a project. All traversals are iterative with visited sets, so a
 * cyclic tree (a person recorded as their own ancestor) can never hang or overflow.
 * `breakCycles` yields the set of child links to ignore for layout, filters and generation
 * counting; the data itself is never changed.
 */
import type { ChildLink, Project } from './types';

export interface Adjacency {
  /** personId -> unions in which the person is a partner */
  partnerUnions: Map<string, string[]>;
  /** personId -> child links where the person is the child */
  parentLinks: Map<string, ChildLink[]>;
  /** unionId -> child links of that union */
  unionChildren: Map<string, ChildLink[]>;
}

export function buildAdjacency(project: Project, ignoredLinks: ReadonlySet<string> = new Set()): Adjacency {
  const partnerUnions = new Map<string, string[]>();
  const parentLinks = new Map<string, ChildLink[]>();
  const unionChildren = new Map<string, ChildLink[]>();
  for (const u of Object.values(project.unions)) {
    for (const pid of u.partnerIds) {
      const arr = partnerUnions.get(pid) ?? [];
      arr.push(u.id);
      partnerUnions.set(pid, arr);
    }
  }
  for (const l of Object.values(project.childLinks)) {
    if (ignoredLinks.has(l.id)) continue;
    if (!project.unions[l.unionId] || !project.persons[l.childId]) continue;
    const a = parentLinks.get(l.childId) ?? [];
    a.push(l);
    parentLinks.set(l.childId, a);
    const b = unionChildren.get(l.unionId) ?? [];
    b.push(l);
    unionChildren.set(l.unionId, b);
  }
  return { partnerUnions, parentLinks, unionChildren };
}

/** Direct parents of a person (partners of the unions the person is a child of). */
export function parentsOf(project: Project, adj: Adjacency, personId: string): string[] {
  const out: string[] = [];
  for (const l of adj.parentLinks.get(personId) ?? []) {
    for (const pid of project.unions[l.unionId]?.partnerIds ?? []) if (!out.includes(pid)) out.push(pid);
  }
  return out;
}

/** Direct children of a person via all their unions. */
export function childrenOf(adj: Adjacency, personId: string): string[] {
  const out: string[] = [];
  for (const uid of adj.partnerUnions.get(personId) ?? []) {
    for (const l of adj.unionChildren.get(uid) ?? []) if (!out.includes(l.childId)) out.push(l.childId);
  }
  return out;
}

export interface CycleReport {
  /** Child links whose removal makes the parent graph acyclic. */
  ignoredLinks: Set<string>;
  /** People that sit on at least one cycle. */
  affectedPersons: Set<string>;
}

/**
 * Detect cycles in the parent→child relation with an iterative DFS. Whenever an edge leads
 * to a node on the current stack, that edge is recorded as "ignored" and skipped, so the
 * result is always a DAG. Deterministic: ids are visited in sorted order.
 */
export function breakCycles(project: Project): CycleReport {
  const ignoredLinks = new Set<string>();
  const affectedPersons = new Set<string>();
  const adj = buildAdjacency(project);
  const WHITE = 0, GREY = 1, BLACK = 2;
  const state = new Map<string, number>();
  const ids = Object.keys(project.persons).sort();

  // child edges from a person: for each union they are partner of, each child link
  const edgesFrom = (pid: string): ChildLink[] => {
    const out: ChildLink[] = [];
    for (const uid of adj.partnerUnions.get(pid) ?? []) for (const l of adj.unionChildren.get(uid) ?? []) out.push(l);
    return out.sort((a, b) => (a.childId < b.childId ? -1 : a.childId > b.childId ? 1 : 0));
  };

  for (const root of ids) {
    if ((state.get(root) ?? WHITE) !== WHITE) continue;
    const stack: { id: string; edges: ChildLink[]; i: number }[] = [{ id: root, edges: edgesFrom(root), i: 0 }];
    state.set(root, GREY);
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      if (top.i >= top.edges.length) {
        state.set(top.id, BLACK);
        stack.pop();
        continue;
      }
      const link = top.edges[top.i++]!;
      if (ignoredLinks.has(link.id)) continue;
      const s = state.get(link.childId) ?? WHITE;
      if (s === GREY) {
        ignoredLinks.add(link.id);
        // Everyone from the child up to the top of the stack is on the cycle.
        const idx = stack.findIndex((f) => f.id === link.childId);
        for (let k = Math.max(idx, 0); k < stack.length; k++) affectedPersons.add(stack[k]!.id);
      } else if (s === WHITE) {
        state.set(link.childId, GREY);
        stack.push({ id: link.childId, edges: edgesFrom(link.childId), i: 0 });
      }
    }
  }
  return { ignoredLinks, affectedPersons };
}

/** All ancestors of a person (excluding self), cycle-safe. */
export function ancestorsOf(project: Project, personId: string, adj = buildAdjacency(project, breakCycles(project).ignoredLinks)): Set<string> {
  const seen = new Set<string>();
  const queue = [personId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const p of parentsOf(project, adj, id)) {
      if (!seen.has(p) && p !== personId) {
        seen.add(p);
        queue.push(p);
      }
    }
  }
  return seen;
}

/** All descendants of a person (excluding self), cycle-safe. */
export function descendantsOf(project: Project, personId: string, adj = buildAdjacency(project, breakCycles(project).ignoredLinks)): Set<string> {
  const seen = new Set<string>();
  const queue = [personId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const c of childrenOf(adj, id)) {
      if (!seen.has(c) && c !== personId) {
        seen.add(c);
        queue.push(c);
      }
    }
  }
  return seen;
}

/**
 * Connected components over persons and unions (partner and child edges alike).
 * Returns arrays of person ids sorted by component size descending, then by smallest id.
 */
export function connectedComponents(project: Project): string[][] {
  const adj = buildAdjacency(project);
  const seen = new Set<string>();
  const comps: string[][] = [];
  for (const start of Object.keys(project.persons).sort()) {
    if (seen.has(start)) continue;
    const comp: string[] = [];
    const queue = [start];
    seen.add(start);
    while (queue.length) {
      const id = queue.shift()!;
      comp.push(id);
      const neighbours = new Set<string>();
      for (const uid of adj.partnerUnions.get(id) ?? []) {
        for (const pid of project.unions[uid]?.partnerIds ?? []) neighbours.add(pid);
        for (const l of adj.unionChildren.get(uid) ?? []) neighbours.add(l.childId);
      }
      for (const l of adj.parentLinks.get(id) ?? []) {
        for (const pid of project.unions[l.unionId]?.partnerIds ?? []) neighbours.add(pid);
        for (const sib of adj.unionChildren.get(l.unionId) ?? []) neighbours.add(sib.childId);
      }
      for (const n of neighbours) {
        if (project.persons[n] && !seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    comps.push(comp.sort());
  }
  return comps.sort((a, b) => b.length - a.length || (a[0]! < b[0]! ? -1 : 1));
}

/**
 * Generation numbers: 0 for people without parents, parents' max + 1 otherwise. Partners
 * are not forced to equal ranks here (that is a layout concern). Cycle-safe via breakCycles.
 */
export function generations(project: Project): { byPerson: Map<string, number>; count: number } {
  const { ignoredLinks } = breakCycles(project);
  const adj = buildAdjacency(project, ignoredLinks);
  const memo = new Map<string, number>();
  const ids = Object.keys(project.persons);
  // Iterative post-order over parents.
  for (const start of ids) {
    if (memo.has(start)) continue;
    const stack: string[] = [start];
    const visiting = new Set<string>();
    while (stack.length) {
      const id = stack[stack.length - 1]!;
      if (memo.has(id)) {
        stack.pop();
        continue;
      }
      const parents = parentsOf(project, adj, id).filter((p) => project.persons[p]);
      const pending = parents.filter((p) => !memo.has(p) && !visiting.has(p));
      if (pending.length) {
        visiting.add(id);
        for (const p of pending) stack.push(p);
        continue;
      }
      const gen = parents.length ? Math.max(...parents.map((p) => memo.get(p) ?? 0)) + 1 : 0;
      memo.set(id, gen);
      visiting.delete(id);
      stack.pop();
    }
  }
  const count = ids.length ? Math.max(...ids.map((id) => memo.get(id) ?? 0)) + 1 : 0;
  return { byPerson: memo, count };
}
