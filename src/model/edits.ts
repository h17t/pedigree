/**
 * Relationship edits on an Immer draft of the project. These are the "fast entry" actions:
 * add partner, child, father/mother, sibling. Each creates the unions it needs and returns the
 * ids it created so the UI can select or open them. Cards get a position near the anchor so a
 * new person appears where the user is looking; stage (d) can re-arrange later.
 */
import type { Draft } from 'immer';
import type { Person, Project, RelationType, Sex, Union, UnionStatus, UnionType } from './types';
import { createChildLink, createPerson, createUnion } from './types';
import { ancestorsOf } from './graph';
import { card, layout } from '@/design/tokens';

type P = Draft<Project>;

function near(anchor: Person | undefined, dx: number, dy: number): Person['position'] {
  if (!anchor?.position) return null;
  return { x: anchor.position.x + dx, y: anchor.position.y + dy };
}

export function addPerson(d: P, partial: Partial<Person> = {}): Person {
  const p = createPerson(partial);
  d.persons[p.id] = p;
  return p;
}

/** The unions in which the person is a partner. */
export function unionsOf(d: Pick<Project, 'unions'>, personId: string): Union[] {
  return Object.values(d.unions).filter((u) => u.partnerIds.includes(personId));
}

/** Unions the person is a child of. */
export function parentUnionsOf(d: Pick<Project, 'unions' | 'childLinks'>, personId: string): Union[] {
  return Object.values(d.childLinks)
    .filter((l) => l.childId === personId)
    .map((l) => d.unions[l.unionId])
    .filter((u): u is Union => u !== undefined);
}

/** Add a new partner to a person: creates a new union with both. */
export function addPartner(d: P, personId: string, partial: Partial<Person> = {}): { person: Person; union: Union } {
  const anchor = d.persons[personId];
  const person = addPerson(d, { position: near(anchor, card.width + layout.columnGap, 0), ...partial });
  // The kind of relationship is not assumed: it stays "not recorded" until the user sets it.
  const union = createUnion({ partnerIds: [personId, person.id], type: 'unknown', status: 'unknown' });
  d.unions[union.id] = union;
  return { person, union };
}

/**
 * Add a child to a person. Uses the given union, or the person's only union, or creates a
 * single-partner union when the person has none (or several: the caller must pick then).
 */
export function addChild(d: P, parentId: string, unionId: string | null, partial: Partial<Person> = {}, relationType: RelationType = 'biological'): { person: Person; union: Union } {
  const anchor = d.persons[parentId];
  let union: Union | undefined = unionId ? d.unions[unionId] : undefined;
  if (!union) {
    const existing = unionsOf(d, parentId);
    if (existing.length === 1) union = existing[0];
  }
  if (!union) {
    union = createUnion({ partnerIds: [parentId], type: 'unknown', status: 'unknown' });
    d.unions[union.id] = union;
  }
  const target = union;
  const siblings = Object.values(d.childLinks).filter((l) => l.unionId === target.id).length;
  const person = addPerson(d, { position: near(anchor, siblings * (card.width + layout.columnGap), card.height.standard + layout.generationGap), ...partial });
  const link = createChildLink(target.id, person.id, relationType);
  d.childLinks[link.id] = link;
  return { person, union };
}

/**
 * Add a father or mother. If the person already has a parent union with a free slot, the new
 * parent joins it; otherwise a new union is created and the person is linked as its child.
 */
export function addParent(d: P, childId: string, sex: Sex, partial: Partial<Person> = {}): { person: Person; union: Union } {
  const anchor = d.persons[childId];
  const parentUnions = parentUnionsOf(d, childId);
  let union = parentUnions.find((u) => u.partnerIds.length < 2);
  const person = addPerson(d, { sex, position: near(anchor, sex === 'female' ? card.width + layout.columnGap : 0, -(card.height.standard + layout.generationGap)), ...partial });
  if (union) {
    // Two parents are not assumed to be married: the status stays as recorded.
    union.partnerIds.push(person.id);
  } else {
    union = createUnion({ partnerIds: [person.id], type: 'unknown', status: 'unknown' });
    d.unions[union.id] = union;
    const link = createChildLink(union.id, childId, 'biological');
    d.childLinks[link.id] = link;
  }
  return { person, union };
}

/**
 * Add a sibling: attached to the person's first parent union, or to a new zero-partner
 * union ("Parents unknown") that then contains both.
 */
export function addSibling(d: P, personId: string, partial: Partial<Person> = {}): { person: Person; union: Union } {
  const anchor = d.persons[personId];
  let union = parentUnionsOf(d, personId)[0];
  if (!union) {
    union = createUnion({ partnerIds: [], type: 'unknown', status: 'unknown' });
    d.unions[union.id] = union;
    const link = createChildLink(union.id, personId, 'biological');
    d.childLinks[link.id] = link;
  }
  const person = addPerson(d, { position: near(anchor, card.width + layout.columnGap, 0), ...partial });
  const link = createChildLink(union.id, person.id, 'biological');
  d.childLinks[link.id] = link;
  return { person, union };
}

