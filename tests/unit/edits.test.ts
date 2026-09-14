import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { build, born } from './fixtures';
import { addChild, addParent, addPartner, addSibling, makeSiblings, unionsOf, parentUnionsOf, canLinkChild, canLinkParent, canLinkPartner, linkChild, linkParent, linkPartners, setChildRelation, unlinkPartner, removeParent } from '@/model/edits';
import { deletePerson, deleteUnion, previewDeletePerson, unlinkChild } from '@/model/delete';
import { conflictingFields, mergePersons } from '@/model/merge';
import { findDuplicates, editDistance } from '@/model/duplicates';
import { connectedComponents } from '@/model/graph';
import type { Project } from '@/model/types';

describe('add relatives', () => {
  it('addPartner creates a union with both whose kind is not assumed', () => {
    const b = build();
    const a = b.person('A');
    let created = '';
    const next = produce(b.project, (d) => {
      created = addPartner(d, a.id, { givenNames: 'B' }).union.id;
    });
    expect(next.unions[created]!.partnerIds).toHaveLength(2);
    expect(next.unions[created]).toMatchObject({ type: 'unknown', status: 'unknown' });
    expect(Object.keys(next.persons)).toHaveLength(2);
  });

  it('addChild reuses the only union, else creates a single-partner union; several unions need an explicit choice', () => {
    const b = build();
    const a = b.person('A');
    const next = produce(b.project, (d) => void addChild(d, a.id, null, { givenNames: 'Kid' }));
    const u = unionsOf(next, a.id);
    expect(u).toHaveLength(1);
    expect(u[0]!.partnerIds).toEqual([a.id]);
    expect(Object.values(next.childLinks)).toHaveLength(1);
    const next2 = produce(next, (d) => void addChild(d, a.id, null, { givenNames: 'Kid2' }));
    expect(Object.values(next2.childLinks).filter((l) => l.unionId === u[0]!.id)).toHaveLength(2);
    // with two unions and no explicit choice, a new single-partner union is created
    const two = produce(next2, (d) => void addPartner(d, a.id));
    const next3 = produce(two, (d) => void addChild(d, a.id, null));
    expect(unionsOf(next3, a.id)).toHaveLength(3);
  });

  it('addParent fills a free slot or creates a new union; addSibling uses the parents or a "Parents unknown" group', () => {
    const b = build();
    const k = b.person('Kid', born('1950'));
    const withFather = produce(b.project, (d) => void addParent(d, k.id, 'male', { givenNames: 'Dad' }));
    const pu = parentUnionsOf(withFather, k.id);
    expect(pu).toHaveLength(1);
    expect(pu[0]!.partnerIds).toHaveLength(1);
    const withMother = produce(withFather, (d) => void addParent(d, k.id, 'female', { givenNames: 'Mum' }));
    expect(parentUnionsOf(withMother, k.id)[0]!.partnerIds).toHaveLength(2);
    // Two parents are not assumed to be married.
    expect(parentUnionsOf(withMother, k.id)[0]!).toMatchObject({ type: 'unknown', status: 'unknown' });
    const withSib = produce(withMother, (d) => void addSibling(d, k.id, { givenNames: 'Sis' }));
    expect(Object.values(withSib.childLinks).filter((l) => l.unionId === parentUnionsOf(withSib, k.id)[0]!.id)).toHaveLength(2);
    // sibling without parents
    const c = build();
    const lone = c.person('Lone');
    const s = produce(c.project, (d) => void addSibling(d, lone.id));
    const group = Object.values(s.unions)[0]!;
    expect(group.partnerIds).toEqual([]);
    expect(Object.values(s.childLinks)).toHaveLength(2);
    expect(connectedComponents(s)).toHaveLength(1);
  });

  it('makeSiblings joins two existing people', () => {
    const b = build();
    const x = b.person('X'), y = b.person('Y');
    const s = produce(b.project, (d) => void makeSiblings(d, x.id, y.id));
    expect(connectedComponents(s)).toHaveLength(1);
    expect(Object.values(s.unions)[0]!.partnerIds).toEqual([]);
  });
});

