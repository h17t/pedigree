import { useT } from '@/i18n';
import type { TKey } from '@/i18n';
import { useAppStore } from '@/store/store';
import { useHints } from '@/onboarding/hints';
import { startGuided, startGuidedHere } from '../onboarding/start';
import { announce } from '../status';
import { useRouter } from '../router';
import './help.css';

const SECTIONS: { id: 'people' | 'lines' | 'dates' | 'backup' | 'print' | 'install' | 'keys'; paragraphs: number }[] = [
  { id: 'people', paragraphs: 4 },
  { id: 'lines', paragraphs: 3 },
  { id: 'dates', paragraphs: 3 },
  { id: 'backup', paragraphs: 4 },
  { id: 'print', paragraphs: 4 },
  { id: 'install', paragraphs: 3 },
  { id: 'keys', paragraphs: 3 },
];
const QUICK_STEPS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/**
 * The help page: a printable one-page quick start followed by short sections. Also the place
 * to run the guided start again and to bring the tips back.
 */
export function HelpView() {
  const { t } = useT();
  const go = useRouter((s) => s.go);
  const projectId = useAppStore((s) => s.projectId);
  const status = useAppStore((s) => s.status);
  const readOnly = useAppStore((s) => s.lockState !== 'owner');
  const hasProject = status === 'ready' && projectId !== null;

  const printQuickStart = () => {
    document.body.classList.add('printing-help');
    const done = () => {
      document.body.classList.remove('printing-help');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
  };

  return (
    <div className="page help">
      <div className="stack-tight help-head">
        <h1>{t('help.title')}</h1>
        <p className="muted">{t('help.intro')}</p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => go(hasProject ? 'tree' : 'projects')}>
            {hasProject ? t('help.back') : t('help.backToProjects')}
          </button>
        </div>
      </div>

      <section className="panel section quick-start" aria-labelledby="help-quick">
        <div className="quick-start-head">
          <h2 id="help-quick">{t('help.quick.title')}</h2>
          <button type="button" className="btn no-print" onClick={printQuickStart}>
            {t('help.quick.print')}
          </button>
        </div>
        <p className="muted">{t('help.quick.lead')}</p>
        <ol className="quick-steps">
          {QUICK_STEPS.map((n) => (
            <li key={n}>{t(`help.quick.s${n}` as TKey)}</li>
          ))}
        </ol>
        <p className="hint quick-start-foot">{t('app.privacyNote')}</p>
      </section>

      <div className="help-sections">
        {SECTIONS.map((s) => (
          <section key={s.id} className="stack-tight" aria-labelledby={`help-${s.id}`}>
            <h2 id={`help-${s.id}`}>{t(`help.sections.${s.id}.title` as TKey)}</h2>
            {Array.from({ length: s.paragraphs }, (_, i) => (
              <p key={i}>{t(`help.sections.${s.id}.p${i + 1}` as TKey)}</p>
            ))}
          </section>
        ))}

        <section className="stack-tight" aria-labelledby="help-again">
          <h2 id="help-again">{t('help.againTitle')}</h2>
          <div className="btn-row">
            <button
              type="button"
              className="btn"
              disabled={hasProject && readOnly}
              onClick={() => {
                if (hasProject && projectId) startGuidedHere(projectId);
                else if (!startGuided()) announce(t('data.storageFull'), 'danger');
              }}
            >
              {t('help.again')}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                useHints.getState().reset();
                announce(t('help.hintsReset'));
              }}
            >
              {t('help.resetHints')}
            </button>
          </div>
          <p className="hint">{t('help.againHint')}</p>
        </section>
      </div>
    </div>
  );
}
