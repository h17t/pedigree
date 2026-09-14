import { describe, expect, it } from 'vitest';
import { layoutComponent, rankMembers } from '@/render/layout/generational';
import { buildAdjacency, breakCycles } from '@/model/graph';
import { packBoxes, clusterFrames } from '@/render/layout/clusters';
import { layoutAll, layoutSubset, placeUnpositioned } from '@/render/layout';
import { connectedComponents } from '@/model/graph';
import { card, layout } from '@/design/tokens';
import { cardHeight } from '@/render/geometry';
import { migrateProject } from '@/model/schema';
import sample from '@/fixtures/sample-family.json';
import perf from '@/fixtures/perf-500.json';
import { build, born } from './fixtures';
import type { Project } from '@/model/types';

const load = (x: unknown): Project => {
  const m = migrateProject(x);
  if (!m.ok) throw new Error('fixture');
  return m.project;
};
const sampleProject = load(sample);
const perfProject = load(perf);

function noOverlaps(positions: Map<string, { x: number; y: number }>, h: number, label = '') {
  const arr = [...positions.entries()];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      const [ia, a] = arr[i]!, [ib, b] = arr[j]!;
      const overlap = a.x < b.x + card.width && b.x < a.x + card.width && a.y < b.y + h && b.y < a.y + h;
      if (overlap) throw new Error(`${label} overlap ${ia} ${ib}`);
    }
  }
}

describe('layoutComponent', () => {
  it('places partners on one row side by side and children one row below, centred', () => {
    const b = build();
    const m = b.person('M', born('1900')), f = b.person('F', born('1898'));
    const k1 = b.person('K1', born('1925')), k2 = b.person('K2', born('1922'));
    b.family([m, f], [k1, k2]);
    const r = layoutComponent(b.project, Object.keys(b.project.persons), 'standard');
    const P = (id: string) => r.positions.get(id)!;
    expect(P(m.id).y).toBe(0);
    expect(P(f.id).y).toBe(0);
    expect(Math.abs(P(m.id).x - P(f.id).x)).toBe(card.width + layout.columnGap);
    expect(P(k1.id).y).toBe(cardHeight('standard') + layout.generationGap);
    expect(P(k2.id).x).toBeLessThan(P(k1.id).x); // siblings by birth
    const parentsCentre = (P(m.id).x + P(f.id).x) / 2;
    const kidsCentre = (P(k1.id).x + P(k2.id).x) / 2;
    expect(Math.abs(parentsCentre - kidsCentre)).toBeLessThan(1);
    expect(r.rows).toBe(2);
  });

  it('equalises partners from different generations and keeps children below both', () => {
    const b = build();
    const gp = b.person('GP'), p = b.person('P'), spouse = b.person('S'), k = b.person('K');
    b.family([gp], [p]);
    b.family([p, spouse], [k]);
    const r = layoutComponent(b.project, Object.keys(b.project.persons), 'minimal');
    expect(r.positions.get(spouse.id)!.y).toBe(r.positions.get(p.id)!.y);
    expect(r.positions.get(k.id)!.y).toBeGreaterThan(r.positions.get(p.id)!.y);
    expect(r.positions.get(gp.id)!.y).toBeLessThan(r.positions.get(p.id)!.y);
  });

  it('keeps a person with two marriages between the partners', () => {
    const b = build();
    const h = b.person('H'), w1 = b.person('W1'), w2 = b.person('W2');
    b.union([h, w1], { marriageDate: '1920' });
    b.union([h, w2], { marriageDate: '1940' });
    const r = layoutComponent(b.project, Object.keys(b.project.persons), 'minimal');
    const xs = [w1, h, w2].map((p) => r.positions.get(p.id)!.x);
    expect(xs[0]).toBeLessThan(xs[1]!);
    expect(xs[1]).toBeLessThan(xs[2]!);
  });

  it('terminates on cycles', () => {
    const b = build();
    const a = b.person('A'), c = b.person('C'), d = b.person('D');
    b.family([a], [c]);
    b.family([c], [d]);
    b.family([d], [a]);
    const r = layoutComponent(b.project, Object.keys(b.project.persons), 'minimal');
    expect(r.positions.size).toBe(3);
    expect(r.rows).toBe(3);
  });
});

