/**
 * Merging two people into one. The user chooses per field which value wins; conflicting
 * values can be preserved into the notes. All unions and child links of the loser are
 * re-pointed to the survivor. One undoable step (the caller wraps it in a transaction).
 */
import type { Draft } from 'immer';
import type { ColourGroup, Person, Project } from './types';
import { createChildLink } from './types';

/** Scalar fields the user can choose between. */
export const MERGE_FIELDS = [
  'givenNames', 'surname', 'birthName', 'nickname', 'titlePrefix', 'sex', 'lifeStatus', 'occupation', 'religion', 'residence', 'sources', 'notes', 'groupId',
] as const;
export type MergeScalarField = (typeof MERGE_FIELDS)[number];
export const MERGE_EVENT_FIELDS = ['birth', 'death'] as const;
export type MergeField = MergeScalarField | 'birth' | 'death';

export type MergeChoice = 'a' | 'b';
export interface MergePlan {
  survivorId: string;
  loserId: string;
  /** Which record wins per field; fields not listed take the survivor's value. */
  choices: Partial<Record<MergeField, MergeChoice>>;
  /** Append the losing values of conflicting fields to the notes. */
  keepConflictsInNotes: boolean;
}

export function fieldValue(p: Person, f: MergeField, groups: ColourGroup[] = []): string {
  switch (f) {
    case 'birth':
      return [p.birth.qualifier !== 'exact' ? p.birth.qualifier : '', p.birth.date ?? '', p.birth.dateEnd ?? '', p.birth.place].filter(Boolean).join(' ');
    case 'death':
      return [p.death.qualifier !== 'exact' ? p.death.qualifier : '', p.death.date ?? '', p.death.dateEnd ?? '', p.death.place, p.death.cause].filter(Boolean).join(' ');
    case 'groupId':
      return p.groupId ? (groups.find((g) => g.id === p.groupId)?.name ?? p.groupId) : '';
    default:
      return p[f];
  }
}

/** Fields where both records have a value and they differ. */
export function conflictingFields(a: Person, b: Person): MergeField[] {
  const all: MergeField[] = [...MERGE_FIELDS, ...MERGE_EVENT_FIELDS];
  return all.filter((f) => {
    const va = fieldValue(a, f), vb = fieldValue(b, f);
    return va !== '' && vb !== '' && va !== vb && !(f === 'sex' && (va === 'unknown' || vb === 'unknown')) && !(f === 'lifeStatus' && (va === 'unknown' || vb === 'unknown'));
  });
}

export function mergePersons(d: Draft<Project>, plan: MergePlan, labels: { mergedFrom: string }): void {
  const a = d.persons[plan.survivorId];
  const b = d.persons[plan.loserId];
  if (!a || !b || a.id === b.id) return;
  const pick = <T,>(f: MergeField, va: T, vb: T): T => {
    const choice = plan.choices[f];
    if (choice === 'b') return vb;
    if (choice === 'a') return va;
    // Default: survivor's value, unless it is empty and the other is not.
    const empty = (v: unknown) => v === '' || v === null || v === undefined || v === 'unknown';
    return empty(va) && !empty(vb) ? vb : va;
  };
  const notesExtra: string[] = [];
  if (plan.keepConflictsInNotes) {
    for (const f of conflictingFields(a, b)) {
      const winner = plan.choices[f] === 'b' ? b : a;
      const loser = winner === a ? b : a;
      notesExtra.push(`${f}: ${fieldValue(loser, f)}`);
    }
  }
  for (const f of MERGE_FIELDS) {
    if (f === 'notes') continue;
    (a as unknown as Record<string, unknown>)[f] = pick(f, a[f], b[f]);
  }
  a.birth = pick('birth', a.birth, b.birth);
  a.death = pick('death', a.death, b.death);
  if (a.death.date) a.lifeStatus = 'deceased';
  a.notes = pick('notes', a.notes, b.notes);
  if (notesExtra.length) a.notes = [a.notes, `${labels.mergedFrom}:`, ...notesExtra].filter(Boolean).join('\n');
  // Union of list-like fields.
  a.events = [...a.events, ...b.events.filter((e) => !a.events.some((x) => x.type === e.type && x.date === e.date && x.place === e.place))];
  a.customFields = [...a.customFields, ...b.customFields.filter((c) => !a.customFields.some((x) => x.label === c.label && x.value === c.value))];
  a.rawGedcom = [...a.rawGedcom, ...b.rawGedcom];
  if (!a.position && b.position) a.position = b.position;

  // Re-point relationships. The unions the merge touches are remembered: only those may be
  // tidied away below, so a partnership the two records already had separately (a couple who
  // married twice, say) is left exactly as it was recorded.
  const touched = new Set<string>();
  for (const u of Object.values(d.unions)) {
    if (u.partnerIds.includes(b.id)) {
      touched.add(u.id);
      u.partnerIds = u.partnerIds.map((p) => (p === b.id ? a.id : p));
      // A union of a person with themselves collapses to a single-partner union.
      u.partnerIds = [...new Set(u.partnerIds)];
    }
  }
  for (const l of Object.values(d.childLinks)) {
    if (l.childId === b.id) {
      const duplicate = Object.values(d.childLinks).some((x) => x.id !== l.id && x.unionId === l.unionId && x.childId === a.id);
      if (duplicate) delete d.childLinks[l.id];
      else {
        const nl = createChildLink(l.unionId, a.id, l.relationType);
        delete d.childLinks[l.id];
        d.childLinks[nl.id] = nl;
      }
    }
  }
  // Both records may have had a partnership with the same person. The survivor's own record is
  // kept and takes the children of the one that came across with the loser. Only partnerships
  // the merge touched are folded away, so a couple recorded as married twice stays as recorded.
  const pairKey = (u: { partnerIds: string[] }) => [...u.partnerIds].sort().join('|');
  const ours = new Map<string, string>();
  for (const u of Object.values(d.unions)) {
    if (touched.has(u.id) || u.partnerIds.length < 2 || !u.partnerIds.includes(a.id)) continue;
    if (!ours.has(pairKey(u))) ours.set(pairKey(u), u.id);
  }
  for (const id of touched) {
    const u = d.unions[id];
    if (!u || !u.partnerIds.includes(a.id)) continue;
    const hasChildren = () => Object.values(d.childLinks).some((l) => l.unionId === u.id);
    if (u.partnerIds.length < 2) {
      // The two records were partners of each other: nothing is left of that partnership.
      if (!hasChildren()) delete d.unions[u.id];
      continue;
    }
    const keep = ours.get(pairKey(u));
    if (!keep) continue;
    for (const l of Object.values(d.childLinks)) {
      if (l.unionId !== u.id) continue;
      if (Object.values(d.childLinks).some((x) => x.unionId === keep && x.childId === l.childId)) delete d.childLinks[l.id];
      else l.unionId = keep;
    }
    delete d.unions[u.id];
  }
  delete d.persons[b.id];
}
