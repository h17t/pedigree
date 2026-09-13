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
  self: { givenNames: 'Anna', surname: 'Weber', birthYear: '1970', sex: 'female' },
  father: { givenNames: 'Karl', surname: 'Weber', birthYear: '1940', sex: 'male' },
  mother: { givenNames: 'Maria', surname: 'Koch', birthYear: '1942', sex: 'female' },
  partner: { givenNames: 'Peter', surname: 'Schulz', birthYear: '1968', sex: 'male', marriageYear: '1995', status: 'married' },
  children: [
    { givenNames: 'Lena', surname: 'Weber', birthYear: '1996', sex: 'female' },
    { givenNames: 'Tom', surname: 'Weber', birthYear: '', sex: 'male' },
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
    const w: WizardDraft = { ...emptyDraft(), self: { givenNames: 'Ich', surname: '', birthYear: 'abc', sex: 'unknown' } };
    const p = produce(createProject('w'), (d) => void applyWizard(d, w));
    expect(Object.keys(p.persons)).toHaveLength(1);
    expect(Object.values(p.persons)[0]!.birth.date).toBeNull();
    expect(Object.keys(p.unions)).toHaveLength(0);
  });

  it('children without a partner hang from a single-parent union', () => {
    const w: WizardDraft = { ...emptyDraft(), self: { givenNames: 'Solo', surname: 'X', birthYear: '', sex: 'male' }, children: [{ givenNames: 'Kid', surname: 'X', birthYear: '2000', sex: 'unknown' }] };
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
    saveDraft({ ...emptyDraft(), step: 2, self: { givenNames: 'A', surname: 'B', birthYear: '1950', sex: 'female' } });
    expect(loadDraft()).toMatchObject({ step: 2, self: { givenNames: 'A' } });
    clearDraft();
    expect(loadDraft()).toBeNull();
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