describe('layoutAll on the sample', () => {
  const positions = layoutAll(sampleProject, 'standard');
  it('places everyone without overlaps, deterministically', () => {
    expect(positions.size).toBe(48);
    noOverlaps(positions, cardHeight('standard'), 'sample');
    const again = layoutAll(sampleProject, 'standard');
    expect([...again.entries()]).toEqual([...positions.entries()]);
  });
  it('separates the three clusters by at least the gutter, largest first', () => {
    const frames = clusterFrames(sampleProject, positions, 'standard');
    expect(frames.map((f) => f.personIds.length)).toEqual([40, 7, 1]);
    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1]!.box, cur = frames[i]!.box;
      const gapX = cur.x - (prev.x + prev.w);
      const gapY = cur.y - (prev.y + prev.h);
      expect(Math.max(gapX, gapY)).toBeGreaterThanOrEqual(layout.clusterGutter - 2 * 40 - 32);
    }
  });
  it('puts partners on the same row and children below their parents', () => {
    for (const u of Object.values(sampleProject.unions)) {
      const ys = u.partnerIds.map((p) => positions.get(p)!.y);
      if (ys.length === 2) expect(ys[0]).toBe(ys[1]);
      for (const l of Object.values(sampleProject.childLinks).filter((l) => l.unionId === u.id)) {
        for (const p of u.partnerIds) expect(positions.get(l.childId)!.y).toBeGreaterThan(positions.get(p)!.y);
      }
    }
  });
  it('lays out 500 people quickly', () => {
    const t0 = performance.now();
    const p = layoutAll(perfProject, 'standard');
    const ms = performance.now() - t0;
    expect(p.size).toBe(500);
    noOverlaps(p, cardHeight('standard'), 'perf');
    expect(ms).toBeLessThan(2000);
  });
});

describe('generation compaction and determinism', () => {
  it('puts the parents of a partner who married in level with their child, not with the other side\'s grandparents', () => {
    const b = build();
    const gg = b.person('GG'), g = b.person('G'), a = b.person('A'), bb = b.person('B'), bParent = b.person('BP');
    b.family([gg], [g]);
    b.family([g], [a]);
    b.family([a, bb], []);
    b.family([bParent], [bb]);
    const rank = rankMembers(b.project, Object.keys(b.project.persons), buildAdjacency(b.project, breakCycles(b.project).ignoredLinks));
    expect(rank.get(a.id)).toBe(rank.get(bb.id));
    expect(rank.get(bParent.id)).toBe(rank.get(g.id)); // one above the couple, like A's parent
    expect(rank.get(bParent.id)).toBe(rank.get(bb.id)! - 1);
  });

  it('gives the same drawing whatever order the people were entered in', () => {
    const make = (shuffle: boolean) => {
      const b = build();
      const names = ['Karl', 'Anna', 'Otto', 'Lena', 'Max', 'Eva'];
      const order = shuffle ? [...names].reverse() : names;
      const people = new Map(order.map((n) => [n, b.person(n, born(`19${(names.indexOf(n) + 1) * 10}`))]));
      b.family([people.get('Karl')!, people.get('Anna')!], [people.get('Otto')!, people.get('Lena')!, people.get('Max')!]);
      b.family([people.get('Lena')!, people.get('Eva')!], []);
      const r = layoutComponent(b.project, Object.keys(b.project.persons), 'standard');
      return names.map((n) => `${n}:${r.positions.get(people.get(n)!.id)!.x},${r.positions.get(people.get(n)!.id)!.y}`).join(' ');
    };
    expect(make(true)).toBe(make(false));
    // Siblings are ordered by birth: Otto (1930) left of Lena (1940) left of Max (1950).
    const b = build();
    const k = b.person('K'), a = b.person('A');
    const otto = b.person('Otto', born('1930')), lena = b.person('Lena', born('1940')), max = b.person('Max', born('1950'));
    b.family([k, a], [max, otto, lena]);
    const r = layoutComponent(b.project, Object.keys(b.project.persons), 'standard');
    expect(r.positions.get(otto.id)!.x).toBeLessThan(r.positions.get(lena.id)!.x);
    expect(r.positions.get(lena.id)!.x).toBeLessThan(r.positions.get(max.id)!.x);
  });

  it('keeps every sibling run centred under its parents by widening the rows above', () => {
    // Two couples on one row, each with many children: the runs must not be pushed sideways.
    const b = build();
    const gp1 = b.person('GP1'), gp2 = b.person('GP2');
    const p1 = b.person('P1', born('1900')), s1 = b.person('S1'), p2 = b.person('P2', born('1902')), s2 = b.person('S2');
    b.family([gp1, gp2], [p1, p2]);
    const kids1 = [1, 2, 3, 4].map((i) => b.person(`K1${i}`, born(`193${i}`)));
    const kids2 = [1, 2, 3, 4].map((i) => b.person(`K2${i}`, born(`193${i}`)));
    b.family([p1, s1], kids1);
    b.family([p2, s2], kids2);
    const r = layoutComponent(b.project, Object.keys(b.project.persons), 'standard');
    const P = (id: string) => r.positions.get(id)!;
    const centre = (ids: string[]) => (Math.min(...ids.map((i) => P(i).x)) + Math.max(...ids.map((i) => P(i).x + card.width))) / 2;
    const junction = (a: string, c: string) => (Math.min(P(a).x, P(c).x) + Math.max(P(a).x, P(c).x) + card.width) / 2;
    expect(Math.abs(centre(kids1.map((k) => k.id)) - junction(p1.id, s1.id))).toBeLessThan(2);
    expect(Math.abs(centre(kids2.map((k) => k.id)) - junction(p2.id, s2.id))).toBeLessThan(2);
    noOverlaps(r.positions, cardHeight('standard'), 'runs');
  });
});

