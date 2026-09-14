import { describe, expect, it } from 'vitest';
import { buildChart } from '@/render/charts';
import { card } from '@/design/tokens';
import { cardHeight } from '@/render/geometry';
import { build, born } from './fixtures';
import { buildFamilySheet, familySheetHtml } from '@/report/familySheet';
import { t } from '@/i18n';
import type { Person } from '@/model/types';

function ancestorChart(gens: number) {
  const b = build();
  const self = b.person('Self', born('1990'));
  let current: Person[] = [self];
  for (let g = 1; g <= gens; g++) {
    const next: Person[] = [];
    for (const c of current) {
      const f = b.person(`F${g}`, { ...born(String(1990 - 30 * g)), sex: 'male' });
      const m = b.person(`M${g}`, { ...born(String(1992 - 30 * g)), sex: 'female' });
      b.family([f, m], [c]);
      next.push(f, m);
    }
    current = next;
  }
  return { project: b.project, self };
}

describe('pedigree chart', () => {
  it('places the person left, parents to the right (father above mother), limited to the chosen generations, without overlaps', () => {
    const { project, self } = ancestorChart(5); // 6 generations available
    const r = buildChart(project, { kind: 'ancestors', personId: self.id, generations: 4 }, 'standard');
    expect(r.visible.size).toBe(1 + 2 + 4 + 8);
    expect(r.useUnions).toBe(false);
    const P = (name: string) => r.positions.get(Object.values(project.persons).find((p) => p.givenNames === name)!.id)!;
    expect(P('Self').x).toBe(0);
    expect(P('F1').x).toBeGreaterThan(P('Self').x);
    expect(P('F1').x).toBe(P('M1').x);
    expect(P('F1').y).toBeLessThan(P('M1').y);
    // The child sits midway between its parents.
    expect(Math.abs(P('Self').y - (P('F1').y + P('M1').y) / 2)).toBeLessThanOrEqual(1);
    // Four columns, one line per child→parent link.
    const cols = new Set([...r.positions.values()].map((p) => p.x));
    expect(cols.size).toBe(4);
    expect(r.lines).toHaveLength(2 + 4 + 8);
    const h = cardHeight('standard');
    const boxes = [...r.positions.values()];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!;
        expect(a.x < b.x + card.width && b.x < a.x + card.width && a.y < b.y + h && b.y < a.y + h).toBe(false);
      }
  });

  it('draws a repeated ancestor once and copes with missing parents', () => {
    const b = build();
    const me = b.person('Me'), dad = b.person('Dad', { sex: 'male' }), mum = b.person('Mum', { sex: 'female' }), shared = b.person('Shared');
    b.family([dad, mum], [me]);
    b.family([shared], [dad]);
    b.family([shared], [mum]); // both parents descend from the same person
    const r = buildChart(b.project, { kind: 'ancestors', personId: me.id, generations: 8 }, 'standard');
    expect(r.visible.size).toBe(4);
    expect([...r.positions.values()].filter((p) => p.x === 2 * (card.width + 72))).toHaveLength(1);
  });
});

describe('descendant chart', () => {
  it('includes descendants to the chosen depth and their partners, laid out downward', () => {
    const b = build();
    const top = b.person('Top', born('1900')), sp = b.person('Sp', born('1902'));
    const c1 = b.person('C1', born('1925')), c2 = b.person('C2', born('1927')), c1p = b.person('C1p');
    const g1 = b.person('G1', born('1950')), gg1 = b.person('GG1', born('1975'));
    b.family([top, sp], [c1, c2]);
    b.family([c1, c1p], [g1]);
    b.family([g1], [gg1]);
    const r = buildChart(b.project, { kind: 'descendants', personId: top.id, depth: 2 }, 'standard');
    expect(r.useUnions).toBe(true);
    expect([...r.visible].sort()).toEqual([top.id, sp.id, c1.id, c2.id, c1p.id, g1.id].sort());
    expect(r.visible.has(gg1.id)).toBe(false);
    expect(r.positions.get(top.id)!.y).toBeLessThan(r.positions.get(c1.id)!.y);
    expect(r.positions.get(c1.id)!.y).toBeLessThan(r.positions.get(g1.id)!.y);
  });
});

describe('family sheet', () => {
  it('lists parents, siblings, partnerships with children, events and fields, and renders standalone HTML', () => {
    const b = build();
    const me = b.person('Anna', { surname: 'Weber', ...born('1950-03-02'), occupation: 'Lehrerin', events: [{ id: 'e1', type: 'baptism', label: '', date: '1950-04-01', qualifier: 'exact', place: 'Speyer', note: '' }] });
    const dad = b.person('Karl', { surname: 'Weber', sex: 'male' }), mum = b.person('Maria', { surname: 'Koch', sex: 'female' });
    const sis = b.person('Lena', { surname: 'Weber' });
    const husband = b.person('Peter', { surname: 'Schulz', sex: 'male' });
    const kid = b.person('Tom', { surname: 'Schulz' });
    const pu = b.family([dad, mum], [me, sis]);
    pu.status = 'married';
    const u = b.family([me, husband], [kid]);
    u.status = 'divorced';
    u.marriageDate = '1975';
    const sheet = buildFamilySheet(b.project, me.id, 'en', t)!;
    expect(sheet.name).toBe('Anna Weber');
    expect(sheet.parents.map((p) => p.name)).toEqual(['Karl Weber', 'Maria Koch']);
    expect(sheet.parentsInfo).toContain('married');
    expect(sheet.siblings.map((p) => p.name)).toEqual(['Lena Weber']);
    expect(sheet.partnerships).toHaveLength(1);
    expect(sheet.partnerships[0]!.partners[0]!.name).toBe('Peter Schulz');
    expect(sheet.partnerships[0]!.info).toContain('divorced');
    expect(sheet.partnerships[0]!.info).toContain('1975');
    expect(sheet.partnerships[0]!.children.map((c) => c.name)).toEqual(['Tom Schulz']);
    expect(sheet.events).toEqual([{ label: 'Baptism', value: '1 April 1950, Speyer' }]);
    expect(sheet.fields.find((f) => f.label === 'Occupation')?.value).toBe('Lehrerin');
    const html = familySheetHtml(sheet, { title: 'Family sheet', parents: 'Parents', parentsRelationship: 'Relationship', siblings: 'Siblings', partnerships: 'Partnerships', partner: 'Partner', children: 'Children', events: 'Events', notes: 'Notes', sources: 'Sources', none: 'none', generated: 'Created with Pedigree' }, 'en');
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<h1>Anna Weber</h1>');
    expect(html).toContain('Tom Schulz');
    expect(html).not.toContain('<script');
  });
});
