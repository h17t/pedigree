import { useT } from '@/i18n';
import { useAppStore } from '@/store/store';
import { createEmptyProject, downloadText, importBackupText, listProjects } from '@/store/projects';
import { FilePicker } from './components/FilePicker';
import { announce } from './status';
import { useRouter } from './router';
import { openProject } from '@/store/store';
import { SCHEMA_VERSION } from '@/model/types';

/**
 * Shown when the stored data for a project cannot be read (corrupt) or comes from a newer
 * version. Never overwrites; offers the raw download, a backup file, or a fresh start.
 */
export function RecoveryView() {
  const { t } = useT();
  const go = useRouter((s) => s.go);
  const status = useAppStore((s) => s.status);
  const raw = useAppStore((s) => s.corruptRaw);
  const projectId = useAppStore((s) => s.projectId);
  const newerVersion = useAppStore((s) => s.newerVersion);
  const meta = listProjects().find((m) => m.id === projectId);

  const onBackup = (text: string) => {
    const r = importBackupText(text);
    if (r.ok) {
      openProject(r.id);
      go('list');
    } else announce(r.reason === 'invalid' ? t('data.backupInvalid') : r.reason === 'newer' ? t('data.backupNewer', { fileVersion: r.fileVersion ?? 0, appVersion: SCHEMA_VERSION }) : t('data.storageFull'), 'danger');
  };

  if (status === 'newer') {
    return (
      <div className="page">
        <section className="notice notice-warn stack-tight">
          <h1>{t('recovery.title')}</h1>
          <p>{t('migration.newer', { fileVersion: newerVersion ?? 0, appVersion: SCHEMA_VERSION })}</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => go('projects')}>
              {t('nav.projects')}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="notice notice-danger stack-tight">
        <h1>{t('recovery.title')}</h1>
        <p>{meta ? t('recovery.body', { name: meta.name }) : t('recovery.bodyUnnamed')}</p>
      </section>
      <div className="btn-row">
        <button type="button" className="btn btn-primary" onClick={() => raw && downloadText(raw, `pedigree-raw-${projectId ?? 'data'}.txt`)} disabled={!raw}>
          {t('recovery.download')}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            const r = createEmptyProject();
            if (r.ok) {
              announce(t('recovery.startedFresh'));
              openProject(r.id);
              go('list');
            } else announce(t('data.storageFull'), 'danger');
          }}
        >
          {t('recovery.startFresh')}
        </button>
      </div>
      <FilePicker label={t('data.loadBackup')} hint={t('data.loadBackupHint')} onText={onBackup} />
      <div className="btn-row">
        <button type="button" className="btn btn-quiet" onClick={() => go('projects')}>
          {t('nav.projects')}
        </button>
      </div>
    </div>
  );
}
