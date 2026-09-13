import { describe, expect, it } from 'vitest';
import { measureText, truncateLine, wrapText } from '@/render/text';
import { cardText, cardHeight, textWidth } from '@/render/geometry';
import { placeUnpositioned } from '@/render/layout';
import { routeUnions, partnerStyle, orthogonalH, orthogonalV } from '@/render/connectors';
import type { Box } from '@/render/geometry';
import { fitTo, zoomAt, clampZoom } from '@/render/viewport';
import { visiblePersons } from '@/render/filter';
import { createPerson } from '@/model/types';
import { build, born, died } from './fixtures';
import sample from '@/fixtures/sample-family.json';
import { migrateProject } from '@/model/schema';
import { card } from '@/design/tokens';

const sampleProject = (() => {
  const m = migrateProject(sample);
  if (!m.ok) throw new Error('sample');
  return m.project;
})();

describe('text wrapping', () => {
  it('measures monotonically and truncates with an ellipsis', () => {
    expect(measureText('Anna', 17)).toBeLessThan(measureText('Anna Maria', 17));
    const r = truncateLine('Wilhelmine Charlotte Großmann-Hüttenberger', 100, 17, 700);
    expect(r.truncated).toBe(true);
    expect(r.text.endsWith('…')).toBe(true);
    expect(measureText(r.text, 17, 700)).toBeLessThanOrEqual(100);
  });
  it('wraps to at most two lines and truncates the rest', () => {
    const w = wrapText('Wilhelmine Charlotte Großmann-Hüttenberger von und zu Landau', textWidth, 2, 17, 700);
    expect(w.lines).toHaveLength(2);
    expect(w.truncated).toBe(true);
    expect(w.lines[1]!.endsWith('…')).toBe(true);
    for (const l of w.lines) expect(measureText(l, 17, 700)).toBeLessThanOrEqual(textWidth);
  });
  it('keeps short names on one line without truncation', () => {
    const w = wrapText('Karl Weber', textWidth, 2, 17, 700);
    expect(w).toEqual({ lines: ['Karl Weber'], truncated: false });
  });
  it('cuts a single over-long word', () => {
    const w = wrapText('X'.repeat(80), 100, 2, 17, 700);
    expect(w.lines).toHaveLength(2);
    expect(w.truncated).toBe(true);
  });
});

describe('card text and geometry', () => {
  const p = createPerson({ givenNames: 'Anna Maria', surname: 'Weber', birthName: 'Schmidt', occupation: 'Lehrerin', residence: 'Berlin', ...born('1923-03-14'), ...died('2001-01-02') });
  p.birth.place = 'Berlin';
  p.notes = 'A very long note. '.repeat(40);
  it('heights are the four fixed variants regardless of content', () => {
    expect(cardHeight('minimal')).toBe(84);
    expect(cardHeight('standard')).toBe(124);
    expect(cardHeight('full')).toBe(164);
    expect(cardHeight('full', true)).toBe(280);
    expect(card.width).toBe(220);
  });
  it('minimal shows name and years with marks', () => {
    const t = cardText(p, 'minimal', 'en');
    expect(t.nameLines).toEqual(['Anna Maria Weber']);
    expect(t.lines).toEqual(['1923 – † 2001']);
    expect(t.deceased).toBe(true);
  });
  it('standard shows full dates with places and occupation', () => {
    const t = cardText(p, 'standard', 'de');
    expect(t.lines).toEqual(['* 14.03.1923, Berlin', '† 02.01.2001', 'Lehrerin']);
  });
  it('full adds birth name and residence; print full clamps notes to four lines', () => {
    const t = cardText(p, 'full', 'en', false, { née: 'née', living: 'living', unknownDate: '' });
    expect(t.lines.slice(3)).toEqual(['née Schmidt', 'Berlin']);
    expect(t.noteLines).toEqual([]);
    const tp = cardText(p, 'full', 'en', true, { née: 'née', living: 'living', unknownDate: '' });
    expect(tp.noteLines).toHaveLength(4);
    expect(tp.notesTruncated).toBe(true);
    expect(tp.noteLines[3]!.endsWith('…')).toBe(true);
  });
  it('uncertain dates carry ~ < > and living people show no death', () => {
    const q = createPerson({ givenNames: 'X', surname: 'Y', lifeStatus: 'living', birth: { date: '1950', qualifier: 'about', place: '', note: '' } });
    expect(cardText(q, 'minimal', 'en').lines).toEqual(['~1950']);
    const r = createPerson({ givenNames: 'X', surname: 'Y', birth: { date: '1950', qualifier: 'before', place: '', note: '' }, death: { date: '2000', qualifier: 'after', place: '', note: '', cause: '' } });
    expect(cardText(r, 'minimal', 'en').lines).toEqual(['<1950 – † >2000']);
  });
});

