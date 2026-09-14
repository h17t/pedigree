/**
 * The data model. Normalized, fully typed, with stable UUID v4 ids and a schemaVersion for
 * migrations. See the brief and DECISIONS.md for the reasoning behind each field.
 */

import { joinName } from './nameOrder';

export const SCHEMA_VERSION = 2;

export type Sex = 'male' | 'female' | 'diverse' | 'unknown';
export type LifeStatus = 'living' | 'deceased' | 'unknown';
/**
 * How a date is to be read. 'between' (GEDCOM BET … AND …) and 'from' (FROM … TO …) are
 * ranges: `date` is the start and `dateEnd` the end (a FROM without TO has no end).
 */
export type DateQualifier = 'exact' | 'about' | 'before' | 'after' | 'estimated' | 'between' | 'from';

/** 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD' | null (unknown). */
export type PartialDate = string | null;

export interface EventDate {
  date: PartialDate;
  qualifier: DateQualifier;
  /** End of a date range (qualifier 'between' or 'from'); absent or null otherwise. */
  dateEnd?: PartialDate;
  place: string;
  note: string;
  /**
   * Verbatim GEDCOM DATE value when the original could not be represented exactly
   * (BET/FROM ranges, Julian or dual-year dates). Written back on export unless the user
   * edited the date, which clears it. See DECISIONS.md #45.
   */
  gedcomDate?: string;
}

export interface DeathDate extends EventDate {
  cause: string;
}

export type LifeEventType = 'baptism' | 'burial' | 'residence' | 'emigration' | 'other';

export interface LifeEvent {
  id: string;
  type: LifeEventType;
  /** Free-text label, used when type is 'other'. */
  label: string;
  date: PartialDate;
  qualifier: DateQualifier;
  dateEnd?: PartialDate;
  place: string;
  note: string;
  gedcomDate?: string;
}

export interface CustomField {
  label: string;
  value: string;
}

export interface Position {
  x: number;
  y: number;
}

export type TagName = 'green' | 'amber' | 'plum' | 'red' | 'steel' | 'blue';

/** Schema 1 per-person tag; schema 2 turned these into named colour groups. */
export interface Tag {
  color: TagName;
  label: string;
}

/** A named colour group of the tree (at most MAX_GROUPS); a person is in one group or none. */
export interface ColourGroup {
  id: string;
  name: string;
  color: TagName;
}
export const MAX_GROUPS = 8;

export interface Person {
  id: string;
  givenNames: string;
  surname: string;
  birthName: string;
  nickname: string;
  titlePrefix: string;
  sex: Sex;
  birth: EventDate;
  death: DeathDate;
  lifeStatus: LifeStatus;
  occupation: string;
  religion: string;
  residence: string;
  events: LifeEvent[];
  sources: string;
  notes: string;
  customFields: CustomField[];
  /** null = not yet laid out (e.g. freshly imported). */
  position: Position | null;
  /** The colour group this person belongs to (see Project.groups), or none. */
  groupId: string | null;
  /** Private people are left out of print, SVG/PNG and GEDCOM export when "hide private people" is on. */
  isPrivate: boolean;
  /** Unknown GEDCOM lines belonging to this person, preserved verbatim for export. */
  rawGedcom: string[];
  /** Original GEDCOM cross-reference id (e.g. "@I12@") so exports keep references valid. */
  gedcomXref?: string;
}

export type UnionType = 'marriage' | 'partnership' | 'unmarried' | 'unknown';
export type UnionStatus = 'married' | 'divorced' | 'widowed' | 'separated' | 'partnership' | 'unknown';

export interface Union {
  id: string;
  /** Usually 2. 1 for a single/unknown partner, 0 for a sibling group with unknown parents. */
  partnerIds: string[];
  type: UnionType;
  marriageDate: PartialDate;
  marriageQualifier: DateQualifier;
  marriageDateEnd?: PartialDate;
  marriagePlace: string;
  divorceDate: PartialDate;
  divorceQualifier: DateQualifier;
  divorceDateEnd?: PartialDate;
  status: UnionStatus;
  notes: string;
  position: Position | null;
  rawGedcom: string[];
  marriageGedcomDate?: string;
  divorceGedcomDate?: string;
  gedcomXref?: string;
}

export type RelationType = 'biological' | 'adopted' | 'step' | 'foster' | 'unknown';

