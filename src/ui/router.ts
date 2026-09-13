/**
 * Minimal hash "router": the current mode is mirrored to the URL hash so the browser back
 * button and bookmarks work. No library needed for a handful of modes.
 */
import { create } from 'zustand';

export type Mode = 'projects' | 'tree' | 'list' | 'timeline' | 'statistics' | 'data' | 'wizard' | 'help';
const MODES: Mode[] = ['projects', 'tree', 'list', 'timeline', 'statistics', 'data', 'wizard', 'help'];

function fromHash(hash: string): Mode | null {
  const m = hash.replace(/^#\/?/, '').split(/[/?]/)[0] as Mode;
  return MODES.includes(m) ? m : null;
}

interface RouterState {
  mode: Mode;
  go: (mode: Mode) => void;
}

export const useRouter = create<RouterState>((set) => ({
  mode: (typeof location !== 'undefined' && fromHash(location.hash)) || 'tree',
  go: (mode) => {
    set({ mode });
    if (typeof location !== 'undefined' && location.hash !== `#/${mode}`) history.pushState(null, '', `#/${mode}`);
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const m = fromHash(location.hash);
    if (m) useRouter.setState({ mode: m });
  });
}
