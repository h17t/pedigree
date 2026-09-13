import { useId, useState } from 'react';
import { useT, formatDateTime } from '@/i18n';
import type { ProjectMeta } from '@/model/types';
import { useAppStore, openProject } from '@/store/store';
import { createEmptyProject, deleteProject, duplicateProject, importBackupText, listProjects, loadSampleProject, renameProject } from '@/store/projects';
import { Dialog } from './components/Dialog';
import { FilePicker } from './components/FilePicker';
import { announce } from './status';
import { useRouter } from './router';

/**
 * The list of family trees on this device with the three ways to start (empty, sample,
 * backup). Deleting asks for confirmation and states what is lost. Loading the sample or a
 * backup always creates a new tree; nothing is ever overwritten.
 */
export function ProjectsView() {
  const { t, locale } = useT();
  const go = useRouter((s) => s.go);
  const currentId = useAppStore((s) => s.projectId);
  const [projects, setProjects] = useState<ProjectMeta[]>(listProjects);
  const [renaming, setRenaming] = useState<ProjectMeta | null>(null);
  const [deleting, setDeleting] = useState<ProjectMeta | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = () => setProjects(listProjects());
  const descId = useId();

  const open = (id: string) => {
    openProject(id);
    go('tree');
  };
  const storageFailed = () => announce(t('data.storageFull'), 'danger');

  const onStartEmpty = () => {
    const r = createEmptyProject();
    if (r.ok) open(r.id);
    else storageFailed();
  };
  const onSample = () => {
    setBusy(true);
    void loadSampleProject()
      .then((r) => {
        if (r.ok) open(r.id);
        else storageFailed();
      })
      .catch(() => storageFailed())
      .finally(() => setBusy(false));
  };
  const onBackup = (text: string) => {
    const r = importBackupText(text);
    if (r.ok) {
      announce(t('data.backupLoaded', { name: r.name }));
      if (r.migrated) announce(t('data.backupMigrated'));
      open(r.id);
    } else if (r.reason === 'newer') announce(t('data.backupNewer', { fileVersion: r.fileVersion ?? 0, appVersion: 1 }), 'danger');
    else if (r.reason === 'invalid') announce(t('data.backupInvalid'), 'danger');
    else storageFailed();
  };

  return (
    <div className="page">
      <div className="stack-tight">
        <h1>{t('projects.title')}</h1>
        <p className="muted">{t('app.privacyNote')}</p>
      </div>

      {projects.length === 0 && <p>{t('projects.empty')}</p>}

      <div className="start-cards">
        <div className="start-card">
          <button type="button" className="btn btn-primary btn-block" onClick={onStartEmpty}>
            {t('projects.startEmpty')}
          </button>
          <p className="hint">{t('projects.startEmptyHint')}</p>
        </div>
        <div className="start-card">
          <button type="button" className="btn btn-block" onClick={onSample} disabled={busy}>
            {t('projects.loadSample')}
          </button>
          <p className="hint">{t('projects.loadSampleHint')}</p>
        </div>
        <div className="start-card">
          <FilePicker label={t('projects.restoreBackup')} hint={t('projects.restoreBackupHint')} onText={onBackup} />
        </div>
      </div>

      {projects.length > 0 && (
        <section aria-label={t('projects.list')} className="stack-tight">
          <ul className="project-list">
            {projects.map((p) => (
              <li key={p.id} className="project-row panel">
                <div className="project-row-main">
                  <button type="button" className="link-btn project-name" onClick={() => open(p.id)} aria-label={t('projects.openAria', { name: p.name })}>
                    {p.name}
                  </button>
                  <p className="hint tnum">
                    {t('common.people', { count: p.personCount })} · {t('common.lastChanged', { date: formatDateTime(locale, p.modifiedAt) })}
                    {p.id === currentId ? ` · ${t('projects.current')}` : ''}
                  </p>
                </div>
                <div className="btn-row">
                  <button type="button" className="btn" onClick={() => open(p.id)}>
                    {t('common.open')}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setName(p.name);
                      setRenaming(p);
                    }}
                  >
                    {t('common.rename')}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const r = duplicateProject(p.id);
                      if (!r.ok) storageFailed();
                      refresh();
                    }}
                  >
                    {t('common.duplicate')}
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => setDeleting(p)}>
                    {t('common.delete')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="hint">{t('app.privacyLong')}</p>

      <Dialog open={renaming !== null} title={t('projects.renameTitle')} onClose={() => setRenaming(null)}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (renaming && name.trim()) {
              renameProject(renaming.id, name.trim());
              refresh();
            }
            setRenaming(null);
          }}
        >
          <div className="field">
            <label htmlFor="rename-input">{t('projects.renameLabel')}</label>
            <input id="rename-input" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="btn-row btn-row-end">
            <button type="button" className="btn" onClick={() => setRenaming(null)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary">
              {t('common.save')}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog open={deleting !== null} title={t('projects.deleteTitle')} onClose={() => setDeleting(null)} describedBy={descId}>
        {deleting && (
          <div className="stack">
            <p id={descId}>{t('projects.deleteBody', { name: deleting.name, people: t('common.people', { count: deleting.personCount }) })}</p>
            <div className="btn-row btn-row-end">
              <button type="button" className="btn" onClick={() => setDeleting(null)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  deleteProject(deleting.id);
                  announce(t('projects.deleted', { name: deleting.name }));
                  setDeleting(null);
                  refresh();
                }}
              >
                {t('projects.deleteConfirm')}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
