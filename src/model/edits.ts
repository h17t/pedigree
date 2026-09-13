/**
 * Relationship edits on an Immer draft of the project. These are the "fast entry" actions:
 * add partner, child, father/mother, sibling. Each creates the unions it needs and returns the
 * ids it created so the UI can select or open them. Cards get a position near the anchor so a
 * new person appears where the user is looking; stage (d) can re-arrange later.
 */
import type { Draft } from 'immer';
import type { Person, Project, RelationType, Sex, Union } from './types';
import { createChildLink, createPerson, createUnion } from './types';
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
  const union = createUnion({ partnerIds: [personId, person.id], type: 'marriage', status: 'married' });
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
    union.partnerIds.push(person.id);
    if (union.partnerIds.length === 2 && union.type === 'unknown') union.type = 'marriage';
    if (union.partnerIds.length === 2 && union.status === 'unknown') union.status = 'married';
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

/** Link two existing people as partners (new union). */
export function linkPartners(d: P, aId: string, bId: string): Union {
  const union = createUnion({ partnerIds: [aId, bId], type: 'marriage', status: 'married' });
  d.unions[union.id] = union;
  return union;
}

/** Link an existing person as child of a union. */
export function linkChild(d: P, unionId: string, childId: string, relationType: RelationType = 'biological'): void {
  if (Object.values(d.childLinks).some((l) => l.unionId === unionId && l.childId === childId)) return;
  const link = createChildLink(unionId, childId, relationType);
  d.childLinks[link.id] = link;
}
