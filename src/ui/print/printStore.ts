/** Open state and context of the print dialog (what the tree view had selected/filtered). */
import { create } from 'zustand';

export interface PrintContext {
  selection: string[];
  /** Visible ids under the current filter, or null when no filter is active. */
  filtered: string[] | null;
  clusters: { index: number; personIds: string[] }[];
  defaultContent: 'tree' | 'timeline' | 'statistics';
  /** Chart mode of the tree view: fixed positions, lines and scope. */
  chart: { positions: [string, { x: number; y: number }][]; visible: string[]; lines: { d: string }[]; useUnions: boolean; label: string } | null;
}

interface State {
  open: boolean;
  context: PrintContext;
  show: (ctx: Partial<PrintContext>) => void;
  hide: () => void;
}

export const usePrint = create<State>((set) => ({
  open: false,
  context: { selection: [], filtered: null, clusters: [], defaultContent: 'tree', chart: null },
  show: (ctx) => set((s) => ({ open: true, context: { ...s.context, selection: [], filtered: null, clusters: [], defaultContent: 'tree', chart: null, ...ctx } })),
  hide: () => set({ open: false }),
}));

export const openPrint = (ctx: Partial<PrintContext> = {}) => usePrint.getState().show(ctx);
