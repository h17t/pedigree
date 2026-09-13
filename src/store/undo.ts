/**
 * Undo/redo built on Immer patches. Each entry stores the forward and inverse patches of
 * one user-visible step. Nested transactions join the outermost one, so bulk operations
 * (wizard completion, auto-layout, merge-import) become a single step by construction.
 * The stack lives in memory only, is capped at 50 entries and is cleared on project switch.
 */
import { applyPatches, enablePatches, produceWithPatches } from 'immer';
import type { Draft, Patch } from 'immer';

enablePatches();

export const UNDO_LIMIT = 50;

export interface UndoEntry {
  label: string;
  patches: Patch[];
  inversePatches: Patch[];
}

export class UndoStack<T extends object> {
  private past: UndoEntry[] = [];
  private future: UndoEntry[] = [];
  private depth = 0;
  private draft: Draft<T> | null = null;
  private outerLabel = '';

  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
  get undoLabel(): string | null {
    return this.past.length ? this.past[this.past.length - 1]!.label : null;
  }
  get redoLabel(): string | null {
    return this.future.length ? this.future[this.future.length - 1]!.label : null;
  }
  get size(): number {
    return this.past.length;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }

  /**
   * Run `recipe` against `base` and record one undo entry. Returns the next state, or the
   * same object when nothing changed (then no entry is recorded). When called while another
   * transaction is open, the recipe runs on the outer draft and no separate entry is made.
   */
  transact(base: T, label: string, recipe: (draft: Draft<T>) => void): T {
    if (this.draft) {
      recipe(this.draft);
      return base;
    }
    this.depth += 1;
    this.outerLabel = label;
    let result: T;
    try {
      const [next, patches, inversePatches] = produceWithPatches(base, (draft) => {
        this.draft = draft;
        try {
          recipe(draft);
        } finally {
          this.draft = null;
        }
      });
      result = next;
      if (patches.length > 0) {
        this.past.push({ label: this.outerLabel, patches, inversePatches });
        if (this.past.length > UNDO_LIMIT) this.past.shift();
        this.future = [];
      }
    } finally {
      this.depth -= 1;
      this.draft = null;
    }
    return result;
  }

  undo(state: T): { state: T; entry: UndoEntry } | null {
    const entry = this.past.pop();
    if (!entry) return null;
    this.future.push(entry);
    return { state: applyPatches(state, entry.inversePatches), entry };
  }

  redo(state: T): { state: T; entry: UndoEntry } | null {
    const entry = this.future.pop();
    if (!entry) return null;
    this.past.push(entry);
    return { state: applyPatches(state, entry.patches), entry };
  }
}
