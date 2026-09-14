import { useEffect, useState } from 'react';
import { useT, formatBytes, formatDateTime, formatNumber, LANGUAGES } from '@/i18n';
import type { Locale, DateFormat, TKey } from '@/i18n';
import type { Theme } from '@/design/tokens';
import { useAppStore } from '@/store/store';
import { useSettings, setLocale } from '@/store/settings';
import type { NameOrder } from '@/store/settings';
import { storageSummary, listRecoveryKeys } from '@/store/persistence';
import { probeCapacity, removeItem } from '@/store/storage';
import { backupStatus } from '@/store/backupReminder';
import { downloadBackup, importBackupText, downloadText } from '@/store/projects';
import { openProject } from '@/store/store';
import { FilePicker } from '../components/FilePicker';
import { DuplicatesPanel } from '../edit/DuplicatesPanel';
import { GedcomPanel } from './GedcomPanel';
import { InstallPanel } from './InstallPanel';
import { GroupsPanel } from './GroupsPanel';
import { announce } from '../status';
import { useRouter } from '../router';
import { SCHEMA_VERSION } from '@/model/types';
import { getItem } from '@/store/storage';

/** Data view: this tree, backup, storage on this device, settings, about. */
export function DataView() {
  const { t, locale } = useT();
  const go = useRouter((s) => s.go);
  const project = useAppStore((s) => s.project);
  const ui = useAppStore((s) => s.ui);
  const lastSavedAt = useAppStore((s) => s.lastSavedAt);
  const saveState = useAppStore((s) => s.saveState);
  const settings = useSettings();
  const capacity = settings.storageCapacity;
  const update = settings.update;
  const [recovery, setRecovery] = useState(listRecoveryKeys);

  // Measure capacity once, lazily. The usage figure is cheap to compute, so it is read on
  // every render and therefore always current after a save.
  useEffect(() => {
    if (capacity === null) update({ storageCapacity: probeCapacity() });
  }, [capacity, update]);
  const summary = storageSummary(capacity);

  if (!project) return null;
  const backup = backupStatus(ui.changesSinceBackup, ui.lastBackupAt, project.createdAt);

  const onSave = () => {
    const file = downloadBackup();
    if (file) announce(t('data.backupSaved', { file }));
  };
  const onLoad = (text: string) => {
    const r = importBackupText(text);
    if (r.ok) {
      announce(t('data.backupLoaded', { name: r.name }));
      openProject(r.id);
      go('tree');
    } else if (r.reason === 'newer') announce(t('data.backupNewer', { fileVersion: r.fileVersion ?? 0, appVersion: SCHEMA_VERSION }), 'danger');
    else if (r.reason === 'invalid') announce(t('data.backupInvalid'), 'danger');
    else announce(t('data.storageFull'), 'danger');
  };

  return (
    <div className="page">
      <h2>{t('data.title')}</h2>

      <section className="panel section" aria-labelledby="sec-tree">
        <h3 id="sec-tree">{t('data.thisTree')}</h3>
        <dl className="detail-list">
          <div className="detail-field">
            <dt>{t('data.treeName')}</dt>
            <dd>{project.name}</dd>
          </div>
          <div className="detail-field">
            <dt>{t('data.peopleCount')}</dt>
            <dd className="tnum">{formatNumber(locale, Object.keys(project.persons).length)}</dd>
          </div>
          <div className="detail-field">
            <dt>{t('data.unionsCount')}</dt>
            <dd className="tnum">{formatNumber(locale, Object.keys(project.unions).length)}</dd>
          </div>
          <div className="detail-field">
            <dt>{t('data.lastSaved')}</dt>
            <dd className="tnum">{saveState === 'saved' && lastSavedAt ? formatDateTime(locale, lastSavedAt) : saveState === 'pending' ? t('app.loading') : t('data.storageFull')}</dd>
          </div>
        </dl>
      </section>

      <section className="panel section" aria-labelledby="sec-backup">
        <h3 id="sec-backup">{t('data.backup')}</h3>
        <p>{t('data.backupIntro')}</p>
        <p className={`backup-marker${backup.due ? ' backup-marker-due' : ''}`} aria-live="polite">
          <span>{ui.lastBackupAt ? t('data.lastBackup', { when: formatDateTime(locale, ui.lastBackupAt) }) : t('data.lastBackupNever')}</span>
          {' · '}
          <span>{t('data.changesSinceBackup', { changes: t('common.changes', { count: ui.changesSinceBackup }) })}</span>
          {backup.due && <strong> {t('data.backupDue')}</strong>}
        </p>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={onSave}>
            {t('data.saveBackup')}
          </button>
        </div>
        <FilePicker label={t('data.loadBackup')} hint={t('data.loadBackupHint')} onText={onLoad} />
      </section>

      <section className="panel section" aria-labelledby="sec-storage">
        <h3 id="sec-storage">{t('data.storage')}</h3>
        <p className="tnum">{t('data.storageUsage', { used: formatBytes(locale, summary.used), total: formatBytes(locale, summary.capacity) })}</p>
        <div className="meter" role="img" aria-label={t('data.storageUsage', { used: formatBytes(locale, summary.used), total: formatBytes(locale, summary.capacity) })}>
          <div className={`meter-fill${summary.fraction >= 0.8 ? ' meter-fill-warn' : ''}`} style={{ width: `${Math.min(100, Math.round(summary.fraction * 100))}%` }} />
        </div>
        <p className="hint">{t('data.storageHint')}</p>
        {recovery.length > 0 && (
          <div className="stack-tight">
            <p className="field-label">{t('recovery.recoveryFiles')}</p>
            <ul className="link-list">
              {recovery.map((r) => (
                <li key={r.key} className="btn-row">
                  <span className="tnum">
                    {formatDateTime(locale, r.timestamp)} · {formatBytes(locale, r.bytes)}
                  </span>
                  <button type="button" className="btn" onClick={() => downloadText(getItem(r.key) ?? '', `pedigree-raw-${r.timestamp}.txt`)}>
                    {t('recovery.download')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      removeItem(r.key);
                      setRecovery(listRecoveryKeys());
                    }}
                  >
                    {t('recovery.discard')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <GedcomPanel />

      <GroupsPanel />

      <DuplicatesPanel />

      <section className="panel section" aria-labelledby="sec-settings">
        <h3 id="sec-settings">{t('data.settings')}</h3>
        <div className="field">
          <label htmlFor="language-select">{t('data.language')}</label>
          <select id="language-select" className="select" value={settings.locale} onChange={(e) => setLocale(e.target.value as Locale)}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} lang={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="nameorder-select">{t('data.nameOrder')}</label>
          <select id="nameorder-select" className="select" value={settings.nameOrder} onChange={(e) => settings.update({ nameOrder: e.target.value as NameOrder })} aria-describedby="nameorder-hint">
            {(['auto', 'givenFirst', 'surnameFirst'] as NameOrder[]).map((v) => (
              <option key={v} value={v}>
                {t(`data.nameOrderValue.${v}` as TKey)}
              </option>
            ))}
          </select>
          <p className="hint" id="nameorder-hint">
            {t('data.nameOrderHint')}
          </p>
        </div>
        <div className="field">
          <label htmlFor="dateformat-select">{t('dates.formatSetting')}</label>
          <select id="dateformat-select" className="select" value={settings.dateFormat} onChange={(e) => settings.update({ dateFormat: e.target.value as DateFormat })} aria-describedby="dateformat-hint">
            <option value="dayFirst">{t('dates.format.dayFirst')}</option>
            <option value="monthFirst">{t('dates.format.monthFirst')}</option>
          </select>
          <p className="hint" id="dateformat-hint">
            {t('dates.formatHint')}
          </p>
        </div>
        <div className="field">
          <label htmlFor="theme-select">{t('data.theme')}</label>
          <select id="theme-select" className="select" value={settings.theme} onChange={(e) => settings.update({ theme: e.target.value as Theme })} aria-describedby="theme-hint">
            {(['system', 'light', 'dark'] as Theme[]).map((v) => (
              <option key={v} value={v}>
                {t(`data.themeValue.${v}` as TKey)}
              </option>
            ))}
          </select>
          <p className="hint" id="theme-hint">
            {t('data.themeHint')}
          </p>
        </div>
      </section>

      <section className="panel section" aria-labelledby="sec-projects">
        <h3 id="sec-projects">{t('data.projects')}</h3>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => go('projects')}>
            {t('data.manageProjects')}
          </button>
        </div>
      </section>

      <InstallPanel />

      <section className="panel section" aria-labelledby="sec-about">
        <h3 id="sec-about">{t('data.about')}</h3>
        <p>{t('data.aboutText')}</p>
        <p className="hint">{t('app.privacyLong')}</p>
        <p className="hint">{t('common.version', { version: __APP_VERSION__ })}</p>
      </section>
    </div>
  );
}
