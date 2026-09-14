/**
 * The app store (Zustand). Holds the open project, its lock state, save state, undo
 * bookkeeping, validation warnings and the per-project UI meta. All mutations of the
 * project go through `transact`, which records one undo step and schedules an autosave.
 */
import { create } from 'zustand';
import type { Draft } from 'immer';
import type { Project } from '@/model/types';
import { validateProject } from '@/model/validation';
import type { ValidationWarning } from '@/model/validation';
import { UndoStack } from './undo';
import type { UndoEntry } from './undo';
import { acquireLock } from './lock';
import type { LockHandle } from './lock';
import {
  loadProject,
  loadUiMeta,
  saveProject,
  saveUiMeta,
  defaultUiMeta,
  storageSummary,
  NEAR_LIMIT_FRACTION,
} from './persistence';
import type { ProjectUiMeta } from './persistence';
import { useSettings } from './settings';
import { ensureCjkFor } from '@/design/cjkFonts';

export type LoadStatus = 'idle' | 'ready' | 'corrupt' | 'newer' | 'missing';
export type LockState = 'owner' | 'other' | 'lost';
export type SaveState = 'saved' | 'pending' | 'quota' | 'error';

export interface AppState {
  projectId: string | null;
  project: Project | null;
  status: LoadStatus;
  corruptRaw: string | null;
  corruptRecoveryKey: string | null;
  newerVersion: number | null;
  migrationNotice: { fromVersion: number; changes: string[] } | null;
  lockState: LockState;
  /** Another tab wrote a newer version of this project while we were read-only. */
  newerStateAvailable: boolean;
  saveState: SaveState;
  lastSavedAt: number | null;
  storageNearLimit: boolean;
  ui: ProjectUiMeta;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  warnings: ValidationWarning[];
}

const initial: AppState = {
  projectId: null,
  project: null,
  status: 'idle',
  corruptRaw: null,
  corruptRecoveryKey: null,
  newerVersion: null,
  migrationNotice: null,
  lockState: 'owner',
  newerStateAvailable: false,
  saveState: 'saved',
  lastSavedAt: null,
  storageNearLimit: false,
  ui: defaultUiMeta(),
  canUndo: false,
  canRedo: false,
  undoLabel: null,
  redoLabel: null,
  warnings: [],
};

export const useAppStore = create<AppState>(() => ({ ...initial }));

// ---- Module-level machinery (not React state) ----------------------------------------

const undo = new UndoStack<Project>();
let lock: LockHandle | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let uiTimer: ReturnType<typeof setTimeout> | null = null;
const AUTOSAVE_MS = 500;

function undoFlags() {
  return { canUndo: undo.canUndo, canRedo: undo.canRedo, undoLabel: undo.undoLabel, redoLabel: undo.redoLabel };
}

// ---- Undo history for the tab session --------------------------------------------------------
// The history is written to sessionStorage with the project's modification stamp, so a reload
// of the same tab picks it up again; another tab, or a project changed elsewhere, never does.

const undoKey = (id: string) => `pedigree:undo:${id}`;

function session(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

function saveUndoHistory(projectId: string, project: Project): void {
  const store = session();
  if (!store) return;
  for (let attempt = 0; attempt < 8; attempt++) {
    const snap = undo.snapshot();
    if (snap.past.length === 0 && snap.future.length === 0) {
      store.removeItem(undoKey(projectId));
      return;
    }
    try {
      store.setItem(undoKey(projectId), JSON.stringify({ modifiedAt: project.modifiedAt, ...snap }));
      return;
    } catch {
      undo.halve(); // does not fit: keep the newer half and try again
    }
  }
}

function restoreUndoHistory(projectId: string, project: Project): void {
  const store = session();
  if (!store) return;
  try {
    const raw = store.getItem(undoKey(projectId));
    if (!raw) return;
    const data = JSON.parse(raw) as { modifiedAt: number; past: UndoEntry[]; future: UndoEntry[] };
    if (data.modifiedAt === project.modifiedAt && Array.isArray(data.past) && Array.isArray(data.future)) undo.restore(data);
    else store.removeItem(undoKey(projectId));
  } catch {
    store.removeItem(undoKey(projectId));
  }
}

function onStorageEvent(ev: StorageEvent) {
  const { projectId, lockState } = useAppStore.getState();
  if (!projectId || ev.key !== `pedigree:project:${projectId}`) return;
  if (lockState !== 'owner') useAppStore.setState({ newerStateAvailable: true });
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', onStorageEvent);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
  });
  window.addEventListener('pagehide', flushSave);
}

// ---- Opening and closing ---------------------------------------------------------------

export function openProject(id: string): LoadStatus {
  closeProject();
  const result = loadProject(id);
  if (result.status === 'missing') {
    useAppStore.setState({ ...initial, projectId: id, status: 'missing' });
    return 'missing';
  }
  if (result.status === 'corrupt') {
    useAppStore.setState({ ...initial, projectId: id, status: 'corrupt', corruptRaw: result.raw, corruptRecoveryKey: result.recoveryKey });
    return 'corrupt';
  }
  if (result.status === 'newer') {
    useAppStore.setState({ ...initial, projectId: id, status: 'newer', newerVersion: result.fileVersion });
    return 'newer';
  }
  lock = acquireLock(id, (e) => {
    if (e === 'lost') useAppStore.setState({ lockState: 'lost' });
    if (e === 'released') {
      // Owner went away: a read-only tab may now take over without waiting for staleness.
      const s = useAppStore.getState();
      if (s.lockState === 'other') useAppStore.setState({ lockState: 'other' });
    }
  });
  const ui = loadUiMeta(id);
  restoreUndoHistory(id, result.project);
  loadFontsFor(result.project);
  useAppStore.setState({
    ...initial,
    projectId: id,
    project: result.project,
    status: 'ready',
    migrationNotice: result.migration,
    lockState: lock.owner ? 'owner' : 'other',
    ui,
    warnings: validateProject(result.project),
    lastSavedAt: Date.now(),
    storageNearLimit: storageSummary(useSettings.getState().storageCapacity).fraction >= NEAR_LIMIT_FRACTION,
    ...undoFlags(),
  });
  useSettings.getState().update({ lastOpenProjectId: id });
  return 'ready';
}

