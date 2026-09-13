import type { ReactNode } from 'react';
import { useT } from '@/i18n';
import type { TKey } from '@/i18n';
import { useAppStore } from '@/store/store';
import { useRouter } from '../router';
import type { Mode } from '../router';
import { Banners } from './Banners';
import { PwaNotices } from './PwaNotices';
import { StatusMessages } from '../components/StatusMessages';
import { UndoRedo } from '../edit/UndoRedo';
import { EditorDialogs } from '../edit/EditorDialogs';
import { openEditor } from '../edit/editorStore';
import { Suspense, lazy } from 'react';
import { usePrint } from '../print/printStore';

const PrintDialog = lazy(() => import('../print/PrintDialog').then((m) => ({ default: m.PrintDialog })));

const NAV: { mode: Mode; key: 'nav.tree' | 'nav.list' | 'nav.timeline' | 'nav.statistics' | 'nav.data' }[] = [
  { mode: 'tree', key: 'nav.tree' },
  { mode: 'list', key: 'nav.list' },
  { mode: 'timeline', key: 'nav.timeline' },
  { mode: 'statistics', key: 'nav.statistics' },
  { mode: 'data', key: 'nav.data' },
];

/**
 * The persistent frame: header with the project name, the main area with banners, and the
 * mode navigation (bottom bar on phones, left column on laptops). Navigation items render
 * text and an icon, never an icon alone.
 */
export function AppShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  const { t } = useT();
  const mode = useRouter((s) => s.mode);
  const go = useRouter((s) => s.go);
  const name = useAppStore((s) => s.project?.name ?? '');
  const lockState = useAppStore((s) => s.lockState);
  const warnings = useAppStore((s) => s.warnings.length);
  const printOpen = usePrint((s) => s.open);

  const nav = (
    <nav aria-label={t('nav.mainNavigation')} className="mode-nav">
      <ul>
        {NAV.map((n) => (
          <li key={n.mode}>
            <button type="button" className={`mode-btn${mode === n.mode ? ' mode-btn-active' : ''}`} aria-current={mode === n.mode ? 'page' : undefined} onClick={() => go(n.mode)}>
              <NavIcon mode={n.mode} />
              <span className="nav-long">{t(n.key)}</span>
              <span className="nav-short" aria-hidden="true">
                {t(`nav.short.${n.mode}` as TKey)}
              </span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" className={`mode-btn${mode === 'projects' ? ' mode-btn-active' : ''}`} aria-current={mode === 'projects' ? 'page' : undefined} onClick={() => go('projects')}>
            <NavIcon mode="projects" />
            <span className="nav-long">{t('nav.projects')}</span>
            <span className="nav-short" aria-hidden="true">
              {t('nav.short.projects')}
            </span>
          </button>
        </li>
      </ul>
    </nav>
  );

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        {t('app.skipToContent')}
      </a>
      <header className="shell-header">
        <h1 className="shell-title">
          <span className="shell-app">{t('app.name')}</span>
          {name && (
            <>
              {/* i18n-ignore */}
              <span className="shell-sep" aria-hidden="true">
                ›
              </span>
              <span className="shell-project">{name}</span>
            </>
          )}
        </h1>
        {lockState !== 'owner' && <span className="badge badge-warn">{t('lock.readOnlyBadge')}</span>}
        {warnings > 0 && (
          <button type="button" className="badge badge-btn" onClick={() => openEditor({ kind: 'warnings' })} aria-label={t('warnings.open')}>
            {t('warnings.count', { count: warnings })}
          </button>
        )}
        <button type="button" className={`btn btn-quiet btn-help${mode === 'help' ? ' btn-help-active' : ''}`} aria-current={mode === 'help' ? 'page' : undefined} onClick={() => go('help')}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" />
          </svg>
          <span className="btn-help-text">{t('nav.help')}</span>
        </button>
        <UndoRedo compact />
      </header>
      <EditorDialogs />
      {printOpen && (
        <Suspense fallback={null}>
          <PrintDialog />
        </Suspense>
      )}
      <div className="shell-body">
        <div className="shell-nav">{nav}</div>
        <main id="main" className={`shell-main${mode === 'tree' ? ' shell-main-tree' : ''}`} tabIndex={-1}>
          <PwaNotices />
          <Banners />
          <StatusMessages />
          {children}
        </main>
        {aside && <aside className="shell-aside">{aside}</aside>}
      </div>
    </div>
  );
}

function NavIcon({ mode }: { mode: Mode }) {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (mode) {
    case 'tree':
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <rect x="3" y="17" width="6" height="4" rx="1" />
          <rect x="15" y="17" width="6" height="4" rx="1" />
          <path d="M12 7v5M6 17v-5h12v5" />
        </svg>
      );
    case 'list':
      return (
        <svg {...common}>
          <path d="M4 6h16M8 12h12M12 18h8" />
        </svg>
      );
    case 'timeline':
      return (
        <svg {...common}>
          <path d="M3 7h9M8 12h11M5 17h8" />
        </svg>
      );
    case 'statistics':
      return (
        <svg {...common}>
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </svg>
      );
    case 'data':
      return (
        <svg {...common}>
          <ellipse cx="12" cy="6" rx="8" ry="3" />
          <path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      );
  }
}
