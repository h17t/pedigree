/**
 * Contextual hints: short, dismissible, attached to a control, at most one visible at a time,
 * and remembered once dismissed. The "next action" after the wizard is a hint too.
 */
import { create } from 'zustand';
import { KEY_HINTS } from './keys';

export type HintId = 'addGrandparents' | 'selectCard' | 'arrangeTree' | 'backupSoon' | 'listView';

interface HintState {
  dismissed: HintId[];
  /** The hint currently offered (only one at a time). */
  active: HintId | null;
  offer: (id: HintId) => void;
  dismiss: (id: HintId) => void;
  reset: () => void;
}

function load(): HintId[] {
  try {
    const raw = localStorage.getItem(KEY_HINTS);
    return raw ? (JSON.parse(raw) as HintId[]) : [];
  } catch {
    return [];
  }
}
function save(ids: HintId[]) {
  try {
    localStorage.setItem(KEY_HINTS, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export const useHints = create<HintState>((set, get) => ({
  dismissed: load(),
  active: null,
  offer: (id) => {
    const s = get();
    if (s.dismissed.includes(id) || s.active === id) return;
    if (s.active !== null) return; // one at a time
    set({ active: id });
  },
  dismiss: (id) => {
    const dismissed = [...new Set([...get().dismissed, id])];
    save(dismissed);
    set({ dismissed, active: get().active === id ? null : get().active });
  },
  reset: () => {
    save([]);
    set({ dismissed: [], active: null });
  },
}));
