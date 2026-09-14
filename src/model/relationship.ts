/**
 * "How are A and B related?" — the nearest common ancestors decide: direct line (ancestor /
 * descendant), siblings (full or half), aunts/uncles and nieces/nephews, cousins of a degree
 * with removals; otherwise partners and in-laws (partner of a relative, relative of the
 * partner). Plain-language wording is composed from dictionary terms per language.
 */
import type { Person, Project } from './types';
import { breakCycles, buildAdjacency, parentsOf } from './graph';
import type { Adjacency } from './graph';
import { unionsOf } from './edits';
import type { Locale, TKey } from '@/i18n';

export type Relation =
  | { kind: 'same' }
  | { kind: 'none' }
  | { kind: 'partner' }
  | { kind: 'ancestor'; up: number }
  | { kind: 'descendant'; down: number }
  | { kind: 'sibling'; half: boolean }
  | { kind: 'auntUncle'; up: number }
  | { kind: 'nieceNephew'; down: number }
  | { kind: 'cousin'; degree: number; removed: number; olderSide: 'a' | 'b' | null }
  | { kind: 'partnerOfRelative'; inner: Relation; partnerId: string }
  | { kind: 'relativeOfPartner'; inner: Relation; partnerId: string };

/** Ancestors of a person with the shortest distance to each (self at 0). */
function ancestorsWithDistance(project: Project, adj: Adjacency, id: string): Map<string, number> {
  const dist = new Map<string, number>([[id, 0]]);
  const queue = [id];
  while (queue.length) {
    const cur = queue.shift()!;
    const d = dist.get(cur)!;
    for (const p of parentsOf(project, adj, cur)) {
      if (!project.persons[p] || dist.has(p)) continue;
      dist.set(p, d + 1);
      queue.push(p);
    }
  }
  return dist;
}

function blood(project: Project, adj: Adjacency, aId: string, bId: string): Relation | null {
  if (aId === bId) return { kind: 'same' };
  const ancA = ancestorsWithDistance(project, adj, aId);
  const ancB = ancestorsWithDistance(project, adj, bId);
  if (ancA.has(bId)) return { kind: 'ancestor', up: ancA.get(bId)! };
  if (ancB.has(aId)) return { kind: 'descendant', down: ancB.get(aId)! };
  let best: { upA: number; upB: number; count: number } | null = null;
  for (const [anc, upA] of ancA) {
    const upB = ancB.get(anc);
    if (upB === undefined || upA === 0 || upB === 0) continue;
    if (!best || upA + upB < best.upA + best.upB || (upA + upB === best.upA + best.upB && upA < best.upA)) best = { upA, upB, count: 1 };
    else if (upA === best.upA && upB === best.upB) best.count++;
  }
  if (!best) return null;
  const { upA, upB } = best;
  if (upA === 1 && upB === 1) return { kind: 'sibling', half: best.count < 2 };
  if (upA === 1 && upB >= 2) return { kind: 'nieceNephew', down: upB - 1 };
  if (upB === 1 && upA >= 2) return { kind: 'auntUncle', up: upA - 1 };
  const degree = Math.min(upA, upB) - 1;
  const removed = Math.abs(upA - upB);
  return { kind: 'cousin', degree, removed, olderSide: removed === 0 ? null : upA > upB ? 'b' : 'a' };
}

export function relationship(project: Project, aId: string, bId: string): Relation {
  if (!project.persons[aId] || !project.persons[bId]) return { kind: 'none' };
  const adj = buildAdjacency(project, breakCycles(project).ignoredLinks);
  const direct = blood(project, adj, aId, bId);
  if (direct) return direct;
  if (unionsOf(project, aId).some((u) => u.partnerIds.includes(bId))) return { kind: 'partner' };
  // B is the partner of a relative of A.
  for (const u of unionsOf(project, bId)) {
    for (const p of u.partnerIds) {
      if (p === bId || p === aId) continue;
      const inner = blood(project, adj, aId, p);
      if (inner && inner.kind !== 'same') return { kind: 'partnerOfRelative', inner, partnerId: p };
    }
  }
  // B is a relative of A's partner.
  for (const u of unionsOf(project, aId)) {
    for (const p of u.partnerIds) {
      if (p === aId || p === bId) continue;
      const inner = blood(project, adj, p, bId);
      if (inner && inner.kind !== 'same') return { kind: 'relativeOfPartner', inner, partnerId: p };
    }
  }
  return { kind: 'none' };
}

