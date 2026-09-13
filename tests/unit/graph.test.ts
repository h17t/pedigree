import { describe, expect, it } from 'vitest';
import { build } from './fixtures';
import { ancestorsOf, breakCycles, connectedComponents, descendantsOf, generations } from '@/model/graph';

describe('breakCycles', () => {
  it('reports nothing on a plain tree', () => {
    const b = build();
    const gp = b.person('Grandparent'), p = b.person('Parent'), c = b.person('Child');
    b.family([gp], [p]);
    b.family([p], [c]);
    const r = breakCycles(b.project);
    expect(r.ignoredLinks.size).toBe(0);
    expect(r.affectedPersons.size).toBe(0);
  });

  it('breaks a person-is-own-ancestor loop with exactly one ignored edge and marks the loop members', () => {
    const b = build();
    const a = b.person('A'), c = b.person('C'), d = b.person('D');
    b.family([a], [c]);
    b.family([c], [d]);
    b.family([d], [a]); // closes the loop
    const r = breakCycles(b.project);
    expect(r.ignoredLinks.size).toBe(1);
    expect([...r.affectedPersons].sort()).toEqual([a.id, c.id, d.id].sort());
    // Which edge is dropped depends on id order, but the remainder is always a 3-node path:
    // traversals terminate, exclude self, and the descendant counts are 2, 1 and 0.
    for (const p of [a, c, d]) expect(ancestorsOf(b.project, p.id).has(p.id)).toBe(false);
    expect([a, c, d].map((p) => descendantsOf(b.project, p.id).size).sort()).toEqual([0, 1, 2]);
    expect(generations(b.project).count).toBe(3);
  });

  it('handles a person who is their own parent', () => {
    const b = build();
    const a = b.person('A');
    const u = b.union([a]);
    b.child(u, a);
    const r = breakCycles(b.project);
    expect(r.ignoredLinks.size).toBe(1);
    expect(r.affectedPersons.has(a.id)).toBe(true);
    expect(generations(b.project).byPerson.get(a.id)).toBe(0);
  });

  it('is deterministic for a large chain', () => {
    const b = build();
    const people = Array.from({ length: 300 }, (_, i) => b.person(`P${i}`));
    for (let i = 0; i < 299; i++) b.family([people[i]!], [people[i + 1]!]);
    b.family([people[299]!], [people[0]!]);
    const r1 = breakCycles(b.project), r2 = breakCycles(b.project);
    expect([...r1.ignoredLinks]).toEqual([...r2.ignoredLinks]);
    expect(generations(b.project).count).toBe(300);
  });
});

describe('traversals', () => {
  it('finds ancestors and descendants through unions, including adoptive links', () => {
    const b = build();
    const gm = b.person('Grandma'), m = b.person('Mother'), f = b.person('Father'), k = b.person('Kid'), ad = b.person('Adoptive');
    b.family([gm], [m]);
    const u = b.family([m, f], [k]);
    void u;
    const u2 = b.union([ad]);
    b.child(u2, k, 'adopted');
    expect([...ancestorsOf(b.project, k.id)].sort()).toEqual([gm.id, m.id, f.id, ad.id].sort());
    expect([...descendantsOf(b.project, gm.id)].sort()).toEqual([m.id, k.id].sort());
  });

  it('numbers generations from the roots', () => {
    const b = build();
    const gm = b.person('Grandma'), m = b.person('Mother'), f = b.person('Father'), k = b.person('Kid');
    b.family([gm], [m]);
    b.family([m, f], [k]);
    const g = generations(b.project);
    expect(g.byPerson.get(gm.id)).toBe(0);
    expect(g.byPerson.get(f.id)).toBe(0);
    expect(g.byPerson.get(m.id)).toBe(1);
    expect(g.byPerson.get(k.id)).toBe(2);
    expect(g.count).toBe(3);
  });
});

describe('connectedComponents', () => {
  it('separates disconnected families and isolated people, largest first', () => {
    const b = build();
    const a1 = b.person('A1'), a2 = b.person('A2'), a3 = b.person('A3');
    b.family([a1, a2], [a3]);
    const b1 = b.person('B1'), b2 = b.person('B2');
    b.family([b1], [b2]);
    const lone = b.person('Lone');
    const comps = connectedComponents(b.project);
    expect(comps.map((c) => c.length)).toEqual([3, 2, 1]);
    expect(comps[2]).toEqual([lone.id]);
  });
  it('links siblings of a zero-partner union', () => {
    const b = build();
    const s1 = b.person('S1'), s2 = b.person('S2');
    b.family([], [s1, s2]);
    expect(connectedComponents(b.project)).toHaveLength(1);
  });
});
