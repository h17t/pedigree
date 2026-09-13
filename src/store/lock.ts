/**
 * Multi-tab edit lock. The first tab that opens a project writes a lock with its tab id and
 * refreshes a heartbeat every 5 s. Another tab seeing a fresh lock opens read-only. A lock
 * whose heartbeat is older than 15 s is stale (closed or crashed tab) and can be taken.
 * "Take over" simply writes the lock with the new tab id; the previous owner notices via
 * the `storage` event and drops to read-only.
 */
import { KEY, getItem, removeItem, setItem } from './storage';

export const HEARTBEAT_MS = 5_000;
export const STALE_MS = 15_000;

export interface LockRecord {
  tabId: string;
  heartbeat: number;
}

export const tabId: string = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random());

export function readLock(projectId: string): LockRecord | null {
  const raw = getItem(KEY.lock(projectId));
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as LockRecord;
    return typeof v.tabId === 'string' && typeof v.heartbeat === 'number' ? v : null;
  } catch {
    return null;
  }
}

export function isFresh(lock: LockRecord | null, now = Date.now()): boolean {
  return !!lock && now - lock.heartbeat < STALE_MS;
}

function write(projectId: string, id: string): void {
  setItem(KEY.lock(projectId), JSON.stringify({ tabId: id, heartbeat: Date.now() } satisfies LockRecord));
}

export type LockEvent = 'lost' | 'released';

export interface LockHandle {
  /** true when this tab owns the lock. */
  owner: boolean;
  takeOver: () => void;
  release: () => void;
}

/**
 * Try to acquire the lock for a project. `onEvent('lost')` fires when another tab takes
 * the lock away; `onEvent('released')` when the owner releases it (so a read-only tab can
 * offer to take over without waiting for staleness).
 */
export function acquireLock(projectId: string, onEvent: (e: LockEvent) => void, id = tabId): LockHandle {
  let owner = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const startHeartbeat = () => {
    stopHeartbeat();
    timer = setInterval(() => {
      const current = readLock(projectId);
      if (current && current.tabId !== id && isFresh(current)) {
        // Someone else took over between beats.
        owner = false;
        stopHeartbeat();
        onEvent('lost');
        return;
      }
      write(projectId, id);
    }, HEARTBEAT_MS);
  };
  const stopHeartbeat = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  const existing = readLock(projectId);
  if (!existing || existing.tabId === id || !isFresh(existing)) {
    write(projectId, id);
    owner = true;
    startHeartbeat();
  }

  const onStorage = (ev: StorageEvent) => {
    if (ev.key !== KEY.lock(projectId)) return;
    const current = readLock(projectId);
    if (owner && current && current.tabId !== id) {
      owner = false;
      stopHeartbeat();
      onEvent('lost');
    } else if (!owner && (!current || !isFresh(current))) {
      onEvent('released');
    }
  };
  const onPageHide = () => handle.release();
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
    window.addEventListener('pagehide', onPageHide);
  }

  const handle: LockHandle = {
    get owner() {
      return owner;
    },
    takeOver() {
      write(projectId, id);
      owner = true;
      startHeartbeat();
    },
    release() {
      stopHeartbeat();
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener('pagehide', onPageHide);
      }
      if (owner) {
        const current = readLock(projectId);
        if (current?.tabId === id) removeItem(KEY.lock(projectId));
      }
      owner = false;
    },
  };
  return handle;
}
