/**
 * Statistics over a project. Every metric states its base population: `base` is the number
 * of people (or unions) that had the data needed, `total` the number that exist. Nothing
 * here infers "deceased" from a missing date: lifeStatus is read as recorded.
 */
import type { Person, Project } from '@/model/types';
import { effectiveLifeStatus } from '@/model/types';
import { dateParts, yearOf, yearsBetween } from '@/model/dates';
import { generations } from '@/model/graph';

export interface Based<T> {
  value: T;
  /** People/unions with the data needed for this metric. */
  base: number;
  /** All people/unions. */
  total: number;
}

export interface Bucket {
  label: string;
  count: number;
}

export interface DecadeExpectancy {
  decade: number;
  all: { mean: number; n: number } | null;
  male: { mean: number; n: number } | null;
  female: { mean: number; n: number } | null;
}

export interface Statistics {
  people: number;
  unions: number;
  generations: number;
  sexes: Based<Record<Person['sex'], number>>;
  lifeStatus: Based<Record<'living' | 'deceased' | 'unknown', number>>;
  ageAtDeath: Based<Bucket[]>;
  lifeExpectancyByDecade: Based<DecadeExpectancy[]>;
  ageAtMarriage: Based<{ male: { mean: number; n: number } | null; female: { mean: number; n: number } | null; all: { mean: number; n: number } }>;
  childrenPerUnion: Based<Bucket[]>;
  birthMonths: Based<number[]>;
  givenNames: Based<Bucket[]>;
  surnames: Based<Bucket[]>;
  occupations: Based<Bucket[]>;
  places: Based<Bucket[]>;
  birthYears: { min: number; max: number } | null;
}

function mean(xs: number[]): { mean: number; n: number } | null {
  if (xs.length === 0) return null;
  return { mean: Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10, n: xs.length };
}

function topCounts(values: string[], limit: number): Bucket[] {
  const m = new Map<string, number>();
  for (const v of values) {
    const k = v.trim();
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export function computeStatistics(project: Project, limit = 10): Statistics {
  const persons = Object.values(project.persons);
  const unions = Object.values(project.unions);
  const total = persons.length;

  const sexes: Record<Person['sex'], number> = { male: 0, female: 0, diverse: 0, unknown: 0 };
  const status: Record<'living' | 'deceased' | 'unknown', number> = { living: 0, deceased: 0, unknown: 0 };
  for (const p of persons) {
    sexes[p.sex]++;
    status[effectiveLifeStatus(p)]++;
  }

  // Age at death, in 10-year buckets.
  const ages: { age: number; sex: Person['sex']; decade: number }[] = [];
  for (const p of persons) {
    if (!p.birth.date || !p.death.date) continue;
    const age = yearsBetween(p.birth.date, p.death.date);
    const y = yearOf(p.birth.date);
    if (age === null || y === null || age < 0 || age > 120) continue;
    ages.push({ age, sex: p.sex, decade: Math.floor(y / 10) * 10 });
  }
  const buckets = new Map<number, number>();
  for (const a of ages) {
    const b = Math.min(100, Math.floor(a.age / 10) * 10);
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }
  const ageAtDeath: Bucket[] = [];
  for (let b = 0; b <= 100; b += 10) ageAtDeath.push({ label: b === 100 ? '100+' : `${b}–${b + 9}`, count: buckets.get(b) ?? 0 });

  const decades = [...new Set(ages.map((a) => a.decade))].sort((a, b) => a - b);
  const lifeExpectancyByDecade: DecadeExpectancy[] = decades.map((decade) => {
    const rows = ages.filter((a) => a.decade === decade);
    return { decade, all: mean(rows.map((r) => r.age)), male: mean(rows.filter((r) => r.sex === 'male').map((r) => r.age)), female: mean(rows.filter((r) => r.sex === 'female').map((r) => r.age)) };
  });

  // Age at (first known) marriage per partner.
  const marriageAges: { age: number; sex: Person['sex'] }[] = [];
  const seen = new Set<string>();
  for (const u of [...unions].sort((a, b) => (a.marriageDate ?? '').localeCompare(b.marriageDate ?? ''))) {
    if (!u.marriageDate) continue;
    for (const pid of u.partnerIds) {
      const p = project.persons[pid];
      if (!p?.birth.date || seen.has(pid)) continue;
      const age = yearsBetween(p.birth.date, u.marriageDate);
      if (age === null || age < 10 || age > 100) continue;
      seen.add(pid);
      marriageAges.push({ age, sex: p.sex });
    }
  }
  const partnersTotal = new Set(unions.flatMap((u) => u.partnerIds)).size;

  // Children per union (only unions with at least one partner: sibling groups have unknown parents).
  const counts = new Map<string, number>();
  for (const u of unions) counts.set(u.id, 0);
  for (const l of Object.values(project.childLinks)) if (counts.has(l.unionId)) counts.set(l.unionId, (counts.get(l.unionId) ?? 0) + 1);
  const withPartners = unions.filter((u) => u.partnerIds.length > 0);
  const cpu = new Map<number, number>();
  for (const u of withPartners) {
    const n = Math.min(8, counts.get(u.id) ?? 0);
    cpu.set(n, (cpu.get(n) ?? 0) + 1);
  }
  const childrenPerUnion: Bucket[] = [];
  for (let n = 0; n <= 8; n++) childrenPerUnion.push({ label: n === 8 ? '8+' : String(n), count: cpu.get(n) ?? 0 });

  const months = Array.from({ length: 12 }, () => 0);
  let monthBase = 0;
  for (const p of persons) {
    const d = dateParts(p.birth.date);
    if (d?.m) {
      months[d.m - 1]!++;
      monthBase++;
    }
  }

  const years = persons.map((p) => yearOf(p.birth.date)).filter((y): y is number => y !== null);
  const birthYears = years.length ? { min: Math.min(...years), max: Math.max(...years) } : null;

  const given = persons.flatMap((p) => (p.givenNames.trim() ? [p.givenNames.trim().split(/\s+/)[0]!] : []));
  const surnames = persons.flatMap((p) => [p.surname, p.birthName].filter((s) => s.trim()));
  const occupations = persons.map((p) => p.occupation).filter((s) => s.trim());
  const places = persons.flatMap((p) => [p.birth.place, p.death.place, p.residence].filter((s) => s.trim()));

  return {
    people: total,
    unions: unions.length,
    generations: generations(project).count,
    sexes: { value: sexes, base: total, total },
    lifeStatus: { value: status, base: total, total },
    ageAtDeath: { value: ageAtDeath, base: ages.length, total },
    lifeExpectancyByDecade: { value: lifeExpectancyByDecade, base: ages.length, total },
    ageAtMarriage: { value: { male: mean(marriageAges.filter((m) => m.sex === 'male').map((m) => m.age)), female: mean(marriageAges.filter((m) => m.sex === 'female').map((m) => m.age)), all: mean(marriageAges.map((m) => m.age)) ?? { mean: 0, n: 0 } }, base: marriageAges.length, total: partnersTotal },
    childrenPerUnion: { value: childrenPerUnion, base: withPartners.length, total: unions.length },
    birthMonths: { value: months, base: monthBase, total },
    givenNames: { value: topCounts(given, limit), base: given.length, total },
    surnames: { value: topCounts(surnames, limit), base: persons.filter((p) => p.surname.trim() || p.birthName.trim()).length, total },
    occupations: { value: topCounts(occupations, limit), base: occupations.length, total },
    places: { value: topCounts(places, limit), base: persons.filter((p) => p.birth.place || p.death.place || p.residence).length, total },
    birthYears,
  };
}
