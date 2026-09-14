/**
 * Project-level operations: create, duplicate, rename, delete, backup export/import and the
 * sample family. These are not part of the undo stack (they act on whole projects).
 */
import { createProject, newId } from '@/model/types';
import type { Project, ProjectMeta } from '@/model/types';
import { migrateProject } from '@/model/schema';
import { t } from '@/i18n';
import { deleteProjectData, loadProject, metaOf, readIndex, saveProject, upsertIndex } from './persistence';
import type { WriteResult } from './storage';
import { openProject, useAppStore, markBackedUp } from './store';

export function listProjects(): ProjectMeta[] {
  return readIndex().sort((a, b) => b.modifiedAt - a.modifiedAt);
}

export function createEmptyProject(name = t('projects.newName')): { ok: true; id: string } | { ok: false; reason: 'quota' | 'other' } {
  const p = createProject(name);
  const w = saveProject(p);
  if (!w.ok) return { ok: false, reason: w.reason };
  return { ok: true, id: p.id };
}

/** Store an in-memory project under a fresh id (used for imports and the sample). */
export function adoptProject(project: Project, name: string): { ok: true; id: string } | { ok: false; reason: 'quota' | 'other' } {
  const now = Date.now();
  const p: Project = { ...project, id: newId(), name, createdAt: now, modifiedAt: now };
  const w = saveProject(p);
  if (!w.ok) return { ok: false, reason: w.reason };
  return { ok: true, id: p.id };
}

export function duplicateProject(id: string): { ok: true; id: string } | { ok: false; reason: 'quota' | 'other' | 'unreadable' } {
  const r = loadProject(id);
  if (r.status !== 'loaded') return { ok: false, reason: 'unreadable' };
  const a = adoptProject(r.project, t('projects.copyName', { name: r.project.name }));
  return a;
}

export function renameProject(id: string, name: string): WriteResult {
  const s = useAppStore.getState();
  if (s.projectId === id && s.project) {
    // Rename through the open project so the in-memory copy stays authoritative.
    const project = { ...s.project, name, modifiedAt: Date.now() };
    useAppStore.setState({ project });
    return saveProject(project);
  }
  const r = loadProject(id);
  if (r.status !== 'loaded') return { ok: false, reason: 'other', error: null };
  return saveProject({ ...r.project, name, modifiedAt: Date.now() });
}

export function deleteProject(id: string): void {
  const s = useAppStore.getState();
  if (s.projectId === id) {
    // closing releases the lock and clears undo
    useAppStore.setState({ projectId: null, project: null, status: 'idle' });
  }
  deleteProjectData(id);
}

/** Loads the sample family as a new, clearly named project (never overwrites anything). */
export async function loadSampleProject(): Promise<{ ok: true; id: string } | { ok: false; reason: 'quota' | 'other' }> {
  const mod = await import('@/fixtures/sample-family.json');
  const m = migrateProject(mod.default);
  if (!m.ok) return { ok: false, reason: 'other' };
  return adoptProject(m.project, t('projects.sampleName'));
}

// ---- Backup files ------------------------------------------------------------------------

export type ImportResult =
  | { ok: true; id: string; name: string; migrated: boolean }
  | { ok: false; reason: 'invalid' | 'newer' | 'quota' | 'other'; fileVersion?: number };

/** Parse a backup file's text and store it as a new project. */
export function importBackupText(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  const m = migrateProject(parsed);
  if (!m.ok) return m.reason === 'newer' ? { ok: false, reason: 'newer', fileVersion: m.fileVersion } : { ok: false, reason: 'invalid' };
  const name = m.project.name || t('projects.newName');
  const a = adoptProject(m.project, name);
  if (!a.ok) return a;
  return { ok: true, id: a.id, name, migrated: m.fromVersion !== m.project.schemaVersion };
}

export function backupFileName(project: Project, now = new Date()): string {
  const safe = project.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'tree';
  const date = now.toISOString().slice(0, 10);
  return `${t('data.backupFilePrefix')}-${safe}-${date}.json`;
}

export function backupText(project: Project): string {
  return JSON.stringify(project, null, 2);
}

/** Trigger a download of the current project as a .json backup and reset the reminder. */
export function downloadBackup(): string | null {
  const s = useAppStore.getState();
  if (!s.project) return null;
  const name = backupFileName(s.project);
  const blob = new Blob([backupText(s.project)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  markBackedUp();
  return name;
}

/** Download an arbitrary text payload (used for the corrupt-data recovery download). */
export function downloadText(text: string, fileName: string): void {
  const blob = new Blob([text], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  // Inside an open modal dialog everything else is inert, so the link must live in the dialog.
  (document.querySelector('dialog[open]') ?? document.body).appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function openAndRemember(id: string): void {
  openProject(id);
}

export { metaOf, upsertIndex };
