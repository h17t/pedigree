import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { createProject } from '@/model/types';
import { applyWizard, emptyDraft, emptyPerson, summarize, saveDraft, loadDraft, clearDraft } from '@/onboarding/wizard';
import type { WizardDraft } from '@/onboarding/wizard';
import { validateProject } from '@/model/validation';
import { connectedComponents, generations } from '@/model/graph';
import { unionsOf, parentUnionsOf } from '@/model/edits';
import { openProject, transact, undoLast, useAppStore, __resetForTests } from '@/store/store';
import { saveProject } from '@/store/persistence';
import { useHints } from '@/onboarding/hints';

const full = (): WizardDraft => ({
  step: 3,
  self: { givenNames: 'Anna', surname: 'Weber', birthYear: '1970', sex: 'female', life: 'living', deathYear: '' },
  father: { givenNames: 'Karl', surname: 'Weber', birthYear: '1940', sex: 'male', life: 'deceased', deathYear: '2001' },
  mother: { givenNames: 'Maria', surname: 'Koch', birthYear: '1942', sex: 'female', life: 'unknown', deathYear: '' },
  partner: { givenNames: 'Peter', surname: 'Schulz', birthYear: '1968', sex: 'male', life: 'living', deathYear: '', marriageYear: '1995', status: 'married' },
  parentsStatus: 'divorced',
  children: [
    { givenNames: 'Lena', surname: 'Weber', birthYear: '1996', sex: 'female', life: 'living', deathYear: '' },
    { givenNames: 'Tom', surname: 'Weber', birthYear: '', sex: 'male', life: 'unknown', deathYear: '' },
    emptyPerson(),
  ],
});

beforeEach(() => {
  __resetForTests();
  localStorage.clear();
});