describe('packBoxes', () => {
  it('rows up to four, then a grid', () => {
    const row = packBoxes([{ w: 100, h: 50 }, { w: 200, h: 80 }, { w: 50, h: 10 }], 10);
    expect(row).toEqual([{ x: 0, y: 0 }, { x: 110, y: 0 }, { x: 320, y: 0 }]);
    const grid = packBoxes(Array.from({ length: 9 }, () => ({ w: 100, h: 100 })), 10);
    expect(grid[3]).toEqual({ x: 0, y: 110 });
    expect(grid[8]).toEqual({ x: 220, y: 220 });
  });
});

describe('placeUnpositioned', () => {
  it('keeps stored positions, places nulls of a mixed component near their family without overlap', () => {
    const laid = layoutAll(sampleProject, 'standard');
    const project: Project = { ...sampleProject, persons: { ...sampleProject.persons } };
    for (const [id, pos] of laid) project.persons[id] = { ...project.persons[id]!, position: pos };
    // Un-place one child in the middle of the big family
    const victim = Object.values(project.childLinks)[5]!.childId;
    project.persons[victim] = { ...project.persons[victim]!, position: null };
    const r = placeUnpositioned(project, 'standard');
    expect(r.provisional).toEqual(new Set([victim]));
    for (const [id, pos] of laid) if (id !== victim) expect(r.positions.get(id)).toEqual(pos);
    noOverlaps(r.positions, cardHeight('standard'), 'mixed');
    const v = r.positions.get(victim)!;
    expect(Math.abs(v.x - laid.get(victim)!.x)).toBeLessThan(2000);
  });
  it('packs fully unplaced components to the right of everything placed', () => {
    const b = build();
    const a = b.person('A', { position: { x: 0, y: 0 } });
    const c = b.person('C');
    void a;
    void c;
    const r = placeUnpositioned(b.project, 'minimal');
    expect(r.positions.get(c.id)!.x).toBeGreaterThanOrEqual(card.width + layout.clusterGutter);
  });
});

describe('layoutSubset', () => {
  it('re-arranges only the given people around their current centre', () => {
    const laid = layoutAll(sampleProject, 'standard');
    const comps = connectedComponents(sampleProject);
    const ids = comps[1]!; // the Lindner family
    const shifted = new Map(laid);
    for (const id of ids) shifted.set(id, { x: laid.get(id)!.x + 5000, y: laid.get(id)!.y + 3000 });
    const r = layoutSubset(sampleProject, ids, shifted, 'standard');
    expect(r.size).toBe(ids.length);
    const cx = [...r.values()].reduce((a, p) => a + p.x, 0) / r.size;
    const ox = ids.reduce((a, id) => a + shifted.get(id)!.x, 0) / ids.length;
    expect(Math.abs(cx - ox)).toBeLessThan(2);
    noOverlaps(r, cardHeight('standard'), 'subset');
  });
});