export interface ChildLink {
  id: string;
  unionId: string;
  childId: string;
  relationType: RelationType;
}

/** How strongly crowded generations are shrunk so the drawing stays balanced. */
export type GenerationScaling = 'off' | 'gentle' | 'strong';
/** Gap between cards and between generations. */
export type Spacing = 'compact' | 'normal' | 'wide';

export interface ProjectSettings {
  /** Whether unknown GEDCOM data is kept for round-trips (it costs storage). */
  preserveRawGedcom: boolean;
  /** Per-generation card scaling ("Balance generations"); off by default. */
  generationScaling: GenerationScaling;
  /** Card and generation gaps of the automatic arrangement; normal by default. */
  spacing: Spacing;
}

export interface Project {
  schemaVersion: number;
  id: string;
  name: string;
  createdAt: number;
  modifiedAt: number;
  persons: Record<string, Person>;
  unions: Record<string, Union>;
  childLinks: Record<string, ChildLink>;
  /** Unreferenced top-level GEDCOM records (SOUR, REPO, OBJE, SUBM, NOTE, _custom), verbatim. */
  rawRecords: string[];
  settings: ProjectSettings;
  /** Named colour groups shown as a stripe on the cards. */
  groups: ColourGroup[];
}

/** Lightweight entry of the project index kept in localStorage. */
export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  modifiedAt: number;
  personCount: number;
}

// ---- Factories --------------------------------------------------------------------------

export function newId(): string {
  return crypto.randomUUID();
}

export function emptyEventDate(): EventDate {
  return { date: null, qualifier: 'exact', place: '', note: '' };
}

export function emptyDeathDate(): DeathDate {
  return { date: null, qualifier: 'exact', place: '', note: '', cause: '' };
}

export function createPerson(partial: Partial<Person> = {}): Person {
  return {
    id: newId(),
    givenNames: '',
    surname: '',
    birthName: '',
    nickname: '',
    titlePrefix: '',
    sex: 'unknown',
    birth: emptyEventDate(),
    death: emptyDeathDate(),
    lifeStatus: 'unknown',
    occupation: '',
    religion: '',
    residence: '',
    events: [],
    sources: '',
    notes: '',
    customFields: [],
    position: null,
    groupId: null,
    isPrivate: false,
    rawGedcom: [],
    ...partial,
  };
}

export function createUnion(partial: Partial<Union> = {}): Union {
  return {
    id: newId(),
    partnerIds: [],
    type: 'unknown',
    marriageDate: null,
    marriageQualifier: 'exact',
    marriagePlace: '',
    divorceDate: null,
    divorceQualifier: 'exact',
    status: 'unknown',
    notes: '',
    position: null,
    rawGedcom: [],
    ...partial,
  };
}

export function createChildLink(unionId: string, childId: string, relationType: RelationType = 'biological'): ChildLink {
  return { id: newId(), unionId, childId, relationType };
}

export function createProject(name: string, partial: Partial<Project> = {}): Project {
  const now = Date.now();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    name,
    createdAt: now,
    modifiedAt: now,
    persons: {},
    unions: {},
    childLinks: {},
    rawRecords: [],
    settings: { preserveRawGedcom: true, generationScaling: 'off', spacing: 'normal' },
    groups: [],
    ...partial,
  };
}

/** Display name: "Given Surname", falling back to whichever part exists. */
export function personName(p: Pick<Person, 'givenNames' | 'surname' | 'titlePrefix'>): string {
  return [p.titlePrefix.trim(), joinName(p.givenNames, p.surname)].filter((s) => s !== '').join(' ').trim();
}

/** A death date always means deceased; otherwise the explicit field wins. */
/** Name with the birth name in brackets: "Anna Schuster (née Wiese)" / "(geb. Wiese)". */
export function displayName(p: Pick<Person, 'givenNames' | 'surname' | 'titlePrefix' | 'birthName'>, neeLabel: string): string {
  const base = personName(p);
  const nee = p.birthName.trim();
  return nee && nee !== p.surname.trim() ? `${base} (${neeLabel} ${nee})` : base;
}

export function effectiveLifeStatus(p: Pick<Person, 'death' | 'lifeStatus'>): LifeStatus {
  return p.death.date ? 'deceased' : p.lifeStatus;
}
