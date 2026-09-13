import { describe, expect, it } from 'vitest';
import { UndoStack, UNDO_LIMIT } from '@/store/undo';

interface S {
  items: string[];
  n: number;
}

describe('UndoStack', () => {
  it('records one entry per transaction and undoes/redoes it', () => {
    const u = new UndoStack<S>();
    let s: S = { items: [], n: 0 };
    s = u.transact(s, 'add a', (d) => void d.items.push('a'));
    s = u.transact(s, 'add b', (d) => void d.items.push('b'));
    expect(s.items).toEqual(['a', 'b']);
    expect(u.undoLabel).toBe('add b');
    s = u.undo(s)!.state;
    expect(s.items).toEqual(['a']);
    expect(u.redoLabel).toBe('add b');
    s = u.redo(s)!.state;
    expect(s.items).toEqual(['a', 'b']);
  });

  it('joins nested transactions into a single step', () => {
    const u = new UndoStack<S>();
    let s: S = { items: [], n: 0 };
    s = u.transact(s, 'bulk', (d) => {
      for (let i = 0; i < 5; i++) {
        // inner calls receive the outer draft and do not create entries
        u.transact(s, `inner ${i}`, (dd) => void dd.items.push(String(i)));
      }
      d.n = 5;
    });
    expect(s.items).toHaveLength(5);
    expect(u.size).toBe(1);
    expect(u.undoLabel).toBe('bulk');
    s = u.undo(s)!.state;
    expect(s).toEqual({ items: [], n: 0 });
  });

  it('does not record a step when nothing changed', () => {
    const u = new UndoStack<S>();
    const s: S = { items: [], n: 0 };
    const next = u.transact(s, 'noop', () => {});
    expect(next).toBe(s);
    expect(u.canUndo).toBe(false);
  });

  it('caps the stack at 50 and drops the oldest', () => {
    const u = new UndoStack<S>();
    let s: S = { items: [], n: 0 };
    for (let i = 0; i < UNDO_LIMIT + 10; i++) s = u.transact(s, `step ${i}`, (d) => void (d.n = i + 1));
    expect(u.size).toBe(UNDO_LIMIT);
    let steps = 0;
    while (u.canUndo) {
      s = u.undo(s)!.state;
      steps++;
    }
    expect(steps).toBe(UNDO_LIMIT);
    expect(s.n).toBe(10);
  });

  it('clears redo on a new change and clears everything on clear()', () => {
    const u = new UndoStack<S>();
    let s: S = { items: [], n: 0 };
    s = u.transact(s, 'a', (d) => void (d.n = 1));
    s = u.undo(s)!.state;
    expect(u.canRedo).toBe(true);
    s = u.transact(s, 'b', (d) => void (d.n = 2));
    expect(u.canRedo).toBe(false);
    u.clear();
    expect(u.canUndo).toBe(false);
  });

  it('stores patches, not snapshots', () => {
    const u = new UndoStack<{ big: number[]; flag: boolean }>();
    const s = { big: Array.from({ length: 10_000 }, (_, i) => i), flag: false };
    u.transact(s, 'flag', (d) => void (d.flag = true));
    const entry = (u as unknown as { past: { patches: unknown[] }[] }).past[0]!;
    expect(JSON.stringify(entry.patches).length).toBeLessThan(200);
  });
});