describe('linking existing people', () => {
  it('a person can have several partnerships; the same pair is refused twice; self is refused', () => {
    const b = build();
    const a = b.person('A');
    const x = b.person('X');
    const y = b.person('Y');
    expect(canLinkPartner(b.project, a.id, a.id)).toBe('self');
    const p1 = produce(b.project, (d) => void linkPartners(d, a.id, x.id, 'divorced'));
    expect(unionsOf(p1, a.id)).toHaveLength(1);
    expect(unionsOf(p1, a.id)[0]).toMatchObject({ status: 'divorced', type: 'marriage' });
    expect(canLinkPartner(p1, a.id, x.id)).toBe('exists');
    expect(canLinkPartner(p1, a.id, y.id)).toBeNull();
    const p2 = produce(p1, (d) => void linkPartners(d, a.id, y.id, 'married'));
    expect(unionsOf(p2, a.id)).toHaveLength(2);
  });

  it('linkParent joins a free slot or creates a union; refuses self, duplicates, a full pair and cycles', () => {
    const b = build();
    const kid = b.person('Kid');
    const dad = b.person('Dad');
    const mum = b.person('Mum');
    const other = b.person('Other');
    expect(canLinkParent(b.project, kid.id, kid.id)).toBe('self');
    const p1 = produce(b.project, (d) => void linkParent(d, kid.id, dad.id));
    expect(parentUnionsOf(p1, kid.id)[0]!.partnerIds).toEqual([dad.id]);
    expect(canLinkParent(p1, kid.id, dad.id)).toBe('exists');
    const p2 = produce(p1, (d) => void linkParent(d, kid.id, mum.id));
    expect(parentUnionsOf(p2, kid.id)).toHaveLength(1);
    expect(parentUnionsOf(p2, kid.id)[0]!.partnerIds).toEqual([dad.id, mum.id]);
    expect(parentUnionsOf(p2, kid.id)[0]).toMatchObject({ status: 'unknown' });
    expect(canLinkParent(p2, kid.id, other.id)).toBe('full');
    // Kid's child cannot become Kid's parent.
    const p3 = produce(p2, (d) => void addChild(d, kid.id, null, { givenNames: 'Grandkid' }));
    const grandkid = Object.values(p3.persons).find((p) => p.givenNames === 'Grandkid')!;
    expect(canLinkParent(p3, dad.id, grandkid.id)).toBe('cycle');
    expect(canLinkParent(p3, dad.id, other.id)).toBeNull();
  });

  it('linkChild refuses partners, duplicates and ancestors; relation can be changed; unlinkPartner keeps the person', () => {
    const b = build();
    const a = b.person('A');
    const x = b.person('X');
    const c = b.person('C');
    const p1 = produce(b.project, (d) => void linkPartners(d, a.id, x.id));
    const u = unionsOf(p1, a.id)[0]!;
    expect(canLinkChild(p1, u.id, a.id)).toBe('self');
    expect(canLinkChild(p1, u.id, c.id)).toBeNull();
    const p2 = produce(p1, (d) => void linkChild(d, u.id, c.id, 'adopted'));
    const link = Object.values(p2.childLinks)[0]!;
    expect(link).toMatchObject({ unionId: u.id, childId: c.id, relationType: 'adopted' });
    expect(canLinkChild(p2, u.id, c.id)).toBe('alreadyChild');
    // C's own partnership cannot take A (C's parent) as a child.
    const p3 = produce(p2, (d) => void addPartner(d, c.id, { givenNames: 'D' }));
    const cu = unionsOf(p3, c.id)[0]!;
    expect(canLinkChild(p3, cu.id, a.id)).toBe('cycle');
    const p4 = produce(p3, (d) => setChildRelation(d, link.id, 'step'));
    expect(p4.childLinks[link.id]!.relationType).toBe('step');
    const p5 = produce(p4, (d) => unlinkPartner(d, u.id, x.id));
    expect(p5.persons[x.id]).toBeDefined();
    expect(p5.unions[u.id]!.partnerIds).toEqual([a.id]);
    // An empty union with no children disappears when the last partner leaves.
    const p6 = produce(p5, (d) => unlinkPartner(d, cu.id, c.id));
    const p7 = produce(p6, (d) => unlinkPartner(d, cu.id, Object.values(p6.unions[cu.id]!.partnerIds)[0]!));
    expect(p7.unions[cu.id]).toBeUndefined();
  });
});

