/**
 * Entry points of the guided start: create a tree and open the wizard in it, or resume a
 * draft that was left mid-way.
 */
import { t } from '@/i18n';
import { openProject } from '@/store/store';
import { createEmptyProject, listProjects } from '@/store/projects';
import { emptyDraft, loadDraft, saveDraft } from '@/onboarding/wizard';
import { useRouter } from '../router';

/** Creates a new tree named for the user and opens the wizard in it. */
export function startGuided(): boolean {
  const r = createEmptyProject(t('wizard.projectName'));
  if (!r.ok) return false;
  saveDraft(emptyDraft(r.id));
  openProject(r.id);
  useRouter.getState().go('wizard');
  return true;
}

/** Opens the wizard in the currently open tree (help page: "run again"). */
export function startGuidedHere(projectId: string): void {
  const d = loadDraft();
  saveDraft(d && d.projectId === projectId ? d : emptyDraft(projectId));
  useRouter.getState().go('wizard');
}

/** A draft that can still be resumed: its tree must still exist. */
export function resumableDraft(): { projectId: string } | null {
  const d = loadDraft();
  if (!d?.projectId) return null;
  return listProjects().some((p) => p.id === d.projectId) ? { projectId: d.projectId } : null;
}

export function resumeGuided(projectId: string): void {
  openProject(projectId);
  useRouter.getState().go('wizard');
}