export function closeProject(): void {
  flushSave();
  lock?.release();
  lock = null;
  undo.clear();
  useAppStore.setState({ ...initial });
}

/** Read-only tab asks to become the editor. */
export function takeOverEditing(): void {
  const { projectId } = useAppStore.getState();
  if (!projectId || !lock) return;
  lock.takeOver();
  useAppStore.setState({ lockState: 'owner', newerStateAvailable: false });
}

/** A tab that lost the lock (or is read-only) reloads the newest stored state. */
export function reloadFromStorage(): void {
  const { projectId } = useAppStore.getState();
  if (projectId) openProject(projectId);
}

export function dismissMigrationNotice(): void {
  useAppStore.setState({ migrationNotice: null });
}

// ---- Mutations ---------------------------------------------------------------------------

/**
 * Apply a change as one undoable step. Returns false when the project is read-only.
 * Nested calls join the outer step.
 */
export function transact(label: string, recipe: (draft: Draft<Project>) => void): boolean {
  const s = useAppStore.getState();
  if (!s.project || s.lockState !== 'owner') return false;
  const before = s.project;
  const next = undo.transact(before, label, (draft) => {
    recipe(draft);
    draft.modifiedAt = Date.now();
  });
  if (next === before) return true;
  afterChange(next, 1);
  return true;
}

export function undoLast(): void {
  const s = useAppStore.getState();
  if (!s.project || s.lockState !== 'owner') return;
  const r = undo.undo(s.project);
  if (r) afterChange(r.state, 1);
}

export function redoLast(): void {
  const s = useAppStore.getState();
  if (!s.project || s.lockState !== 'owner') return;
  const r = undo.redo(s.project);
  if (r) afterChange(r.state, 1);
}

function afterChange(project: Project, changeCount: number): void {
  const s = useAppStore.getState();
  const ui = { ...s.ui, changesSinceBackup: s.ui.changesSinceBackup + changeCount };
  useAppStore.setState({ project, ui, warnings: validateProject(project), saveState: 'pending', ...undoFlags() });
  loadFontsFor(project);
  scheduleSave();
  scheduleUiSave();
}

/** Names in East Asian scripts need their font family; the stylesheet is injected once. */
function loadFontsFor(project: Project): void {
  let text = '';
  for (const p of Object.values(project.persons)) text += p.givenNames + p.surname + p.birthName;
  ensureCjkFor(text);
}

/** Undo bookkeeping is written together with the project (see flushSave). */
function flushUndoHistory(): void {
  const s = useAppStore.getState();
  if (s.projectId && s.project && s.lockState === 'owner') saveUndoHistory(s.projectId, s.project);
}

/** Update per-project UI meta (mode, selection, expanded rows, backup bookkeeping). */
export function updateUi(patch: Partial<ProjectUiMeta>): void {
  const s = useAppStore.getState();
  useAppStore.setState({ ui: { ...s.ui, ...patch } });
  // Mode and selection changes are written at once so another tab (or a reload a moment
  // later) lands where the user is; frequent changes such as the viewport are debounced.
  if ('mode' in patch || 'selectedPersonId' in patch || 'filter' in patch) flushUiSave();
  else scheduleUiSave();
}

function flushUiSave(): void {
  if (uiTimer) clearTimeout(uiTimer);
  uiTimer = null;
  const { projectId, ui } = useAppStore.getState();
  if (projectId) saveUiMeta(projectId, ui);
}

export function markBackedUp(): void {
  updateUi({ changesSinceBackup: 0, lastBackupAt: Date.now(), backupBannerDismissedAt: null });
  flushSave();
}

export function dismissBackupBanner(): void {
  updateUi({ backupBannerDismissedAt: Date.now() });
}

// ---- Saving ---------------------------------------------------------------------------------

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, AUTOSAVE_MS);
}

function scheduleUiSave(): void {
  if (uiTimer) clearTimeout(uiTimer);
  uiTimer = setTimeout(() => {
    const { projectId, ui } = useAppStore.getState();
    if (projectId) saveUiMeta(projectId, ui);
  }, AUTOSAVE_MS);
}

/** Write the project now (used by the autosave timer, tab hide and explicit actions). */
export function flushSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  const s = useAppStore.getState();
  if (s.projectId && s.lockState === 'owner') saveUiMeta(s.projectId, s.ui);
  if (!s.project || s.lockState !== 'owner' || s.saveState === 'saved') return;
  const w = saveProject(s.project);
  flushUndoHistory();
  if (w.ok) {
    const near = storageSummary(useSettings.getState().storageCapacity).fraction >= NEAR_LIMIT_FRACTION;
    useAppStore.setState({ saveState: 'saved', lastSavedAt: Date.now(), storageNearLimit: near });
  } else {
    // The previous good copy is untouched; the unsaved changes stay in memory.
    useAppStore.setState({ saveState: w.reason === 'quota' ? 'quota' : 'error' });
  }
}

/** Test hook: reset module state between tests. */
export function __resetForTests(): void {
  closeProject();
}
