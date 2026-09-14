/**
 * Schema versioning and migration. Loading an older `schemaVersion` migrates forward step by
 * step and reports what changed; a newer version than the code understands is refused.
 * Backing up the pre-migration payload is the persistence layer's job (it has the raw string).
 */
import { SCHEMA_VERSION } from './types';
import type { ColourGroup, GenerationScaling, Project, Spacing, Tag } from './types';
import { newId } from './types';

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
    typeof (x as Record<string, unknown>).schemaVersion === 'number' &&
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

export function normalizeProject(data: Record<string, unknown>): Project {
  const p = data as unknown as Project;
  const persons: Project['persons'] = {};
  for (const [id, person] of Object.entries(p.persons ?? {})) {
    if (person && typeof person === 'object') persons[id] = { ...person, isPrivate: person.isPrivate === true };
  }
  return {
    ...p,
    schemaVersion: SCHEMA_VERSION,
    persons,
    unions: p.unions ?? {},
    childLinks: p.childLinks ?? {},
    rawRecords: Array.isArray(p.rawRecords) ? p.rawRecords : [],
    settings: { preserveRawGedcom: p.settings?.preserveRawGedcom ?? true, generationScaling: scalingOf(p.settings?.generationScaling), spacing: spacingOf(p.settings?.spacing) },
    groups: Array.isArray(p.groups) ? p.groups.filter((g) => g && typeof g.id === 'string' && typeof g.name === 'string').slice(0, 8) : [],
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
    modifiedAt: typeof p.modifiedAt === 'number' ? p.modifiedAt : Date.now(),
    name: typeof p.name === 'string' ? p.name : '',
  };
}
