/**
 * Install and update state of the app as an installable, offline-capable page. Nothing here
 * touches the family-tree data: a service-worker update only replaces the app files, and
 * localStorage is untouched by design.
 */
import { create } from 'zustand';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type Platform = 'ios' | 'other';

export interface PwaState {
  /** A new version is installed and waits; the user decides when to reload. */
  needRefresh: boolean;
  /** The current version is fully cached and works without a network connection. */
  offlineReady: boolean;
  /** The page is running as an installed app (standalone window). */
  standalone: boolean;
  /** The browser offered a native install prompt (Chromium). */
  canPrompt: boolean;
  platform: Platform;
  online: boolean;
  /** Set by the registration; reloads with the waiting version. */
  update: () => Promise<void>;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  dismissRefresh: () => void;
  dismissOfflineReady: () => void;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function detectPlatform(ua: string): Platform {
  return /iPad|iPhone|iPod/.test(ua) ? 'ios' : 'other';
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
}

export const usePwa = create<PwaState>((set) => ({
  needRefresh: false,
  offlineReady: false,
  standalone: isStandalone(),
  canPrompt: false,
  platform: typeof navigator !== 'undefined' ? detectPlatform(navigator.userAgent) : 'other',
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  update: async () => {},
  promptInstall: async () => {
    if (!deferredPrompt) return 'unavailable';
    const ev = deferredPrompt;
    deferredPrompt = null;
    set({ canPrompt: false });
    await ev.prompt();
    const choice = await ev.userChoice;
    if (choice.outcome === 'accepted') set({ standalone: true });
    return choice.outcome;
  },
  dismissRefresh: () => set({ needRefresh: false }),
  dismissOfflineReady: () => set({ offlineReady: false }),
}));

/** Wires the browser events; called once from the registration module. */
export function listenToBrowser(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    usePwa.setState({ canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    usePwa.setState({ canPrompt: false, standalone: true });
  });
  window.addEventListener('online', () => usePwa.setState({ online: true }));
  window.addEventListener('offline', () => usePwa.setState({ online: false }));
}
