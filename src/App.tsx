import { useEffect } from 'react';
import { useAppStore, openProject, updateUi } from '@/store/store';
import { useSettings } from '@/store/settings';
import { useRouter } from './ui/router';
import { AppShell } from './ui/shell/AppShell';
import { ProjectsView } from './ui/ProjectsView';
import { RecoveryView } from './ui/RecoveryView';
import { ListView } from './ui/list/ListView';
import { TreeView } from './ui/tree/TreeView';
import { DataView } from './ui/data/DataView';
import { StatusMessages } from './ui/components/StatusMessages';
import { listProjects } from './store/projects';
import { useT } from '@/i18n';

/**
 * Top-level switch. A returning user lands on the project they last had open, in the mode
 * they left; when no project exists, the project list is shown (the designed first-run
 * experience arrives in stage h).
 */
export default function App() {
  const status = useAppStore((s) => s.status);
  const mode = useRouter((s) => s.mode);
  const go = useRouter((s) => s.go);
  const lastOpen = useSettings((s) => s.lastOpenProjectId);
  const { t } = useT();

  // Restore the last open project once at startup.
  useEffect(() => {
    if (status !== 'idle') return;
    const projects = listProjects();
    const target = lastOpen && projects.some((p) => p.id === lastOpen) ? lastOpen : null;
    if (target) {
      const r = openProject(target);
      if (r === 'ready' && mode === 'projects') go((useAppStore.getState().ui.mode as 'tree' | 'list' | 'data') || 'tree');
      if (r === 'ready' && location.hash === '') go((useAppStore.getState().ui.mode as 'tree' | 'list' | 'data') || 'tree');
    } else if (mode !== 'projects') {
      go('projects');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = t('app.name');
  }, [t]);

  // Remember the mode per project.
  useEffect(() => {
    if (status === 'ready' && mode !== 'projects') updateUi({ mode });
  }, [mode, status]);

  if (mode === 'projects' || status === 'idle' || status === 'missing') {
    return (
      <div className="shell shell-plain">
        <main id="main" className="shell-main" tabIndex={-1}>
          <StatusMessages />
          <ProjectsView />
        </main>
      </div>
    );
  }
  if (status === 'corrupt' || status === 'newer') {
    return (
      <div className="shell shell-plain">
        <main id="main" className="shell-main" tabIndex={-1}>
          <StatusMessages />
          <RecoveryView />
        </main>
      </div>
    );
  }
  return <AppShell>{mode === 'data' ? <DataView /> : mode === 'list' ? <ListView /> : <TreeView />}</AppShell>;
}
