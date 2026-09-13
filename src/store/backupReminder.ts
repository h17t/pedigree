/** Backup reminder rule: 50 changes or 7 days since the last backup, whichever comes first. */
export const BACKUP_CHANGES_LIMIT = 50;
export const BACKUP_DAYS_LIMIT = 7;
const DAY_MS = 86_400_000;

export interface BackupStatus {
  due: boolean;
  byChanges: boolean;
  byDays: boolean;
  changes: number;
  days: number;
}

export function backupStatus(changesSinceBackup: number, lastBackupAt: number | null, createdAt: number, now = Date.now()): BackupStatus {
  const since = lastBackupAt ?? createdAt;
  const days = Math.floor(Math.max(0, now - since) / DAY_MS);
  const byChanges = changesSinceBackup >= BACKUP_CHANGES_LIMIT;
  const byDays = days >= BACKUP_DAYS_LIMIT && changesSinceBackup > 0;
  return { due: byChanges || byDays, byChanges, byDays, changes: changesSinceBackup, days };
}
