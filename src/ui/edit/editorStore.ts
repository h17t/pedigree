/**
 * What is currently being edited or asked. Ephemeral (never persisted). Any view can open an
 * editor; the details host renders it in the right place (phone sheet or laptop column).
 */
import { create } from 'zustand';

export type EditorState =
  | { kind: 'none' }
  | { kind: 'person'; id: string; isNew: boolean }
  | { kind: 'union'; id: string }
  | { kind: 'deletePerson'; id: string }
  | { kind: 'deleteUnion'; id: string }
  | { kind: 'deleteMany'; ids: string[] }
  | { kind: 'merge'; aId: string; bId: string | null }
  | { kind: 'link'; personId: string; role: 'partner' | 'child' | 'parent' | 'sibling'; unionId?: string }
  | { kind: 'warnings' };

interface Store {
  state: EditorState;
  open: (s: EditorState) => void;
  close: () => void;
}

export const useEditor = create<Store>((set) => ({
  state: { kind: 'none' },
  open: (state) => set({ state }),
  close: () => set({ state: { kind: 'none' } }),
}));

export const openEditor = (s: EditorState) => useEditor.getState().open(s);
export const closeEditor = () => useEditor.getState().close();