/** Make two existing people siblings (creates a zero-partner union when neither has parents). */
export function makeSiblings(d: P, aId: string, bId: string): Union {
  let union = parentUnionsOf(d, aId)[0] ?? parentUnionsOf(d, bId)[0];
  if (!union) {
    union = createUnion({ partnerIds: [], type: 'unknown', status: 'unknown' });
    d.unions[union.id] = union;
  }
  const target = union;
  for (const id of [aId, bId]) {
    if (!Object.values(d.childLinks).some((l) => l.unionId === target.id && l.childId === id)) {
      const link = createChildLink(target.id, id, 'biological');
      d.childLinks[link.id] = link;
    }
  }
  return union;
}

// ---- Linking people who already exist ------------------------------------------------------

/** Why a link between existing people is refused. */
export type LinkProblem = 'self' | 'exists' | 'cycle' | 'alreadyChild' | 'full';

/** A relationship status maps to a union type the same way everywhere. */
export function typeForStatus(status: UnionStatus): UnionType {
  return status === 'partnership' ? 'partnership' : status === 'unknown' ? 'unknown' : 'marriage';
}

export function canLinkPartner(d: Pick<Project, 'unions'>, aId: string, bId: string): LinkProblem | null {
  if (aId === bId) return 'self';
  if (Object.values(d.unions).some((u) => u.partnerIds.includes(aId) && u.partnerIds.includes(bId))) return 'exists';
  return null;
}

/**
 * Link two existing people as partners: a new union (a person may have any number of them,
 * past or present). The status is what the user chose; nothing is assumed.
 */
export function linkPartners(d: P, aId: string, bId: string, status: UnionStatus = 'unknown'): Union {
  const union = createUnion({ partnerIds: [aId, bId], type: typeForStatus(status), status });
  d.unions[union.id] = union;
  return union;
}

/** A child may not be a partner of the union or an ancestor of one of its partners. */
export function canLinkChild(d: Project, unionId: string, childId: string): LinkProblem | null {
  const u = d.unions[unionId];
  if (!u) return 'exists';
  if (u.partnerIds.includes(childId)) return 'self';
  if (Object.values(d.childLinks).some((l) => l.unionId === unionId && l.childId === childId)) return 'alreadyChild';
  for (const p of u.partnerIds) if (ancestorsOf(d, p).has(childId)) return 'cycle';
  return null;
}

/** Link an existing person as child of a union (the caller checks canLinkChild first). */
export function linkChild(d: P, unionId: string, childId: string, relationType: RelationType = 'biological'): void {
  if (Object.values(d.childLinks).some((l) => l.unionId === unionId && l.childId === childId)) return;
  const link = createChildLink(unionId, childId, relationType);
  d.childLinks[link.id] = link;
}

/** A parent may not be the child itself, a descendant of the child, or already a parent. */
export function canLinkParent(d: Project, childId: string, parentId: string): LinkProblem | null {
  if (childId === parentId) return 'self';
  const parentUnions = parentUnionsOf(d, childId);
  if (parentUnions.some((u) => u.partnerIds.includes(parentId))) return 'exists';
  if (ancestorsOf(d, parentId).has(childId)) return 'cycle';
  if (parentUnions.length > 0 && parentUnions.every((u) => u.partnerIds.length >= 2)) return 'full';
  return null;
}

/**
 * Link an existing person as a parent: joins the child's parent union when it has a free
 * slot (a single parent or a "Parents unknown" group), otherwise creates a new one.
 */
export function linkParent(d: P, childId: string, parentId: string): Union {
  let union = parentUnionsOf(d, childId).find((u) => u.partnerIds.length < 2);
  if (union) {
    union.partnerIds.push(parentId);
  } else {
    union = createUnion({ partnerIds: [parentId], type: 'unknown', status: 'unknown' });
    d.unions[union.id] = union;
    const link = createChildLink(union.id, childId, 'biological');
    d.childLinks[link.id] = link;
  }
  return union;
}

/**
 * Take one parent away from a child without touching the child's siblings: when the parent
 * union has other children, the child moves to a new union with the remaining parent(s);
 * when this child is its only child, the parent simply leaves the union.
 */
export function removeParent(d: P, childId: string, parentId: string): void {
  const link = Object.values(d.childLinks).find((l) => l.childId === childId && d.unions[l.unionId]?.partnerIds.includes(parentId));
  if (!link) return;
  const u = d.unions[link.unionId]!;
  const siblings = Object.values(d.childLinks).filter((l) => l.unionId === u.id && l.childId !== childId);
  if (siblings.length === 0) {
    unlinkPartner(d, u.id, parentId);
    return;
  }
  const rest = u.partnerIds.filter((p) => p !== parentId);
  delete d.childLinks[link.id];
  const fresh = createUnion({ partnerIds: rest, type: 'unknown', status: 'unknown' });
  d.unions[fresh.id] = fresh;
  const nl = createChildLink(fresh.id, childId, link.relationType);
  d.childLinks[nl.id] = nl;
}

/** Change how a child is related to the parents of a union (biological, adopted, ...). */
export function setChildRelation(d: P, linkId: string, relationType: RelationType): void {
  const l = d.childLinks[linkId];
  if (l) l.relationType = relationType;
}

/**
 * Take a person out of a partnership; they stay in the tree. A union left with no partner
 * and no children disappears; with children it becomes a "Parents unknown" group.
 */
export function unlinkPartner(d: P, unionId: string, personId: string): void {
  const u = d.unions[unionId];
  if (!u) return;
  u.partnerIds = u.partnerIds.filter((p) => p !== personId);
  if (u.partnerIds.length === 0 && !Object.values(d.childLinks).some((l) => l.unionId === unionId)) delete d.unions[unionId];
}
