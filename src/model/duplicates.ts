/**
 * Possible duplicates: similar names plus overlapping birth years. Available at any time,
 * not only after import. Cheap enough for 500 people (pairwise on a normalised key).
 */
import type { Person, Project } from './types';
import { yearOf } from './dates';

export interface DuplicatePair {
  aId: string;
  bId: string;
  /** 0..1, higher is more likely a duplicate. */
  score: number;
  reasons: ('sameName' | 'similarName' | 'sameBirthYear' | 'closeBirthYear' | 'birthNameMatch')[];
}

export function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ß/g, 'ss').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Damerau-free Levenshtein distance, small strings only. */
export function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n]!;
}

function namesOf(p: Person): { full: string; surnames: string[]; given: string } {
  const given = normalizeName(p.givenNames).split(' ')[0] ?? '';
  const surnames = [p.surname, p.birthName].map(normalizeName).filter(Boolean);
  return { full: normalizeName(`${p.givenNames} ${p.surname}`), surnames, given };
}

/**
 * Comparing every pair is quadratic, so a very large tree is bucketed by first letter of the
 * given name first: two people whose given names differ in that letter are never a pair here
 * (the edit-distance rule allows one typo elsewhere in the name), and the scan stays quick.
 */
const BUCKET_FROM = 800;

export function findDuplicates(project: Project, maxYearGap = 2): DuplicatePair[] {
  const people = Object.values(project.persons);
  const out: DuplicatePair[] = [];
  const meta = people.map((p) => ({ p, n: namesOf(p), year: yearOf(p.birth.date) }));
  const buckets = new Map<string, number[]>();
  if (meta.length >= BUCKET_FROM) {
    meta.forEach((m, i) => {
      const key = m.n.given.slice(0, 1);
      const arr = buckets.get(key) ?? [];
      arr.push(i);
      buckets.set(key, arr);
    });
  }
  const partners = (i: number): number[] => {
    if (meta.length < BUCKET_FROM) return Array.from({ length: meta.length - i - 1 }, (_, k) => i + 1 + k);
    return (buckets.get(meta[i]!.n.given.slice(0, 1)) ?? []).filter((j) => j > i);
  };
  for (let i = 0; i < meta.length; i++) {
    for (const j of partners(i)) {
      const A = meta[i]!, B = meta[j]!;
      if (!A.n.given || !B.n.given) continue;
      const reasons: DuplicatePair['reasons'] = [];
      let score = 0;
      const givenClose = A.n.given === B.n.given || (A.n.given.length > 3 && editDistance(A.n.given, B.n.given) <= 1);
      const surnameMatch = A.n.surnames.some((s) => B.n.surnames.includes(s));
      const surnameClose = surnameMatch || A.n.surnames.some((s) => B.n.surnames.some((t) => s.length > 3 && editDistance(s, t) <= 1));
      if (!givenClose || !surnameClose) continue;
      if (A.n.full === B.n.full) {
        reasons.push('sameName');
        score += 0.6;
      } else {
        reasons.push('similarName');
        score += 0.4;
      }
      if (surnameMatch && (A.p.birthName || B.p.birthName) && A.p.surname !== B.p.surname) reasons.push('birthNameMatch');
      if (A.year !== null && B.year !== null) {
        const gap = Math.abs(A.year - B.year);
        if (gap === 0) {
          reasons.push('sameBirthYear');
          score += 0.4;
        } else if (gap <= maxYearGap) {
          reasons.push('closeBirthYear');
          score += 0.2;
        } else continue; // different people
      } else score += 0.1; // unknown years: weak evidence
      out.push({ aId: A.p.id, bId: B.p.id, score: Math.min(1, score), reasons });
    }
  }
  return out.sort((x, y) => y.score - x.score);
}