describe('placement of unpositioned people', () => {
  it('places every null-position person without overlaps and keeps existing positions', () => {
    const { positions, provisional } = placeUnpositioned(sampleProject, 'standard');
    expect(positions.size).toBe(Object.keys(sampleProject.persons).length);
    expect(provisional.size).toBe(positions.size);
    const boxes = [...positions.values()];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!;
        const overlap = a.x < b.x + card.width && b.x < a.x + card.width && a.y < b.y + 124 && b.y < a.y + 124;
        expect(overlap, `overlap ${i} ${j}`).toBe(false);
      }
    }
    const fixed = { ...sampleProject, persons: { ...sampleProject.persons } };
    const id = Object.keys(fixed.persons)[0]!;
    fixed.persons[id] = { ...fixed.persons[id]!, position: { x: -500, y: -500 } };
    const r2 = placeUnpositioned(fixed, 'standard');
    expect(r2.positions.get(id)).toEqual({ x: -500, y: -500 });
    expect(r2.provisional.has(id)).toBe(false);
  });
  it('puts partners on one row and children one row below; a cycle does not hang it', () => {
    const b = build();
    const m = b.person('M', born('1900')), f = b.person('F', born('1890')), k = b.person('K', born('1930'));
    b.family([m, f], [k]);
    const pl = placeUnpositioned(b.project, 'minimal');
    expect(pl.positions.get(m.id)!.y).toBe(pl.positions.get(f.id)!.y);
    expect(pl.positions.get(k.id)!.y).toBeGreaterThan(pl.positions.get(m.id)!.y);
    const c = build();
    const a = c.person('A'), d = c.person('D');
    c.family([a], [d]);
    c.family([d], [a]);
    expect(placeUnpositioned(c.project, 'minimal').positions.size).toBe(2);
  });
  it('is deterministic', () => {
    const a = placeUnpositioned(sampleProject, 'standard');
    const b = placeUnpositioned(sampleProject, 'standard');
    expect([...a.positions.entries()]).toEqual([...b.positions.entries()]);
  });
});

