/**
 * Schema versioning and migration. Loading an older `schemaVersion` migrates forward step by
 * step and reports what changed; a newer version than the code understands is refused.
 * Backing up the pre-migration payload is the persistence layer's job (it has the raw string).
 */
import { RELATION_TYPES, SCHEMA_VERSION } from './types';
import type { ColourGroup, EventDate, GenerationScaling, Position, Project, Spacing, Tag } from './types';
import { createPerson, createUnion, emptyDeathDate, emptyEventDate, newId } from './types';

export interface MigrationResult {
  ok: true;
  project: Project;
  fromVersion: number;
  /** Human-readable change notes, one per migration step (already plain language, English keys resolved by the UI). */
  changes: string[];
}
export interface MigrationRefused {
  ok: false;
  reason: 'newer' | 'invalid';
  fileVersion?: number;
}

type Migration = (input: Record<string, unknown>) => { data: Record<string, unknown>; note: string };

/**
 * Migrations keyed by the version they migrate FROM. Version 1 is the first released
 * schema, so this map is empty; future steps are appended here and never edited.
 */
export const migrations: Record<number, Migration> = {
  // 1 → 2: per-person branch tags became named colour groups of the tree.
  1: (input) => {
    const persons = (input.persons ?? {}) as Record<string, Record<string, unknown>>;
    const groups: ColourGroup[] = [];
    const out: Record<string, Record<string, unknown>> = {};
    for (const [id, p] of Object.entries(persons)) {
      if (UNSAFE_KEY.has(id) || !p || typeof p !== 'object') continue;
      const tag = p.tag as Tag | null | undefined;
      let groupId: string | null = null;
      if (tag && typeof tag === 'object' && tag.color) {
        const name = (tag.label ?? '').trim();
        let g = groups.find((x) => x.name === name && x.color === tag.color);
        if (!g) {
          g = { id: newId(), name, color: tag.color };
          groups.push(g);
        }
        groupId = g.id;
      }
      const { tag: _tag, ...rest } = p;
      out[id] = { ...rest, groupId };
    }
    return { data: { ...input, persons: out, groups: [...((input.groups as ColourGroup[] | undefined) ?? []), ...groups] }, note: 'Family branch tags became colour groups' };
  },
};

function looksLikeProject(x: unknown): x is Record<string, unknown> {
  return (
    typeof x === 'object' &&
    x !== null &&
    Number.isInteger((x as Record<string, unknown>).schemaVersion) &&
    ((x as Record<string, unknown>).schemaVersion as number) >= 0 &&
    typeof (x as Record<string, unknown>).persons === 'object' &&
    typeof (x as Record<string, unknown>).unions === 'object'
  );
}

export function migrateProject(input: unknown): MigrationResult | MigrationRefused {
  if (!looksLikeProject(input)) return { ok: false, reason: 'invalid' };
  let data = input;
  const fromVersion = data.schemaVersion as number;
  if (fromVersion > SCHEMA_VERSION) return { ok: false, reason: 'newer', fileVersion: fromVersion };
  const changes: string[] = [];
  let v = fromVersion;
  while (v < SCHEMA_VERSION) {
    const step = migrations[v];
    if (!step) return { ok: false, reason: 'invalid', fileVersion: fromVersion };
    const r = step(data);
    data = { ...r.data, schemaVersion: v + 1 };
    changes.push(r.note);
    v += 1;
  }
  return { ok: true, project: normalizeProject(data), fromVersion, changes };
}

/**
 * Fills in any missing optional collections so that older or hand-edited files never
 * produce `undefined` where the code expects an object or array.
 */
function spacingOf(v: unknown): Spacing {
  return v === 'compact' || v === 'wide' ? v : 'normal';
}

function scalingOf(v: unknown): GenerationScaling {
  return v === 'gentle' || v === 'strong' ? v : 'off';
}

/**
 * Coerce one record against the shape of a freshly created record: a field whose type does not
 * match the default is replaced by the default, optional extras (`dateEnd`, `original`) are kept,
 * and keys that would change an object's prototype are dropped. Hand-edited or third-party files
 * therefore cannot put a `null` where the code expects an object.
 */
/** Keys that would change an object's prototype instead of adding an entry. */
const UNSAFE_KEY = new Set(['__proto__', 'constructor', 'prototype']);

