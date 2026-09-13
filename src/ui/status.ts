/**
 * Status messages ("toasts" that do not vanish). Messages stay until dismissed; they are
 * announced through an aria-live region. Critical information is always also shown in place,
 * never only here.
 */
import { create } from 'zustand';

export type StatusKind = 'info' | 'warn' | 'danger';
export interface StatusMessage {
  id: number;
  kind: StatusKind;
  text: string;
}

interface StatusState {
  messages: StatusMessage[];
  push: (text: string, kind?: StatusKind) => number;
  dismiss: (id: number) => void;
}

let counter = 0;
export const useStatus = create<StatusState>((set) => ({
  messages: [],
  push: (text, kind = 'info') => {
    const id = ++counter;
    set((s) => ({ messages: [...s.messages.filter((m) => m.text !== text), { id, kind, text }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),
}));

export const announce = (text: string, kind: StatusKind = 'info') => useStatus.getState().push(text, kind);
