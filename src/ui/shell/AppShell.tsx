import type { ReactNode } from 'react';
import { useT } from '@/i18n';
import { useAppStore } from '@/store/store';
import { useRouter } from '../router';
import type { Mode } from '../router';
import { Banners } from './Banners';
import { StatusMessages } from '../components/StatusMessages';

const NAV: { mode: Mode; key: 'nav.tree' | 'nav.list' | 'nav.data' }[] = [
  { mode: 'tree', key: 'nav.tree' },
  { mode: 'list', key: 'nav.list' },
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

  const nav = (
    <nav aria-label={t('nav.mainNavigation')} className="mode-nav">
      <ul>
        {NAV.map((n) => (
          <li key={n.mode}>
            <button type="button" className={`mode-btn${mode === n.mode ? ' mode-btn-active' : ''}`} aria-current={mode === n.mode ? 'page' : undefined} onClick={() => go(n.mode)}>
              <NavIcon mode={n.mode} />
              <span>{t(n.key)}</span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" className={`mode-btn${mode === 'projects' ? ' mode-btn-active' : ''}`} aria-current={mode === 'projects' ? 'page' : undefined} onClick={() => go('projects')}>
            <NavIcon mode="projects" />
            <span>{t('nav.projects')}</span>
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
        {warnings > 0 && <span className="badge">{t('warnings.count', { count: warnings })}</span>}
      </header>
      <div className="shell-body">
        <div className="shell-nav">{nav}</div>
        <main id="main" className={`shell-main${mode === 'tree' ? ' shell-main-tree' : ''}`} tabIndex={-1}>
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