function coerce<T extends object>(raw: unknown, defaults: T): T {
  const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out as T;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (UNSAFE_KEY.has(k)) continue;
    const d = (defaults as Record<string, unknown>)[k];
    if (d === undefined || d === null) out[k] = v; // optional or nullable: kept, checked below where it matters
    else if (Array.isArray(d)) {
      if (Array.isArray(v)) out[k] = v;
    } else if (typeof v === typeof d) out[k] = v;
  }
  return out as T;
}

const asPosition = (v: unknown): Position | null => (v && typeof v === 'object' && typeof (v as Position).x === 'number' && typeof (v as Position).y === 'number' ? { x: (v as Position).x, y: (v as Position).y } : null);
const asDate = (v: unknown): string | null => (typeof v === 'string' ? v : null);

function normalizeEvent<T extends EventDate>(raw: unknown, defaults: T): T {
  const e = coerce(raw, defaults);
  e.date = asDate(e.date);
  if (e.dateEnd !== undefined) e.dateEnd = asDate(e.dateEnd);
  return e;
}

export function normalizeProject(data: Record<string, unknown>): Project {
  const p = data as unknown as Project;
  const persons: Project['persons'] = {};
  const rawPersons = p.persons && typeof p.persons === 'object' ? p.persons : {};
  for (const [id, person] of Object.entries(rawPersons)) {
    if (UNSAFE_KEY.has(id) || !person || typeof person !== 'object') continue;
    const n = coerce(person, createPerson());
    n.id = id;
    n.birth = normalizeEvent(person.birth, emptyEventDate());
    n.death = normalizeEvent(person.death, emptyDeathDate());
    n.position = asPosition(person.position);
    n.groupId = typeof person.groupId === 'string' ? person.groupId : null;
    n.isPrivate = person.isPrivate === true;
    persons[id] = n;
  }
  const unions: Project['unions'] = {};
  const rawUnions = p.unions && typeof p.unions === 'object' ? p.unions : {};
  for (const [id, union] of Object.entries(rawUnions)) {
    if (UNSAFE_KEY.has(id) || !union || typeof union !== 'object') continue;
    const n = coerce(union, createUnion());
    n.id = id;
    // Partners who are not in the file cannot be drawn or edited; the link would only crash later.
    n.partnerIds = [...new Set(n.partnerIds.filter((x) => typeof x === 'string' && persons[x]))];
    n.marriageDate = asDate(n.marriageDate);
    n.divorceDate = asDate(n.divorceDate);
    if (n.marriageDateEnd !== undefined) n.marriageDateEnd = asDate(n.marriageDateEnd);
    if (n.divorceDateEnd !== undefined) n.divorceDateEnd = asDate(n.divorceDateEnd);
    n.position = asPosition(union.position);
    unions[id] = n;
  }
  const childLinks: Project['childLinks'] = {};
  const rawLinks = p.childLinks && typeof p.childLinks === 'object' ? p.childLinks : {};
  for (const [id, link] of Object.entries(rawLinks)) {
    if (UNSAFE_KEY.has(id) || !link || typeof link !== 'object') continue;
    const l = link;
    if (!unions[l.unionId] || !persons[l.childId]) continue; // dangling: nothing to show
    if (Object.values(childLinks).some((x) => x.unionId === l.unionId && x.childId === l.childId)) continue;
    childLinks[id] = { id, unionId: l.unionId, childId: l.childId, relationType: (RELATION_TYPES as readonly string[]).includes(l.relationType) ? l.relationType : 'biological' };
  }
  // A union with neither partners nor children is a leftover record with nothing to show.
  for (const [id, u] of Object.entries(unions)) {
    if (u.partnerIds.length === 0 && !Object.values(childLinks).some((l) => l.unionId === id)) delete unions[id];
  }
  return {
    ...p,
    schemaVersion: SCHEMA_VERSION,
    persons,
    unions,
    childLinks,
    rawRecords: Array.isArray(p.rawRecords) ? p.rawRecords : [],
    settings: { preserveRawGedcom: p.settings?.preserveRawGedcom ?? true, generationScaling: scalingOf(p.settings?.generationScaling), spacing: spacingOf(p.settings?.spacing) },
    groups: Array.isArray(p.groups) ? p.groups.filter((g) => g && typeof g.id === 'string' && typeof g.name === 'string').slice(0, 8) : [],
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
    modifiedAt: typeof p.modifiedAt === 'number' ? p.modifiedAt : Date.now(),
    name: typeof p.name === 'string' ? p.name : '',
    id: typeof p.id === 'string' ? p.id : newId(),
  };
}
