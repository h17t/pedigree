/**
 * Loading and saving projects, the project index, corrupt-data recovery, migrations with a
 * pre-migration backup, and quota handling. Nothing here ever overwrites a payload it could
 * not read.
 */
import { migrateProject } from '@/model/schema';
import type { Project, ProjectMeta } from '@/model/types';
import { KEY, getItem, readJson, removeItem, setItem, appKeys, usedBytes } from './storage';
import type { WriteResult } from './storage';

export type LoadResult =
  | { status: 'loaded'; project: Project; raw: string; migration: { fromVersion: number; changes: string[] } | null }
  | { status: 'corrupt'; raw: string; recoveryKey: string }
  | { status: 'newer'; fileVersion: number; raw: string }
  | { status: 'missing' };

export function readIndex(): ProjectMeta[] {
  const r = readJson<ProjectMeta[]>(KEY.index);
  if (!r.ok || !Array.isArray(r.value)) return [];
  return r.value.filter((m) => m && typeof m.id === 'string');
}

export function writeIndex(index: ProjectMeta[]): WriteResult {
  return setItem(KEY.index, JSON.stringify(index));
}

export function metaOf(p: Project): ProjectMeta {
  return { id: p.id, name: p.name, createdAt: p.createdAt, modifiedAt: p.modifiedAt, personCount: Object.keys(p.persons).length };
}

export function upsertIndex(meta: ProjectMeta): WriteResult {
  const index = readIndex();
  const i = index.findIndex((m) => m.id === meta.id);
  if (i >= 0) index[i] = meta;
  else index.push(meta);
  index.sort((a, b) => b.modifiedAt - a.modifiedAt);
  return writeIndex(index);
}

export function removeFromIndex(id: string): void {
  writeIndex(readIndex().filter((m) => m.id !== id));
}

/**
 * Load a project. A payload that cannot be parsed is copied to a recovery key (once) and
 * reported as corrupt; a newer schema is reported without touching anything; an older schema
 * is migrated after the original payload has been backed up.
 */
export function loadProject(id: string): LoadResult {
  const raw = getItem(KEY.project(id));
  if (raw === null) return { status: 'missing' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'corrupt', raw, recoveryKey: keepForRecovery(id, raw) };
  }
  const m = migrateProject(parsed);
  if (!m.ok) {
    if (m.reason === 'newer') return { status: 'newer', fileVersion: m.fileVersion ?? 0, raw };
    return { status: 'corrupt', raw, recoveryKey: keepForRecovery(id, raw) };
  }
  if (m.fromVersion !== m.project.schemaVersion) {
    // Back up the pre-migration payload before the migrated project is ever written.
    setItem(KEY.migrationBackup(id, m.fromVersion), raw);
    const w = saveProject(m.project);
    if (!w.ok) {
      // Could not persist the migrated form; keep serving the migrated data in memory.
    }
    return { status: 'loaded', project: m.project, raw, migration: { fromVersion: m.fromVersion, changes: m.changes } };
  }
  if (m.project.id !== id) m.project.id = id;
  return { status: 'loaded', project: m.project, raw, migration: null };
}

function keepForRecovery(id: string, raw: string): string {
  // Reuse an existing recovery copy of the same content instead of stacking duplicates.
  for (const k of appKeys()) {
    if (k.startsWith(`pedigree:recovery:${id}:`) && getItem(k) === raw) return k;
  }
  const key = KEY.recovery(id, Date.now());
  setItem(key, raw);
  return key;
}

export function listRecoveryKeys(): { key: string; projectId: string; timestamp: number; bytes: number }[] {
  return appKeys()
    .filter((k) => k.startsWith('pedigree:recovery:'))
    .map((key) => {
      const [, , projectId = '', ts = '0'] = key.split(':');
      return { key, projectId, timestamp: Number(ts), bytes: (getItem(key)?.length ?? 0) * 2 };
    });
}

export function saveProject(project: Project): WriteResult {
  const known = readIndex().some((m) => m.id === project.id);
  const w = setItem(KEY.project(project.id), JSON.stringify(project));
  if (!w.ok) return w;
  const i = upsertIndex(metaOf(project));
  // The index is what the project list reads: a new project the index could not take would be
  // storage nobody can see or remove, so it is rolled back instead.
  if (!i.ok && !known) removeItem(KEY.project(project.id));
  return i.ok ? { ok: true } : i;
}

export function deleteProjectData(id: string): void {
  removeItem(KEY.project(id));
  removeItem(KEY.ui(id));
  removeItem(KEY.lock(id));
  removeFromIndex(id);
}

/** Per-project UI state that survives reloads: mode, selection, backup bookkeeping. */
export interface ProjectUiMeta {
  mode: string;
  selectedPersonId: string | null;
  expanded: string[];
  changesSinceBackup: number;
  lastBackupAt: number | null;
  backupBannerDismissedAt: number | null;
  viewport: { x: number; y: number; zoom: number } | null;
  detailLevel: 'minimal' | 'standard' | 'full';
  filter: { kind: 'ancestors'; personId: string } | { kind: 'descendants'; personId: string } | { kind: 'around'; personId: string; generations: number } | { kind: 'ids'; ids: string[] } | null;
  legendOpen: boolean;
  snapToGrid: boolean;
  /** Leave people marked private off the canvas (off by default; print and export have their own switch). */
  hidePrivate: boolean;
  /** Chart mode of the tree view (pedigree or descendants), or the ordinary canvas. */
  chart: { kind: 'ancestors'; personId: string; generations: number } | { kind: 'descendants'; personId: string; depth: number } | null;
}

export const defaultUiMeta = (): ProjectUiMeta => ({
  mode: 'tree',
  selectedPersonId: null,
  expanded: [],
  changesSinceBackup: 0,
  lastBackupAt: null,
  backupBannerDismissedAt: null,
  viewport: null,
  detailLevel: 'standard',
  filter: null,
  legendOpen: false,
  snapToGrid: false,
  hidePrivate: false,
  chart: null,
});

export function loadUiMeta(id: string): ProjectUiMeta {
  const r = readJson<Partial<ProjectUiMeta>>(KEY.ui(id));
  return r.ok && r.value && typeof r.value === 'object' ? { ...defaultUiMeta(), ...r.value } : defaultUiMeta();
}

export function saveUiMeta(id: string, meta: ProjectUiMeta): void {
  setItem(KEY.ui(id), JSON.stringify(meta));
}

/** Storage summary for the Data view and the near-limit warning. */
export function storageSummary(capacity: number | null): { used: number; capacity: number; fraction: number } {
  const used = usedBytes();
  const cap = capacity ?? 5 * 1024 * 1024;
  return { used, capacity: cap, fraction: used / cap };
}

export const NEAR_LIMIT_FRACTION = 0.8;
