/**
 * Status messages: one visible row with the newest message, announced politely. Plain
 * messages fade after a few seconds; warnings and errors stay until dismissed. Everything
 * goes to a short log that can be opened from the row. Critical information is always also
 * shown in place, never only here.
 */
import { create } from 'zustand';

export type StatusKind = 'info' | 'warn' | 'danger';
export interface StatusMessage {
  id: number;
  kind: StatusKind;
  text: string;
  at: number;
}

interface StatusState {
  /** The message shown in the row, or null. */
  current: StatusMessage | null;
  /** The last messages, newest first. */
  log: StatusMessage[];
  logOpen: boolean;
  push: (text: string, kind?: StatusKind) => number;
  dismiss: (id?: number) => void;
  toggleLog: () => void;
  clearLog: () => void;
}

export const AUTO_HIDE_MS = 6000;
const LOG_MAX = 30;
let counter = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useStatus = create<StatusState>((set, get) => ({
  current: null,
  log: [],
  logOpen: false,
  push: (text, kind = 'info') => {
    const id = ++counter;
    const msg: StatusMessage = { id, kind, text, at: Date.now() };
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
    set((s) => ({ current: msg, log: [msg, ...s.log.filter((m) => m.text !== text)].slice(0, LOG_MAX) }));
    if (kind === 'info') {
      hideTimer = setTimeout(() => {
        if (get().current?.id === id) set({ current: null });
      }, AUTO_HIDE_MS);
    }
    return id;
  },
  dismiss: (id) => {
    if (id === undefined || get().current?.id === id) set({ current: null });
  },
  toggleLog: () => set((s) => ({ logOpen: !s.logOpen })),
  clearLog: () => set({ log: [], logOpen: false }),
}));

export const announce = (text: string, kind: StatusKind = 'info') => useStatus.getState().push(text, kind);