type T = (key: TKey, params?: Record<string, string | number>) => string;
type SexKey = 'male' | 'female' | 'other';
const sexKey = (p: Person): SexKey => (p.sex === 'male' ? 'male' : p.sex === 'female' ? 'female' : 'other');

/** The noun for B seen from A ("mother", "first cousin once removed"), in the active language. */
export function relationTerm(rel: Relation, b: Person, t: T, locale: Locale): string {
  const sx = sexKey(b);
  const great = (n: number, base: string) => {
    if (n <= 0) return base;
    if (locale === 'de') {
      // "die Urgroßmutter", "der Ururgroßvater": the prefix joins the lowercased noun after the article.
      const g = t('relation.great');
      const prefix = g + g.toLowerCase().repeat(n - 1);
      const i = base.lastIndexOf(' ');
      const article = i >= 0 ? base.slice(0, i + 1) : '';
      const noun = i >= 0 ? base.slice(i + 1) : base;
      return `${article}${prefix}${noun.charAt(0).toLowerCase()}${noun.slice(1)}`;
    }
    return t('relation.great').repeat(n) + base;
  };
  switch (rel.kind) {
    case 'partner':
      return t(`relation.terms.partner.${sx}` as TKey);
    case 'ancestor':
      return rel.up === 1 ? t(`relation.terms.parent.${sx}` as TKey) : great(rel.up - 2, t(`relation.terms.grandparent.${sx}` as TKey));
    case 'descendant':
      return rel.down === 1 ? t(`relation.terms.child.${sx}` as TKey) : great(rel.down - 2, t(`relation.terms.grandchild.${sx}` as TKey));
    case 'sibling':
      return t(`relation.terms.${rel.half ? 'halfSibling' : 'sibling'}.${sx}` as TKey);
    case 'auntUncle':
      return great(rel.up - 1, t(`relation.terms.auntUncle.${sx}` as TKey));
    case 'nieceNephew':
      return great(rel.down - 1, t(`relation.terms.nieceNephew.${sx}` as TKey));
    case 'cousin': {
      const degree = t(`relation.degree.${Math.min(rel.degree, 4)}` as TKey, { n: rel.degree });
      const base = t(`relation.terms.cousin.${sx}` as TKey, { degree });
      return rel.removed === 0 ? base : `${base} ${rel.removed === 1 ? t('relation.removedOnce') : rel.removed === 2 ? t('relation.removedTwice') : t('relation.removedN', { n: rel.removed })}`;
    }
    default:
      return '';
  }
}

/** The whole sentence: "Anna Weber is the mother of Karl Weber." */
export function describeRelation(project: Project, aId: string, bId: string, t: T, locale: Locale, name: (id: string) => string): string {
  const rel = relationship(project, aId, bId);
  const a = name(aId), b = name(bId);
  const B = project.persons[bId];
  if (!B) return '';
  switch (rel.kind) {
    case 'same':
      return t('relation.same', { a, b });
    case 'none':
      return t('relation.none', { a, b });
    case 'partnerOfRelative': {
      const term = relationTerm(rel.inner, project.persons[rel.partnerId]!, t, locale);
      return t('relation.partnerOfRelative', { a, b, term, name: name(rel.partnerId) });
    }
    case 'relativeOfPartner': {
      const term = relationTerm(rel.inner, B, t, locale);
      return t('relation.relativeOfPartner', { a, b, term, name: name(rel.partnerId) });
    }
    default:
      return t('relation.sentence', { a, b, term: relationTerm(rel, B, t, locale) });
  }
}
