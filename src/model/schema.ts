/**
 * Schema versioning and migration. Loading an older `schemaVersion` migrates forward step by
 * step and reports what changed; a newer version than the code understands is refused.
 * Backing up the pre-migration payload is the persistence layer's job (it has the raw string).
 */
import { SCHEMA_VERSION } from './types';
import type { GenerationScaling, Project } from './types';

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
export const migrations: Record<number, Migration> = {};

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
function scalingOf(v: unknown): GenerationScaling {
  return v === 'gentle' || v === 'strong' ? v : 'off';
}

export function normalizeProject(data: Record<string, unknown>): Project {
  const p = data as unknown as Project;
  return {
    ...p,
    schemaVersion: SCHEMA_VERSION,
    persons: p.persons ?? {},
    unions: p.unions ?? {},
    childLinks: p.childLinks ?? {},
    rawRecords: Array.isArray(p.rawRecords) ? p.rawRecords : [],
    settings: { preserveRawGedcom: p.settings?.preserveRawGedcom ?? true, generationScaling: scalingOf(p.settings?.generationScaling) },
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
    modifiedAt: typeof p.modifiedAt === 'number' ? p.modifiedAt : Date.now(),
    name: typeof p.name === 'string' ? p.name : '',
  };
}