describe('applyWizard', () => {
  it('writes a valid model: parents, partner union with status and year, children under that union', () => {
    const w = full();
    let selfId = '';
    const p = produce(createProject('w'), (d) => {
      selfId = applyWizard(d, w).selfId;
    });
    expect(Object.keys(p.persons)).toHaveLength(6);
    expect(summarize(w)).toEqual({ people: 6, unions: 2 });
    const self = p.persons[selfId]!;
    expect(self).toMatchObject({ givenNames: 'Anna', surname: 'Weber', sex: 'female', lifeStatus: 'living' });
    expect(self.birth.date).toBe('1970');
    const parents = parentUnionsOf(p, selfId);
    expect(parents).toHaveLength(1);
    expect(parents[0]!.partnerIds).toHaveLength(2);
    // The parents' relationship is what was entered, and each person's life status too.
    expect(parents[0]).toMatchObject({ status: 'divorced', type: 'marriage' });
    const father = p.persons[parents[0]!.partnerIds[0]!]!;
    expect(father).toMatchObject({ givenNames: 'Karl', lifeStatus: 'deceased' });
    expect(father.death.date).toBe('2001');
    const mother = p.persons[parents[0]!.partnerIds[1]!]!;
    expect(mother.lifeStatus).toBe('unknown');
    expect(mother.death.date).toBeNull();
    const own = unionsOf(p, selfId);
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({ status: 'married', type: 'marriage', marriageDate: '1995' });
    const kids = Object.values(p.childLinks).filter((l) => l.unionId === own[0]!.id);
    expect(kids).toHaveLength(2); // the empty third child is skipped
    expect(validateProject(p)).toEqual([]);
    expect(connectedComponents(p)).toHaveLength(1);
    expect(generations(p).count).toBe(3);
  });

  it('accepts a minimal draft (only yourself) and skipped steps', () => {
    const w: WizardDraft = { ...emptyDraft(), self: { ...emptyPerson('unknown', 'living'), givenNames: 'Ich', birthYear: 'abc' } };
    const p = produce(createProject('w'), (d) => void applyWizard(d, w));
    expect(Object.keys(p.persons)).toHaveLength(1);
    expect(Object.values(p.persons)[0]!.birth.date).toBeNull();
    expect(Object.keys(p.unions)).toHaveLength(0);
  });

  it('children without a partner hang from a single-parent union', () => {
    const w: WizardDraft = { ...emptyDraft(), self: { ...emptyPerson('male', 'living'), givenNames: 'Solo', surname: 'X' }, children: [{ ...emptyPerson(), givenNames: 'Kid', surname: 'X', birthYear: '2000' }] };
    const p = produce(createProject('w'), (d) => void applyWizard(d, w));
    const u = Object.values(p.unions)[0]!;
    expect(u.partnerIds).toHaveLength(1);
    expect(Object.values(p.childLinks)).toHaveLength(1);
  });

  it('is one undo step through the store', () => {
    const p = createProject('w');
    saveProject(p);
    openProject(p.id);
    transact('wizard', (d) => void applyWizard(d, full()));
    expect(Object.keys(useAppStore.getState().project!.persons)).toHaveLength(6);
    expect(useAppStore.getState().undoLabel).toBe('wizard');
    undoLast();
    expect(Object.keys(useAppStore.getState().project!.persons)).toHaveLength(0);
    expect(useAppStore.getState().canUndo).toBe(false);
  });

  it('keeps and clears the draft', () => {
    expect(loadDraft()).toBeNull();
    saveDraft({ ...emptyDraft(), step: 2, self: { ...emptyPerson('female', 'living'), givenNames: 'A', surname: 'B', birthYear: '1950' } });
    expect(loadDraft()).toMatchObject({ step: 2, self: { givenNames: 'A' } });
    clearDraft();
    expect(loadDraft()).toBeNull();
  });

  it('parents without a stated relationship are not married; an old draft gets the new defaults', () => {
    const w: WizardDraft = { ...emptyDraft(), self: { ...emptyPerson('unknown', 'living'), givenNames: 'Me' }, father: { ...emptyPerson('male'), givenNames: 'Dad' }, mother: { ...emptyPerson('female'), givenNames: 'Mum' } };
    let selfId = '';
    const p = produce(createProject('w'), (d) => void (selfId = applyWizard(d, w).selfId));
    expect(parentUnionsOf(p, selfId)[0]).toMatchObject({ status: 'unknown', type: 'unknown' });
    expect(Object.values(p.persons).filter((x) => x.givenNames !== 'Me').every((x) => x.lifeStatus === 'unknown')).toBe(true);
    localStorage.setItem('pedigree:wizard-draft', JSON.stringify({ step: 1, self: { givenNames: 'Old', surname: '', birthYear: '', sex: 'unknown' }, father: { givenNames: 'F', surname: '', birthYear: '', sex: 'male' }, mother: null, partner: { givenNames: 'P', surname: '', birthYear: '', sex: 'unknown', marriageYear: '1990', status: 'divorced' }, children: [{ givenNames: 'K', surname: '', birthYear: '', sex: 'unknown' }] }));
    const old = loadDraft()!;
    expect(old.self).toMatchObject({ givenNames: 'Old', life: 'living', deathYear: '' });
    expect(old.father).toMatchObject({ life: 'unknown' });
    expect(old.partner).toMatchObject({ status: 'divorced', marriageYear: '1990', life: 'unknown' });
    expect(old.children[0]).toMatchObject({ life: 'unknown' });
    expect(old.parentsStatus).toBe('unknown');
  });
});

describe('hints', () => {
  it('offers one hint at a time and remembers dismissals', () => {
    const h = useHints.getState();
    h.offer('addGrandparents');
    expect(useHints.getState().active).toBe('addGrandparents');
    h.offer('selectCard');
    expect(useHints.getState().active).toBe('addGrandparents');
    h.dismiss('addGrandparents');
    expect(useHints.getState().active).toBeNull();
    h.offer('addGrandparents');
    expect(useHints.getState().active).toBeNull();
    expect(JSON.parse(localStorage.getItem('pedigree:hints')!)).toEqual(['addGrandparents']);
    h.reset();
    expect(useHints.getState().dismissed).toEqual([]);
  });
});
