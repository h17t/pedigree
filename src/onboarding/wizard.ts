/**
 * The guided first entry ("Start with yourself"): a four-step form whose result is written
 * into the ordinary model through the ordinary edit functions, as ONE undo step. The draft is
 * kept in localStorage while the wizard is open so leaving mid-way loses nothing.
 */
import type { Draft } from 'immer';
import type { Project, Sex, UnionStatus } from '@/model/types';
import { addChild, addParent, addPartner, addPerson } from '@/model/edits';
import { KEY_WIZARD_DRAFT } from './keys';

export interface WizardPerson {
  givenNames: string;
  surname: string;
  /** Year alone is enough; empty means unknown. */
  birthYear: string;
  sex: Sex;
}

export interface WizardDraft {
  step: 0 | 1 | 2 | 3;
  /** The tree the draft belongs to, so it can be resumed from the project list. */
  projectId?: string;
  self: WizardPerson;
  father: WizardPerson | null;
  mother: WizardPerson | null;
  partner: (WizardPerson & { marriageYear: string; status: UnionStatus }) | null;
  children: WizardPerson[];
}

export const emptyPerson = (sex: Sex = 'unknown'): WizardPerson => ({ givenNames: '', surname: '', birthYear: '', sex });

export function emptyDraft(projectId?: string): WizardDraft {
  const d: WizardDraft = { step: 0, self: emptyPerson(), father: null, mother: null, partner: null, children: [] };
  if (projectId) d.projectId = projectId;
  return d;
}

export const WIZARD_STEPS = 4;

/** A year field is valid when empty or exactly four digits. */
export function yearValid(y: string): boolean {
  return y.trim() === '' || /^\d{4}$/.test(y.trim());
}

function yearOrNull(y: string): string | null {
  const m = y.trim().match(/^(\d{4})$/);
  return m ? m[1]! : null;
}

export function hasName(p: WizardPerson | null): p is WizardPerson {
  return !!p && (p.givenNames.trim() !== '' || p.surname.trim() !== '');
}

/** Everything the wizard would create, for the summary and for tests. */
export function summarize(d: WizardDraft): { people: number; unions: number } {
  let people = hasName(d.self) ? 1 : 0;
  if (hasName(d.father)) people++;
  if (hasName(d.mother)) people++;
  if (hasName(d.partner)) people++;
  const kids = d.children.filter(hasName).length;
  people += kids;
  let unions = 0;
  if (hasName(d.father) || hasName(d.mother)) unions++;
  if (hasName(d.partner) || kids > 0) unions++;
  return { people, unions };
}

/**
 * Write the draft into the project. Returns the id of "you". Uses the same edit functions as
 * the editor, so the result is identical to entering the people by hand.
 */
export function applyWizard(d: Draft<Project>, w: WizardDraft): { selfId: string } {
  const fields = (p: WizardPerson) => ({
    givenNames: p.givenNames.trim(),
    surname: p.surname.trim(),
    sex: p.sex,
    birth: { date: yearOrNull(p.birthYear), qualifier: 'exact' as const, place: '', note: '' },
    lifeStatus: 'living' as const,
  });
  const self = addPerson(d, { ...fields(w.self), position: { x: 0, y: 0 } });
  if (hasName(w.father)) addParent(d, self.id, 'male', { ...fields(w.father), sex: 'male' });
  if (hasName(w.mother)) addParent(d, self.id, 'female', { ...fields(w.mother), sex: 'female' });
  let unionId: string | null = null;
  if (hasName(w.partner)) {
    const r = addPartner(d, self.id, fields(w.partner));
    unionId = r.union.id;
    const u = d.unions[unionId]!;
    u.status = w.partner.status;
    u.type = w.partner.status === 'partnership' ? 'partnership' : w.partner.status === 'unknown' ? 'unknown' : 'marriage';
    u.marriageDate = yearOrNull(w.partner.marriageYear);
  }
  for (const c of w.children.filter(hasName)) addChild(d, self.id, unionId, fields(c));
  return { selfId: self.id };
}

// ---- Draft persistence -------------------------------------------------------------------

export function loadDraft(): WizardDraft | null {
  try {
    const raw = localStorage.getItem(KEY_WIZARD_DRAFT);
    if (!raw) return null;
    const v = JSON.parse(raw) as WizardDraft;
    return v && typeof v === 'object' && v.self ? { ...emptyDraft(), ...v } : null;
  } catch {
    return null;
  }
}

export function saveDraft(d: WizardDraft): void {
  try {
    localStorage.setItem(KEY_WIZARD_DRAFT, JSON.stringify(d));
  } catch {
    /* storage full: the draft is only a convenience */
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY_WIZARD_DRAFT);
  } catch {
    /* ignore */
  }
}
