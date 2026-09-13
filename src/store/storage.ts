/**
 * Thin wrapper over localStorage with the app's key layout. Everything that touches the
 * browser's storage goes through here so the tests can inspect and simulate failures.
 */
export const KEY = {
  index: 'pedigree:index',
  settings: 'pedigree:settings',
  project: (id: string) => `pedigree:project:${id}`,
  ui: (id: string) => `pedigree:ui:${id}`,
  lock: (id: string) => `pedigree:lock:${id}`,
  recovery: (id: string, ts: number) => `pedigree:recovery:${id}:${ts}`,
  migrationBackup: (id: string, v: number) => `pedigree:migration-backup:${id}:${v}`,
  probe: 'pedigree:probe',
} as const;

export const PREFIX = 'pedigree:';

export function getItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export type WriteResult = { ok: true } | { ok: false; reason: 'quota' | 'other'; error: unknown };

/** setItem is atomic in every browser: on failure the previous value is untouched. */
export function setItem(key: string, value: string): WriteResult {
  try {
    localStorage.setItem(key, value);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: isQuotaError(error) ? 'quota' : 'other', error };
  }
}

export function removeItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function isQuotaError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const err = e as { name?: unknown; code?: unknown };
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22 ||
    err.code === 1014
  );
}

/** All keys belonging to this app. */
export function appKeys(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) out.push(k);
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** Bytes used by this app (localStorage stores UTF-16, so 2 bytes per code unit). */
export function usedBytes(): number {
  let n = 0;
  for (const k of appKeys()) n += (k.length + (getItem(k)?.length ?? 0)) * 2;
  return n;
}

export function readJson<T = unknown>(key: string): { ok: true; value: T; raw: string } | { ok: false; raw: string | null } {
  const raw = getItem(key);
  if (raw === null) return { ok: false, raw: null };
  try {
    return { ok: true, value: JSON.parse(raw) as T, raw };
  } catch {
    return { ok: false, raw };
  }
}

/**
 * Measure the storage capacity once by writing growing probe values. Result is cached in
 * settings. Returns bytes. Falls back to 5 MB when probing is not possible.
 */
export function probeCapacity(): number {
  const DEFAULT = 5 * 1024 * 1024;
  try {
    const used = usedBytes();
    // Everything not ours also counts against the same origin quota.
    let otherBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (!k.startsWith(PREFIX)) otherBytes += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2;
    }
    let lo = 0;
    let hi = 16 * 1024 * 1024; // code units
    const chunk = 'x'.repeat(64 * 1024);
    // Binary search on the largest writable probe (in code units).
    for (let iter = 0; iter < 10 && hi - lo > 64 * 1024; iter++) {
      const mid = Math.floor((lo + hi) / 2);
      const value = chunk.repeat(Math.ceil(mid / chunk.length)).slice(0, mid);
      try {
        localStorage.setItem(KEY.probe, value);
        lo = mid;
      } catch {
        hi = mid;
      }
    }
    localStorage.removeItem(KEY.probe);
    if (lo === 0) return DEFAULT;
    return lo * 2 + used + otherBytes;
  } catch {
    return DEFAULT;
  }
}