describe('removeParent', () => {
  it('moves the child to a union with the remaining parent when there are siblings, else the parent leaves the union', () => {
    const b = build();
    const dad = b.person('Dad'), mum = b.person('Mum'), a = b.person('A'), s = b.person('S');
    const u = b.family([dad, mum], [a, s]);
    const p1 = produce(b.project, (d) => removeParent(d, a.id, dad.id));
    // The sibling keeps both parents; A now has only Mum.
    expect(p1.unions[u.id]!.partnerIds).toEqual([dad.id, mum.id]);
    expect(parentUnionsOf(p1, s.id)[0]!.id).toBe(u.id);
    const aParents = parentUnionsOf(p1, a.id);
    expect(aParents).toHaveLength(1);
    expect(aParents[0]!.partnerIds).toEqual([mum.id]);
    expect(aParents[0]!.status).toBe('unknown');
    // An only child: the parent simply leaves the union.
    const c = build();
    const d2 = c.person('D'), m2 = c.person('M'), only = c.person('Only');
    const u2 = c.family([d2, m2], [only]);
    const p2 = produce(c.project, (d) => removeParent(d, only.id, d2.id));
    expect(p2.unions[u2.id]!.partnerIds).toEqual([m2.id]);
    expect(p2.persons[d2.id]).toBeDefined();
  });
});

describe('deletePerson', () => {
  function family() {
    const b = build();
    const m = b.person('M'), f = b.person('F'), k1 = b.person('K1'), k2 = b.person('K2'), gm = b.person('GM');
    const u = b.family([m, f], [k1, k2]);
    b.family([gm], [m]);
    return { b, m, f, k1, k2, gm, u };
  }
  it('preview lists unions, outcomes and children', () => {
    const { b, m, f, u } = family();
    const p = previewDeletePerson(b.project, m.id);
    expect(p.unions).toHaveLength(1);
    expect(p.unions[0]).toMatchObject({ outcome: 'kept', childCount: 2, otherPartnerIds: [f.id] });
    expect(p.unions[0]!.union.id).toBe(u.id);
    expect(p.parentLinks).toHaveLength(1);
    expect(p.childrenStayingWithOtherParent).toHaveLength(2);
    expect(p.childrenLeftWithoutParents).toHaveLength(0);
  });
  it('removes the person and their parent links, keeps the union with the other partner and the children', () => {
    const { b, m, f, k1, k2, u } = family();
    const next = produce(b.project, (d) => deletePerson(d, m.id));
    expect(next.persons[m.id]).toBeUndefined();
    expect(next.unions[u.id]!.partnerIds).toEqual([f.id]);
    expect(Object.values(next.childLinks).filter((l) => l.unionId === u.id).map((l) => l.childId).sort()).toEqual([k1.id, k2.id].sort());
    expect(Object.values(next.childLinks).some((l) => l.childId === m.id)).toBe(false);
    expect(Object.keys(next.persons)).toHaveLength(4);
  });
  it('deleting both parents leaves a "Parents unknown" sibling group; a union with nothing left is removed', () => {
    const { b, m, f, u } = family();
    const next = produce(b.project, (d) => {
      deletePerson(d, m.id);
      deletePerson(d, f.id);
    });
    expect(next.unions[u.id]!.partnerIds).toEqual([]);
    expect(Object.values(next.childLinks).filter((l) => l.unionId === u.id)).toHaveLength(2);
    const c = build();
    const a = c.person('A'), bb = c.person('B');
    const cu = c.union([a, bb]);
    const gone = produce(c.project, (d) => {
      deletePerson(d, a.id);
      deletePerson(d, bb.id);
    });
    expect(gone.unions[cu.id]).toBeUndefined();
    const prev = previewDeletePerson(produce(c.project, (d) => deletePerson(d, a.id)), bb.id);
    expect(prev.unions[0]!.outcome).toBe('removed');
  });
});