describe('connector routing', () => {
  it('draws orthogonal paths', () => {
    expect(orthogonalH(0, 10, 100, 10, 10)).toBe('M0 10 H100');
    expect(orthogonalH(0, 0, 100, 40, 20)).toBe('M0 0 V20 H100 V40');
    expect(orthogonalV(50, 0, 80, 100, 50)).toBe('M50 0 V50 H80 V100');
    expect(orthogonalV(50, 0, 50, 100, 50)).toBe('M50 0 V100');
  });
  it('joins partners with the junction at the middle and hangs children from a bus', () => {
    const b = build();
    const m = b.person('M'), f = b.person('F'), k = b.person('K');
    const u = b.family([m, f], [k]);
    const boxes = new Map<string, Box>([
      [m.id, { x: 0, y: 0, w: 220, h: 124 }],
      [f.id, { x: 260, y: 0, w: 220, h: 124 }],
      [k.id, { x: 130, y: 204, w: 220, h: 124 }],
    ]);
    const [g] = routeUnions({ project: b.project, boxes, visible: new Set([m.id, f.id, k.id]) });
    expect(g!.unionId).toBe(u.id);
    expect(g!.cx).toBe(240);
    expect(g!.cy).toBe(62);
    expect(g!.partnerLine!.d).toBe('M220 62 H260');
    expect(g!.partnerLine!.style).toBe('marriage');
    expect(g!.childLines).toHaveLength(1);
    expect(g!.childLines[0]!.d).toBe('M240 68 V204');
  });
  it('marks divorce with a strike and unmarried unions as dashed', () => {
    const b = build();
    const m = b.person('M'), f = b.person('F');
    const u = b.union([m, f], { status: 'divorced' });
    expect(partnerStyle(u)).toBe('divorced');
    expect(partnerStyle(b.union([m, f], { type: 'unmarried', status: 'partnership' }))).toBe('dashed');
    expect(partnerStyle(b.union([m, f], { type: 'unknown', status: 'unknown' }))).toBe('plain');
  });
  it('places a parents-unknown box above its children and skips unions whose partners are filtered out', () => {
    const b = build();
    const s1 = b.person('S1'), s2 = b.person('S2'), p = b.person('P'), c = b.person('C');
    b.family([], [s1, s2]);
    b.family([p], [c]);
    const boxes = new Map<string, Box>([
      [s1.id, { x: 0, y: 300, w: 220, h: 84 }],
      [s2.id, { x: 260, y: 300, w: 220, h: 84 }],
      [p.id, { x: 600, y: 0, w: 220, h: 84 }],
      [c.id, { x: 600, y: 300, w: 220, h: 84 }],
    ]);
    const all = routeUnions({ project: b.project, boxes, visible: new Set([s1.id, s2.id, p.id, c.id]) });
    const unknown = all.find((g) => g.unknownParents)!;
    expect(unknown.cx).toBe(240);
    expect(unknown.cy).toBeLessThan(300);
    expect(unknown.childLines).toHaveLength(2);
    const filtered = routeUnions({ project: b.project, boxes, visible: new Set([s1.id, s2.id, c.id]) });
    expect(filtered.some((g) => g.partnerLine && !g.unknownParents)).toBe(false);
  });
});

describe('viewport', () => {
  it('fits bounds into the screen and clamps zoom', () => {
    const v = fitTo({ x: 0, y: 0, w: 2000, h: 1000 }, 1000, 800, 0);
    expect(v.zoom).toBeCloseTo(0.5);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(150);
    expect(fitTo({ x: 0, y: 0, w: 10, h: 10 }, 1000, 800).zoom).toBe(1.5);
    expect(clampZoom(50)).toBe(3);
    expect(clampZoom(0)).toBe(0.05);
  });
  it('zooms around the pointer', () => {
    const v = zoomAt({ x: 0, y: 0, zoom: 1 }, 2, 100, 100);
    expect(v).toEqual({ zoom: 2, x: -100, y: -100 });
  });
});

describe('focus filter', () => {
  it('limits to ancestors / descendants / n generations and includes partners', () => {
    const b = build();
    const gm = b.person('GM'), m = b.person('M'), f = b.person('F'), k = b.person('K'), gk = b.person('GK');
    b.family([gm], [m]);
    b.family([m, f], [k]);
    b.family([k], [gk]);
    const anc = visiblePersons(b.project, { kind: 'ancestors', personId: k.id });
    expect([...anc].sort()).toEqual([k.id, m.id, f.id, gm.id].sort());
    const desc = visiblePersons(b.project, { kind: 'descendants', personId: m.id });
    expect([...desc].sort()).toEqual([m.id, f.id, k.id, gk.id].sort());
    const around = visiblePersons(b.project, { kind: 'around', personId: k.id, generations: 1 });
    expect([...around].sort()).toEqual([k.id, m.id, f.id, gk.id].sort());
  });
  it('is cycle-safe and shows everyone without a filter', () => {
    const b = build();
    const a = b.person('A'), c = b.person('C');
    b.family([a], [c]);
    b.family([c], [a]);
    // One edge of the loop is dropped for traversal: one of the two has an ancestor, the other none.
    const sizes = [a, c].map((p) => visiblePersons(b.project, { kind: 'ancestors', personId: p.id }).size).sort();
    expect(sizes).toEqual([1, 2]);
    expect(visiblePersons(b.project, null).size).toBe(2);
  });
});
