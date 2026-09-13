/**
 * The guided first entry ("Start with yourself"): a four-step form whose result is written
 * into the ordinary model through the ordinary edit functions, as ONE undo step. The draft is
 * kept in localStorage while the wizard is open so leaving mid-way loses nothing.
 */
import type { Draft } from 'immer';
import type { LifeStatus, Project, Sex, UnionStatus } from '@/model/types';
import { addChild, addParent, addPartner, addPerson, typeForStatus } from '@/model/edits';
import { KEY_WIZARD_DRAFT } from './keys';

export interface WizardPerson {
  givenNames: string;
  surname: string;
  /** Year alone is enough; empty means unknown. */
  birthYear: string;
  sex: Sex;
  /** Nothing is assumed: "unknown" unless the user says living or deceased. */
  life: LifeStatus;
  /** Only used when life is "deceased"; empty means the year is not known. */
  deathYear: string;
}

export interface WizardDraft {
  step: 0 | 1 | 2 | 3;
  /** The tree the draft belongs to, so it can be resumed from the project list. */
  projectId?: string;
  self: WizardPerson;
  father: WizardPerson | null;
  mother: WizardPerson | null;
  partner: (WizardPerson & { marriageYear: string; status: UnionStatus }) | null;
  /** The parents' relationship; "unknown" (not recorded) unless the user says otherwise. */
  parentsStatus: UnionStatus;
  children: WizardPerson[];
}

export const emptyPerson = (sex: Sex = 'unknown', life: LifeStatus = 'unknown'): WizardPerson => ({ givenNames: '', surname: '', birthYear: '', sex, life, deathYear: '' });

export function emptyDraft(projectId?: string): WizardDraft {
  // "You" are living; everyone else is not assumed to be either.
  const d: WizardDraft = { step: 0, self: emptyPerson('unknown', 'living'), father: null, mother: null, partner: null, parentsStatus: 'unknown', children: [] };
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
    death: { date: p.life === 'deceased' ? yearOrNull(p.deathYear) : null, qualifier: 'exact' as const, place: '', note: '', cause: '' },
    lifeStatus: p.life,
  });
  const self = addPerson(d, { ...fields(w.self), position: { x: 0, y: 0 } });
  let parentUnion: string | null = null;
  if (hasName(w.father)) parentUnion = addParent(d, self.id, 'male', { ...fields(w.father), sex: 'male' }).union.id;
  if (hasName(w.mother)) parentUnion = addParent(d, self.id, 'female', { ...fields(w.mother), sex: 'female' }).union.id;
  if (parentUnion) {
    const pu = d.unions[parentUnion]!;
    pu.status = w.parentsStatus;
    pu.type = typeForStatus(w.parentsStatus);
  }
  let unionId: string | null = null;
  if (hasName(w.partner)) {
    const r = addPartner(d, self.id, fields(w.partner));
    unionId = r.union.id;
    const u = d.unions[unionId]!;
    u.status = w.partner.status;
    u.type = typeForStatus(w.partner.status);
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
    if (!v || typeof v !== 'object' || !v.self) return null;
    // Drafts saved before the life-status fields existed get the same defaults as a new draft.
    const fill = (p: WizardPerson | null, life: LifeStatus): WizardPerson | null => (p ? { ...emptyPerson(p.sex, life), ...p } : null);
    const d: WizardDraft = { ...emptyDraft(), ...v, self: fill(v.self, 'living')!, father: fill(v.father, 'unknown'), mother: fill(v.mother, 'unknown'), children: (v.children ?? []).map((c) => fill(c, 'unknown')!) };
    if (v.partner) d.partner = { ...fill(v.partner, 'unknown')!, marriageYear: v.partner.marriageYear ?? '', status: v.partner.status ?? 'married' };
    return d;
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
