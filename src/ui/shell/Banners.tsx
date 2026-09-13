import { useT } from '@/i18n';
import { useAppStore, takeOverEditing, reloadFromStorage, dismissMigrationNotice, dismissBackupBanner } from '@/store/store';
import { backupStatus } from '@/store/backupReminder';
import { downloadBackup } from '@/store/projects';
import { announce } from '../status';

/** Persistent notices about the open project: lock state, migration, storage, backup reminder. */
export function Banners() {
  const { t } = useT();
  const lockState = useAppStore((s) => s.lockState);
  const newer = useAppStore((s) => s.newerStateAvailable);
  const migration = useAppStore((s) => s.migrationNotice);
  const saveState = useAppStore((s) => s.saveState);
  const near = useAppStore((s) => s.storageNearLimit);
  const ui = useAppStore((s) => s.ui);
  const project = useAppStore((s) => s.project);
  if (!project) return null;

  const backup = backupStatus(ui.changesSinceBackup, ui.lastBackupAt, project.createdAt);
  const showBackup = backup.due && (ui.backupBannerDismissedAt === null || (ui.lastBackupAt !== null && ui.backupBannerDismissedAt < ui.lastBackupAt));
  const backupText = backup.byChanges && backup.byDays
    ? t('data.backupReminderBanner', { changes: t('common.changes', { count: backup.changes }), days: t('common.days', { count: backup.days }) })
    : backup.byChanges
      ? t('data.backupReminderBannerChanges', { changes: t('common.changes', { count: backup.changes }) })
      : t('data.backupReminderBannerDays', { days: t('common.days', { count: backup.days }) });

  return (
    <div className="banners">
      {lockState === 'other' && (
        <section className="notice notice-warn" aria-labelledby="lock-title">
          <p className="notice-title" id="lock-title">
            {t('lock.readOnly')}
          </p>
          <p>{t('lock.otherTabHasIt')}</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={takeOverEditing}>
              {t('lock.takeOver')}
            </button>
            {newer && (
              <button type="button" className="btn" onClick={reloadFromStorage}>
                {t('lock.reload')}
              </button>
            )}
          </div>
        </section>
      )}
      {lockState === 'lost' && (
        <section className="notice notice-warn" aria-labelledby="lost-title">
          <p className="notice-title" id="lost-title">
            {t('lock.readOnly')}
          </p>
          <p>{t('lock.lostLock')}</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={reloadFromStorage}>
              {t('lock.reload')}
            </button>
            <button type="button" className="btn" onClick={takeOverEditing}>
              {t('lock.takeOver')}
            </button>
          </div>
        </section>
      )}
      {migration && (
        <section className="notice notice-info">
          <p>{t('migration.updated')}</p>
          {migration.changes.length > 0 && (
            <ul>
              {migration.changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
          <div className="btn-row btn-row-end">
            <button type="button" className="btn btn-quiet" onClick={dismissMigrationNotice}>
              {t('common.dismiss')}
            </button>
          </div>
        </section>
      )}
      {saveState === 'quota' && (
        <section className="notice notice-danger">
          <p>{t('data.storageFull')}</p>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={() => saveAndAnnounce(t)}>
              {t('data.saveBackup')}
            </button>
          </div>
        </section>
      )}
      {saveState !== 'quota' && near && (
        <section className="notice notice-warn">
          <p>{t('data.storageNearLimit')}</p>
        </section>
      )}
      {showBackup && (
        <section className="notice notice-warn" aria-labelledby="backup-title">
          <p className="notice-title" id="backup-title">
            {t('data.backupDue')}
          </p>
          <p>{backupText}</p>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={() => saveAndAnnounce(t)}>
              {t('data.saveBackup')}
            </button>
            <button type="button" className="btn btn-quiet" onClick={dismissBackupBanner}>
              {t('common.dismiss')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export function saveAndAnnounce(t: (k: 'data.backupSaved', p: { file: string }) => string): void {
  const name = downloadBackup();
  if (name) announce(t('data.backupSaved', { file: name }));
}
