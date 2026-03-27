import { create } from 'zustand';

export interface UndoEntry {
  type: string;
  label: string;
  rollback: () => Promise<void>;
  reapply?: () => Promise<void>;
}

const MAX_HISTORY = 20;

interface UndoRedoState {
  past: UndoEntry[];
  future: UndoEntry[];
  canUndo: boolean;
  canRedo: boolean;
  lastAction: { label: string; type: 'undo' | 'redo'; ts: number } | null;
  push: (entry: UndoEntry) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

export const useUndoRedoGlobal = create<UndoRedoState>()((set, get) => ({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,
  lastAction: null,

  push(entry: UndoEntry) {
    set(s => {
      const next = [...s.past, entry].slice(-MAX_HISTORY);
      return {
        past: next,
        future: [],
        canUndo: next.length > 0,
        canRedo: false,
        lastAction: null,
      };
    });
  },

  async undo() {
    const { past } = get();
    if (past.length === 0) return;
    const entry = past[past.length - 1];
    set(s => {
      const nextPast = s.past.slice(0, -1);
      const nextFuture = [entry, ...s.future];
      return {
        past: nextPast,
        future: nextFuture,
        canUndo: nextPast.length > 0,
        canRedo: nextFuture.length > 0,
        lastAction: { label: entry.label, type: 'undo', ts: Date.now() },
      };
    });
    try { await entry.rollback(); } catch { /* ignore */ }
  },

  async redo() {
    const { future } = get();
    if (future.length === 0) return;
    const entry = future[0];
    set(s => {
      const nextFuture = s.future.slice(1);
      const nextPast = [...s.past, entry];
      return {
        future: nextFuture,
        past: nextPast,
        canUndo: nextPast.length > 0,
        canRedo: nextFuture.length > 0,
        lastAction: { label: entry.label, type: 'redo', ts: Date.now() },
      };
    });
    try { if (entry.reapply) await entry.reapply(); } catch { /* ignore */ }
  },
}));
