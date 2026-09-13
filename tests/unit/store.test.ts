import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject, createPerson } from '@/model/types';
import type { Project } from '@/model/types';
import { KEY } from '@/store/storage';
import { loadProject, saveProject, readIndex, listRecoveryKeys, upsertIndex, metaOf } from '@/store/persistence';
import { openProject, transact, undoLast, redoLast, useAppStore, flushSave, closeProject, __resetForTests } from '@/store/store';
import { acquireLock, readLock, STALE_MS } from '@/store/lock';
import { backupStatus } from '@/store/backupReminder';
import { importBackupText, createEmptyProject, duplicateProject, deleteProject, listProjects } from '@/store/projects';

beforeEach(() => {
  __resetForTests();
  localStorage.clear();
  vi.useRealTimers();
});

function storedProject(name = 'Test') {
  const p = createProject(name);
  const a = createPerson({ givenNames: 'Anna', surname: 'Weber' });
  p.persons[a.id] = a;
  expect(saveProject(p).ok).toBe(true);
  return { p, a };
}

describe('persistence', () => {
  it('saves and loads a project and keeps the index sorted', () => {
    const { p } = storedProject('One');
    const r = loadProject(p.id);
    expect(r.status).toBe('loaded');
    expect(r.status === 'loaded' && r.project.name).toBe('One');
    expect(readIndex().map((m) => m.id)).toEqual([p.id]);
  });

  it('never overwrites corrupt data: keeps it under a recovery key and reports it', () => {
    localStorage.setItem(KEY.project('bad'), '{not json');
    const r = loadProject('bad');
    expect(r.status).toBe('corrupt');
    if (r.status === 'corrupt') {
      expect(localStorage.getItem(r.recoveryKey)).toBe('{not json');
      expect(localStorage.getItem(KEY.project('bad'))).toBe('{not json');
    }
    // Loading again does not stack a second copy of the same content.
    loadProject('bad');
    expect(listRecoveryKeys()).toHaveLength(1);
    // The store surfaces it without crashing.
    expect(openProject('bad')).toBe('corrupt');
    expect(useAppStore.getState().corruptRaw).toBe('{not json');
  });

  it('refuses a newer schema without touching it', () => {
    const p = { ...createProject('Future'), schemaVersion: 99 };
    localStorage.setItem(KEY.project(p.id), JSON.stringify(p));
    const r = loadProject(p.id);
    expect(r.status).toBe('newer');
    expect(r.status === 'newer' && r.fileVersion).toBe(99);
    expect((JSON.parse(localStorage.getItem(KEY.project(p.id))!) as Project).schemaVersion).toBe(99);
    expect(openProject(p.id)).toBe('newer');
  });

  it('reports a quota error and leaves the previous copy intact', () => {
    const { p } = storedProject('Q');
    const before = localStorage.getItem(KEY.project(p.id));
    const original = localStorage.setItem.bind(localStorage);
    const quota = new DOMException('quota', 'QuotaExceededError');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      if (key === KEY.project(p.id)) throw quota;
      original(key, value);
    });
    try {
      const w = saveProject({ ...p, name: 'changed' });
      expect(w).toMatchObject({ ok: false, reason: 'quota' });
      expect(localStorage.getItem(KEY.project(p.id))).toBe(before);
      // via the store: state stays in memory and saveState reports the problem
      vi.restoreAllMocks();
      openProject(p.id);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
        if (key === KEY.project(p.id)) throw quota;
        original(key, value);
      });
      transact('rename', (d) => void (d.name = 'in memory'));
      flushSave();
      expect(useAppStore.getState().saveState).toBe('quota');
      expect(useAppStore.getState().project?.name).toBe('in memory');
      expect((JSON.parse(localStorage.getItem(KEY.project(p.id))!) as Project).name).toBe('Q');
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe('store: transact / undo / redo', () => {
  it('records one undoable step per transact and autosaves', () => {
    vi.useFakeTimers();
    const { p } = storedProject('S');
    openProject(p.id);
    expect(transact('add person', (d) => {
      const x = createPerson({ givenNames: 'Karl' });
      d.persons[x.id] = x;
    })).toBe(true);
    let s = useAppStore.getState();
    expect(Object.keys(s.project!.persons)).toHaveLength(2);
    expect(s.canUndo).toBe(true);
    expect(s.undoLabel).toBe('add person');
    expect(s.saveState).toBe('pending');
    vi.advanceTimersByTime(600);
    s = useAppStore.getState();
    expect(s.saveState).toBe('saved');
    expect(Object.keys((JSON.parse(localStorage.getItem(KEY.project(p.id))!) as Project).persons)).toHaveLength(2);
    undoLast();
    expect(Object.keys(useAppStore.getState().project!.persons)).toHaveLength(1);
    redoLast();
    expect(Object.keys(useAppStore.getState().project!.persons)).toHaveLength(2);
    expect(useAppStore.getState().ui.changesSinceBackup).toBe(3);
  });

  it('batches nested transacts into one step', () => {
    const { p } = storedProject('B');
    openProject(p.id);
    transact('bulk', () => {
      for (let i = 0; i < 10; i++) transact('inner', (d) => void (d.persons[`p${i}`] = createPerson({ id: `p${i}` })));
    });
    expect(Object.keys(useAppStore.getState().project!.persons)).toHaveLength(11);
    undoLast();
    expect(Object.keys(useAppStore.getState().project!.persons)).toHaveLength(1);
    expect(useAppStore.getState().canUndo).toBe(false);
  });

  it('clears the undo stack when switching projects', () => {
    const { p } = storedProject('A');
    const { p: q } = storedProject('B');
    openProject(p.id);
    transact('x', (d) => void (d.name = 'A2'));
    expect(useAppStore.getState().canUndo).toBe(true);
    openProject(q.id);
    expect(useAppStore.getState().canUndo).toBe(false);
    closeProject();
  });

  it('refuses edits in a read-only tab', () => {
    const { p } = storedProject('L');
    localStorage.setItem(KEY.lock(p.id), JSON.stringify({ tabId: 'other-tab', heartbeat: Date.now() }));
    openProject(p.id);
    expect(useAppStore.getState().lockState).toBe('other');
    expect(transact('x', (d) => void (d.name = 'nope'))).toBe(false);
    expect(useAppStore.getState().project!.name).toBe('L');
  });
});

describe('lock', () => {
  it('first tab owns, second is read-only, stale locks can be taken', () => {
    const events: string[] = [];
    const a = acquireLock('proj', (e) => events.push(`a:${e}`), 'tab-a');
    expect(a.owner).toBe(true);
    const b = acquireLock('proj', (e) => events.push(`b:${e}`), 'tab-b');
    expect(b.owner).toBe(false);
    // stale heartbeat → can be taken
    localStorage.setItem(KEY.lock('proj'), JSON.stringify({ tabId: 'tab-a', heartbeat: Date.now() - STALE_MS - 1 }));
    const c = acquireLock('proj', () => {}, 'tab-c');
    expect(c.owner).toBe(true);
    expect(readLock('proj')?.tabId).toBe('tab-c');
    a.release();
    b.release();
    c.release();
    expect(readLock('proj')).toBeNull();
  });

  it('take over hands the lock to the other tab and the old owner is told', () => {
    const events: string[] = [];
    const a = acquireLock('proj', (e) => events.push(`a:${e}`), 'tab-a');
    const b = acquireLock('proj', (e) => events.push(`b:${e}`), 'tab-b');
    b.takeOver();
    expect(b.owner).toBe(true);
    // The old owner notices through the storage event (dispatched manually: jsdom does not fire it in-document).
    window.dispatchEvent(new StorageEvent('storage', { key: KEY.lock('proj'), newValue: localStorage.getItem(KEY.lock('proj')) }));
    expect(a.owner).toBe(false);
    expect(events).toContain('a:lost');
    a.release();
    b.release();
  });

  it('heartbeat refreshes and detects a takeover between beats', () => {
    vi.useFakeTimers();
    const events: string[] = [];
    const a = acquireLock('proj', (e) => events.push(e), 'tab-a');
    const t0 = readLock('proj')!.heartbeat;
    vi.advanceTimersByTime(5_100);
    expect(readLock('proj')!.heartbeat).toBeGreaterThanOrEqual(t0);
    localStorage.setItem(KEY.lock('proj'), JSON.stringify({ tabId: 'tab-z', heartbeat: Date.now() }));
    vi.advanceTimersByTime(5_100);
    expect(a.owner).toBe(false);
    expect(events).toEqual(['lost']);
    a.release();
  });
});

describe('backup reminder', () => {
  const day = 86_400_000;
  it('is due after 50 changes or after 7 days with at least one change', () => {
    const now = 1_000 * day;
    expect(backupStatus(49, now, 0, now).due).toBe(false);
    expect(backupStatus(50, now, 0, now).due).toBe(true);
    expect(backupStatus(1, now - 7 * day, 0, now).due).toBe(true);
    expect(backupStatus(0, now - 30 * day, 0, now).due).toBe(false);
    expect(backupStatus(1, null, now - 8 * day, now).due).toBe(true);
    expect(backupStatus(3, now - 6 * day, 0, now)).toMatchObject({ due: false, days: 6, changes: 3 });
  });
});

describe('projects', () => {
  it('creates, duplicates, lists, imports and deletes', () => {
    const c = createEmptyProject('Fresh');
    expect(c.ok).toBe(true);
    const id = c.ok ? c.id : '';
    const d = duplicateProject(id);
    expect(d.ok).toBe(true);
    expect(listProjects().map((m) => m.name).sort()).toEqual(['Fresh', 'Fresh (copy)']);
    const text = localStorage.getItem(KEY.project(id))!;
    const imp = importBackupText(text);
    expect(imp.ok).toBe(true);
    expect(listProjects()).toHaveLength(3);
    // imported copy has a fresh id: the original is untouched
    expect(imp.ok && imp.id).not.toBe(id);
    expect(importBackupText('garbage')).toEqual({ ok: false, reason: 'invalid' });
    expect(importBackupText(JSON.stringify({ ...createProject('n'), schemaVersion: 42 }))).toMatchObject({ ok: false, reason: 'newer', fileVersion: 42 });
    deleteProject(id);
    expect(listProjects()).toHaveLength(2);
    expect(localStorage.getItem(KEY.project(id))).toBeNull();
  });

  it('upsertIndex keeps one entry per id', () => {
    const p = createProject('x');
    upsertIndex(metaOf(p));
    upsertIndex(metaOf({ ...p, name: 'y' }));
    expect(readIndex()).toHaveLength(1);
    expect(readIndex()[0]!.name).toBe('y');
  });
});
