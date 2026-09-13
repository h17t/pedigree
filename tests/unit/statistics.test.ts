import { describe, expect, it } from 'vitest';
import { computeStatistics } from '@/timeline/statistics';
import { computeTimeline, sortBars } from '@/timeline/timeline';
import { HISTORY } from '@/timeline/history';
import { migrateProject } from '@/model/schema';
import sample from '@/fixtures/sample-family.json';
import { build, born, died } from './fixtures';

const sampleProject = (() => {
  const m = migrateProject(sample);
  if (!m.ok) throw new Error('sample');
  return m.project;
})();

describe('computeStatistics', () => {
  const s = computeStatistics(sampleProject);
  it('counts people, unions and generations', () => {
    expect(s.people).toBe(48);
    expect(s.unions).toBe(17);
    expect(s.generations).toBe(6);
  });
  it('states the base population for every metric and never presents incomplete data as a census', () => {
    expect(s.ageAtDeath.total).toBe(48);
    expect(s.ageAtDeath.base).toBeLessThan(48);
    expect(s.ageAtDeath.base).toBe(s.ageAtDeath.value.reduce((a, b) => a + b.count, 0));
    expect(s.birthMonths.base).toBe(s.birthMonths.value.reduce((a, b) => a + b, 0));
    expect(s.birthMonths.base).toBeLessThan(48); // year-only births do not count
    expect(s.childrenPerUnion.total).toBe(17);
    expect(s.childrenPerUnion.base).toBe(16); // the one sibling group without partners is excluded
    expect(s.ageAtMarriage.base).toBeLessThanOrEqual(s.ageAtMarriage.total);
    expect(s.occupations.base).toBeLessThan(48);
  });
  it('reads life status from the field, not from a missing date', () => {
    expect(s.lifeStatus.value.living).toBe(Object.values(sampleProject.persons).filter((p) => p.lifeStatus === 'living' && !p.death.date).length);
    expect(s.lifeStatus.value.unknown).toBeGreaterThan(0);
    expect(s.lifeStatus.value.living + s.lifeStatus.value.deceased + s.lifeStatus.value.unknown).toBe(48);
  });
  it('computes life expectancy by decade and sex only from people with both dates', () => {
    const b = build();
    b.person('M1', { sex: 'male', ...born('1900'), ...died('1970') });
    b.person('M2', { sex: 'male', ...born('1905'), ...died('1985') });
    b.person('F1', { sex: 'female', ...born('1901'), ...died('1991') });
    b.person('X', { sex: 'male', ...born('1902') }); // no death: excluded
    b.person('Y', { sex: 'female', ...died('1950') }); // no birth: excluded
    const st = computeStatistics(b.project);
    expect(st.lifeExpectancyByDecade.base).toBe(3);
    expect(st.lifeExpectancyByDecade.total).toBe(5);
    expect(st.lifeExpectancyByDecade.value).toEqual([{ decade: 1900, all: { mean: 80, n: 3 }, male: { mean: 75, n: 2 }, female: { mean: 90, n: 1 } }]);
    expect(st.ageAtDeath.value.find((x) => x.label === '70–79')!.count).toBe(1);
    expect(st.ageAtDeath.value.find((x) => x.label === '80–89')!.count).toBe(1);
    expect(st.ageAtDeath.value.find((x) => x.label === '90–99')!.count).toBe(1);
  });
  it('computes age at first marriage per sex', () => {
    const b = build();
    const h = b.person('H', { sex: 'male', ...born('1900') }), w = b.person('W', { sex: 'female', ...born('1905') });
    b.union([h, w], { marriageDate: '1925' });
    b.union([h, b.person('W2', { sex: 'female', ...born('1910') })], { marriageDate: '1940' });
    const st = computeStatistics(b.project);
    expect(st.ageAtMarriage.value.male).toEqual({ mean: 25, n: 1 }); // first marriage only
    expect(st.ageAtMarriage.value.female).toEqual({ mean: 25, n: 2 });
    expect(st.ageAtMarriage.base).toBe(3);
  });
  it('lists most common names, occupations and places with counts', () => {
    expect(s.surnames.value[0]).toEqual({ label: 'Weber', count: expect.any(Number) as number });
    expect(s.givenNames.value.length).toBeLessThanOrEqual(10);
    expect(s.occupations.value.some((o) => o.label === 'Winzer')).toBe(true);
    expect(s.places.value[0]!.count).toBeGreaterThan(1);
    expect(s.birthYears).toEqual({ min: 1848, max: 1998 });
  });
  it('handles an empty project and a cyclic one', () => {
    const e = computeStatistics(build().project);
    expect(e.people).toBe(0);
    expect(e.generations).toBe(0);
    expect(e.birthYears).toBeNull();
    const c = build();
    const a = c.person('A'), d = c.person('D');
    c.family([a], [d]);
    c.family([d], [a]);
    expect(computeStatistics(c.project).generations).toBe(2);
  });
});

describe('computeTimeline', () => {
  it('draws closed, living and unknown-end bars and lists undated people', () => {
    const b = build();
    const dead = b.person('Dead', { ...born('1900'), ...died('1970') });
    const alive = b.person('Alive', { ...born('1950'), lifeStatus: 'living' });
    const unknown = b.person('Unknown', { birth: { date: '1920', qualifier: 'about', place: '', note: '' } });
    const undated = b.person('Undated');
    const t = computeTimeline(b.project, 2026);
    const bar = (id: string) => t.bars.find((x) => x.personId === id)!;
    expect(bar(dead.id)).toMatchObject({ start: 1900, end: 1970, kind: 'closed', startUncertain: false });
    expect(bar(alive.id)).toMatchObject({ start: 1950, end: 2026, kind: 'living' });
    expect(bar(unknown.id)).toMatchObject({ start: 1920, end: 1930, kind: 'unknownEnd', startUncertain: true });
    expect(t.undated).toEqual([undated.id]);
    expect(t.minYear).toBe(1900);
    expect(t.maxYear).toBe(2030);
  });
  it('sorts by birth or groups by family', () => {
    const t = computeTimeline(sampleProject, 2026);
    const byBirth = sortBars(t.bars, 'birth', sampleProject);
    for (let i = 1; i < byBirth.length; i++) expect(byBirth[i]!.start).toBeGreaterThanOrEqual(byBirth[i - 1]!.start);
    const byFamily = sortBars(t.bars, 'family', sampleProject);
    for (let i = 1; i < byFamily.length; i++) expect(byFamily[i]!.family).toBeGreaterThanOrEqual(byFamily[i - 1]!.family);
    expect(t.bars.length + t.undated.length).toBe(48);
  });
});

describe('history layer', () => {
  it('is the agreed eight entries with both labels', () => {
    expect(HISTORY).toHaveLength(8);
    for (const h of HISTORY) {
      expect(h.from).toBeLessThanOrEqual(h.to);
      expect(h.label.en.length).toBeGreaterThan(0);
      expect(h.label.de.length).toBeGreaterThan(0);
    }
  });
});