describe('deleteUnion', () => {
  it('keeps children as an unconnected sibling group by default, or removes the child links', () => {
    const b = build();
    const m = b.person('M'), f = b.person('F'), k = b.person('K');
    const u = b.family([m, f], [k]);
    const kept = produce(b.project, (d) => deleteUnion(d, u.id, 'keepChildrenUnconnected'));
    expect(kept.unions[u.id]!.partnerIds).toEqual([]);
    expect(Object.values(kept.childLinks)).toHaveLength(1);
    expect(Object.keys(kept.persons)).toHaveLength(3);
    const removed = produce(b.project, (d) => deleteUnion(d, u.id, 'removeChildLinks'));
    expect(removed.unions[u.id]).toBeUndefined();
    expect(Object.values(removed.childLinks)).toHaveLength(0);
    expect(Object.keys(removed.persons)).toHaveLength(3);
    // a childless union is simply removed in either mode
    const c = build();
    const cu = c.union([c.person('X'), c.person('Y')]);
    expect(produce(c.project, (d) => deleteUnion(d, cu.id, 'keepChildrenUnconnected')).unions[cu.id]).toBeUndefined();
  });
  it('unlinkChild removes only the link and cleans an empty sibling group', () => {
    const b = build();
    const s1 = b.person('S1'), s2 = b.person('S2');
    const u = b.family([], [s1, s2]);
    const links = Object.values(b.project.childLinks);
    const one = produce(b.project, (d) => unlinkChild(d, links[0]!.id));
    expect(one.unions[u.id]).toBeDefined();
    const none = produce(one, (d) => unlinkChild(d, links[1]!.id));
    expect(none.unions[u.id]).toBeUndefined();
    expect(Object.keys(none.persons)).toHaveLength(2);
  });
});

describe('mergePersons', () => {
  it('re-points unions and child links, picks values per field, keeps conflicts in notes', () => {
    const b = build();
    const a = b.person('Anna', { surname: 'Weber', occupation: 'Lehrerin', ...born('1923') });
    const a2 = b.person('Anna', { surname: 'Weber', occupation: 'Lehrer', residence: 'Berlin', ...born('1923-03-14') });
    const h = b.person('Husband');
    const k = b.person('Kid');
    const gm = b.person('GM');
    b.family([a2, h], [k]);
    b.family([gm], [a2]);
    const next = produce(b.project, (d) =>
      mergePersons(d, { survivorId: a.id, loserId: a2.id, choices: { birth: 'b' }, keepConflictsInNotes: true }, { mergedFrom: 'Merged' }),
    );
    expect(next.persons[a2.id]).toBeUndefined();
    const survivor = next.persons[a.id]!;
    expect(survivor.birth.date).toBe('1923-03-14');
    expect(survivor.occupation).toBe('Lehrerin');
    expect(survivor.residence).toBe('Berlin'); // empty survivor field filled from the other
    expect(survivor.notes).toContain('occupation: Lehrer');
    expect(survivor.notes).toContain('birth: 1923');
    expect(Object.values(next.unions).some((u) => u.partnerIds.includes(a.id) && u.partnerIds.includes(h.id))).toBe(true);
    expect(Object.values(next.childLinks).some((l) => l.childId === a.id)).toBe(true);
    expect(Object.values(next.childLinks).some((l) => l.childId === a2.id)).toBe(false);
    expect(conflictingFields(b.project.persons[a.id]!, b.project.persons[a2.id]!)).toEqual(['occupation', 'birth']);
  });
  it('does not duplicate child links when both records are children of the same union', () => {
    const b = build();
    const p = b.person('P');
    const x = b.person('X'), y = b.person('X');
    b.family([p], [x, y]);
    const next = produce(b.project, (d) => mergePersons(d, { survivorId: x.id, loserId: y.id, choices: {}, keepConflictsInNotes: false }, { mergedFrom: 'Merged' }));
    expect(Object.values(next.childLinks).filter((l) => l.childId === x.id)).toHaveLength(1);
  });
});

describe('findDuplicates', () => {
  it('finds same/similar names with overlapping birth years and ignores different people', () => {
    const b = build();
    const a = b.person('Karl', { surname: 'Weber', ...born('1878') });
    const a2 = b.person('Carl', { surname: 'Weber', ...born('1879') });
    b.person('Karl', { surname: 'Weber', ...born('1950') });
    const m = b.person('Maria', { surname: 'Koch', birthName: 'Weber', ...born('1900') });
    const m2 = b.person('Maria', { surname: 'Weber', ...born('1900') });
    b.person('Otto', { surname: 'Meier' });
    const d = findDuplicates(b.project);
    expect(d.map((x) => [x.aId, x.bId].sort().join('|')).sort()).toEqual([[a.id, a2.id].sort().join('|'), [m.id, m2.id].sort().join('|')].sort());
    expect(d.find((x) => x.aId === m.id || x.bId === m.id)!.reasons).toContain('birthNameMatch');
    expect(editDistance('karl', 'carl')).toBe(1);
  });
  it('is quiet on the sample family', async () => {
    const sample = (await import('@/fixtures/sample-family.json')).default as unknown as Project;
    expect(findDuplicates(sample)).toEqual([]);
  });
});
